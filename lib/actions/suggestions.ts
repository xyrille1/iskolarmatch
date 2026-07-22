"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/actions/log-audit";
import {
  markVerified,
  updateDeadlineCycle,
  updateEligibilityRule,
  updateRequirement,
  upsertScholarship,
} from "@/lib/actions/admin";
import { valuesEqual } from "@/lib/source-watcher/diff-against-record";
import { ALLOWED_FIELDS_BY_TABLE, type TargetTable } from "@/lib/types/source-watcher";

// FR10 curator approval. Nothing here auto-publishes: a suggestion becomes real
// data ONLY when a curator approves it, and approval routes every field through
// the SAME validated admin action a curator would use by hand -- so nothing
// bypasses Zod validation, the URL allowlist, or the publish guard. Approval
// also stamps last_verified_at/verified_by via markVerified(), because an
// approved source-derived correction is itself a re-verification (FR9).

interface SuggestionRow {
  id: string;
  scholarship_id: string;
  target_table: TargetTable;
  target_row_id: string | null;
  target_field: string;
  change_kind: string;
  old_value: unknown;
  new_value: unknown;
  status: string;
}

// Coerce the extracted value (string | number | boolean | null) to the shape
// the target field's Zod schema expects, so the single overridden field slots
// into an otherwise-current, already-valid payload.
function coerceValue(table: TargetTable, field: string, value: unknown): unknown {
  const asBool = (v: unknown) => (typeof v === "boolean" ? v : String(v).trim().toLowerCase() === "true");
  if (table === "requirements" && field === "sort_order") return Number(value);
  if (field === "is_mandatory") return asBool(value);
  if (table === "eligibility_rules" && field === "value") return value; // schema: z.unknown()
  return value === null || value === undefined ? value : String(value);
}

async function applyScholarshipUpdate(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  suggestion: SuggestionRow
): Promise<void> {
  const { data: sch, error } = await supabase
    .from("scholarships")
    .select(
      "id, provider_id, title, slug, summary, description, coverage_type, benefit_summary, official_url, application_url, is_published, last_verified_at"
    )
    .eq("id", suggestion.scholarship_id)
    .single();
  if (error || !sch) throw new Error("Scholarship no longer exists.");

  assertUnchanged(sch[suggestion.target_field as keyof typeof sch], suggestion.old_value);

  const base: Record<string, unknown> = {
    id: sch.id,
    provider_id: sch.provider_id,
    title: sch.title,
    slug: sch.slug,
    summary: sch.summary ?? undefined,
    description: sch.description ?? undefined,
    coverage_type: sch.coverage_type,
    benefit_summary: sch.benefit_summary ?? undefined,
    official_url: sch.official_url,
    application_url: sch.application_url ?? undefined,
    is_published: sch.is_published,
    last_verified_at: sch.last_verified_at,
  };
  base[suggestion.target_field] = coerceValue("scholarships", suggestion.target_field, suggestion.new_value);

  // Routes through the full Zod schema + URL allowlist + publish guard.
  await upsertScholarship(base);
}

async function applyChildRowUpdate(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  suggestion: SuggestionRow
): Promise<void> {
  const rowId = suggestion.target_row_id;
  if (!rowId) throw new Error("Missing target row id for an update.");

  const { data: row, error } = await supabase.from(suggestion.target_table).select("*").eq("id", rowId).single();
  if (error || !row) throw new Error("The target row no longer exists (it may have been edited or deleted).");

  assertUnchanged(row[suggestion.target_field], suggestion.old_value);

  const coerced = coerceValue(suggestion.target_table, suggestion.target_field, suggestion.new_value);

  if (suggestion.target_table === "eligibility_rules") {
    const base: Record<string, unknown> = {
      scholarship_id: row.scholarship_id,
      field: row.field,
      operator: row.operator,
      value: row.value,
      is_mandatory: row.is_mandatory,
      human_label: row.human_label ?? "",
      guidance_text: row.guidance_text ?? undefined,
    };
    base[suggestion.target_field] = coerced;
    await updateEligibilityRule(rowId, base);
    return;
  }

  if (suggestion.target_table === "deadline_cycles") {
    const base: Record<string, unknown> = {
      scholarship_id: row.scholarship_id,
      academic_year: row.academic_year ?? undefined,
      opens_at: row.opens_at ?? undefined,
      closes_at: row.closes_at,
    };
    base[suggestion.target_field] = coerced;
    await updateDeadlineCycle(rowId, base);
    return;
  }

  if (suggestion.target_table === "requirements") {
    const base: Record<string, unknown> = {
      scholarship_id: row.scholarship_id,
      label: row.label,
      is_mandatory: row.is_mandatory,
      sort_order: row.sort_order,
    };
    base[suggestion.target_field] = coerced;
    await updateRequirement(rowId, base);
    return;
  }

  throw new Error(`Unsupported target table: ${suggestion.target_table}`);
}

// Optimistic-concurrency guard: if the live value drifted from what the
// suggestion recorded as old_value (a curator hand-edited it, or another
// suggestion already applied), refuse rather than silently overwrite.
function assertUnchanged(currentValue: unknown, recordedOld: unknown): void {
  if (!valuesEqual(currentValue, recordedOld)) {
    throw new Error(
      "This record changed since the suggestion was filed. Reject it and re-run the watcher to get a fresh suggestion."
    );
  }
}

export async function approveSuggestion(suggestionId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: suggestion, error } = await supabase
    .from("scholarship_suggestions")
    .select("id, scholarship_id, target_table, target_row_id, target_field, change_kind, old_value, new_value, status")
    .eq("id", suggestionId)
    .single();
  if (error || !suggestion) throw new Error("Suggestion not found.");

  const s = suggestion as SuggestionRow;
  if (s.status !== "pending") throw new Error("This suggestion has already been reviewed.");

  // Defense-in-depth: never trust a stored row's target blindly.
  const allowed = ALLOWED_FIELDS_BY_TABLE[s.target_table];
  if (!allowed || !allowed.includes(s.target_field)) {
    throw new Error(`Field ${s.target_table}.${s.target_field} is not approvable.`);
  }

  // MVP diff only ever emits update_field; add/remove need a human to author a
  // full row, so we refuse them explicitly rather than apply a partial write.
  if (s.change_kind !== "update_field") {
    throw new Error("Only field updates can be approved automatically; add/remove must be done by hand.");
  }

  if (s.target_table === "scholarships") {
    await applyScholarshipUpdate(supabase, s);
  } else {
    await applyChildRowUpdate(supabase, s);
  }

  // An approved source-derived correction is a re-verification against the
  // official source (FR9): stamp last_verified_at/verified_by.
  await markVerified(s.scholarship_id);

  const { error: statusError } = await supabase
    .from("scholarship_suggestions")
    .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", suggestionId);
  if (statusError) throw new Error("Applied the change but failed to close the suggestion; please retry.");

  await logAudit(userId, "approve_suggestion", "scholarship_suggestion", suggestionId, {
    target_table: s.target_table,
    target_field: s.target_field,
    new_value: s.new_value,
  });

  const { data: sch } = await supabase.from("scholarships").select("slug").eq("id", s.scholarship_id).single();
  revalidatePath("/admin/suggestions");
  revalidatePath(`/admin/scholarships/${s.scholarship_id}/edit`);
  if (sch?.slug) revalidatePath(`/s/${sch.slug}`);
}

export async function rejectSuggestion(suggestionId: string, reason?: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // Pure bookkeeping on our own queue table -- zero writes to real content, so
  // "nothing auto-publishes" holds on the reject path too.
  const { error } = await supabase
    .from("scholarship_suggestions")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason?.trim() || null,
    })
    .eq("id", suggestionId)
    .eq("status", "pending");
  if (error) throw new Error("Failed to reject suggestion.");

  await logAudit(userId, "reject_suggestion", "scholarship_suggestion", suggestionId);
  revalidatePath("/admin/suggestions");
}

// --- FormData wrappers for plain <form action={...}> buttons ---

export async function approveSuggestionFormAction(suggestionId: string): Promise<void> {
  await approveSuggestion(suggestionId);
}

export async function rejectSuggestionFormAction(suggestionId: string, formData: FormData): Promise<void> {
  await rejectSuggestion(suggestionId, formData.get("reason")?.toString());
}
