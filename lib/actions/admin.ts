"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deadlineCycleInputSchema,
  eligibilityRuleInputSchema,
  providerInputSchema,
  requirementInputSchema,
  scholarshipUpsertSchema,
} from "@/lib/types/admin";

async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("audit_log").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, detail });
}

export async function upsertScholarship(payload: unknown): Promise<{ id: string }> {
  const { userId } = await requireAdmin();
  const parsed = scholarshipUpsertSchema.parse(payload);

  const supabase = createSupabaseAdminClient();
  const { id, ...rest } = parsed;

  const row = {
    ...rest,
    application_url: rest.application_url || null,
  };

  const { data, error } = id
    ? await supabase.from("scholarships").update(row).eq("id", id).select("id").single()
    : await supabase.from("scholarships").insert(row).select("id").single();

  if (error) throw new Error(`Failed to save scholarship: ${error.message}`);

  await logAudit(userId, id ? "update" : "create", "scholarship", data.id, { title: parsed.title });
  revalidatePath("/admin");
  revalidatePath(`/s/${parsed.slug}`);

  return { id: data.id };
}

export async function markVerified(scholarshipId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("scholarships")
    .update({ last_verified_at: new Date().toISOString(), verified_by: userId })
    .eq("id", scholarshipId);

  if (error) throw new Error("Failed to mark verified.");

  await logAudit(userId, "mark_verified", "scholarship", scholarshipId);
  revalidatePath("/admin");
}

export async function addEligibilityRule(payload: unknown): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = eligibilityRuleInputSchema.parse(payload);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.from("eligibility_rules").insert(parsed).select("id").single();
  if (error) throw new Error(`Failed to add eligibility rule: ${error.message}`);

  await logAudit(userId, "create", "eligibility_rule", data.id, { scholarship_id: parsed.scholarship_id });
  revalidatePath("/admin");
}

export async function deleteEligibilityRule(ruleId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("eligibility_rules").delete().eq("id", ruleId);
  if (error) throw new Error("Failed to delete eligibility rule.");

  await logAudit(userId, "delete", "eligibility_rule", ruleId);
  revalidatePath("/admin");
}

export async function addRequirement(payload: unknown): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = requirementInputSchema.parse(payload);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.from("requirements").insert(parsed).select("id").single();
  if (error) throw new Error(`Failed to add requirement: ${error.message}`);

  await logAudit(userId, "create", "requirement", data.id, { scholarship_id: parsed.scholarship_id });
  revalidatePath("/admin");
}

export async function deleteRequirement(requirementId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("requirements").delete().eq("id", requirementId);
  if (error) throw new Error("Failed to delete requirement.");

  await logAudit(userId, "delete", "requirement", requirementId);
  revalidatePath("/admin");
}

export async function addDeadlineCycle(payload: unknown): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = deadlineCycleInputSchema.parse(payload);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("deadline_cycles")
    .insert({ ...parsed, opens_at: parsed.opens_at || null, academic_year: parsed.academic_year || null })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to add deadline cycle: ${error.message}`);

  await logAudit(userId, "create", "deadline_cycle", data.id, { scholarship_id: parsed.scholarship_id });
  revalidatePath("/admin");
}

export async function deleteDeadlineCycle(cycleId: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("deadline_cycles").delete().eq("id", cycleId);
  if (error) throw new Error("Failed to delete deadline cycle.");

  await logAudit(userId, "delete", "deadline_cycle", cycleId);
  revalidatePath("/admin");
}

export async function upsertProvider(payload: unknown): Promise<{ id: string }> {
  const { userId } = await requireAdmin();
  const parsed = providerInputSchema.parse(payload);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("providers")
    .insert({ ...parsed, website: parsed.website || null })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save provider: ${error.message}`);

  await logAudit(userId, "create", "provider", data.id, { name: parsed.name });
  revalidatePath("/admin/providers");

  return { id: data.id };
}

// --- FormData-facing wrappers for plain <form action={...}> submissions ---
// The admin tool is deliberately utilitarian (docs/iskolar-ux-design.md
// §2: "NOT editorial-skinned"), so these skip client-side state management
// in favor of direct Server Action form bindings.

export async function upsertScholarshipFormAction(formData: FormData): Promise<void> {
  const id = formData.get("id")?.toString();
  const lastVerifiedAtRaw = formData.get("last_verified_at")?.toString();
  const lastVerifiedAt = lastVerifiedAtRaw ? new Date(lastVerifiedAtRaw).toISOString() : null;

  const result = await upsertScholarship({
    id: id || undefined,
    provider_id: formData.get("provider_id")?.toString(),
    title: formData.get("title")?.toString(),
    slug: formData.get("slug")?.toString(),
    summary: formData.get("summary")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    coverage_type: formData.get("coverage_type")?.toString(),
    benefit_summary: formData.get("benefit_summary")?.toString() || undefined,
    official_url: formData.get("official_url")?.toString(),
    application_url: formData.get("application_url")?.toString() || undefined,
    is_published: formData.get("is_published") === "on",
    last_verified_at: lastVerifiedAt,
  });

  redirect(`/admin/scholarships/${result.id}/edit`);
}

export async function addEligibilityRuleFormAction(scholarshipId: string, formData: FormData): Promise<void> {
  const rawValue = formData.get("value")?.toString() ?? "";
  let value: unknown = rawValue;
  try {
    value = JSON.parse(rawValue);
  } catch {
    // Not valid JSON -- treat as a plain string value (e.g. a bare region code).
  }

  await addEligibilityRule({
    scholarship_id: scholarshipId,
    field: formData.get("field")?.toString(),
    operator: formData.get("operator")?.toString(),
    value,
    is_mandatory: formData.get("is_mandatory") === "on",
    human_label: formData.get("human_label")?.toString(),
  });
}

export async function addRequirementFormAction(scholarshipId: string, formData: FormData): Promise<void> {
  await addRequirement({
    scholarship_id: scholarshipId,
    label: formData.get("label")?.toString(),
    is_mandatory: formData.get("is_mandatory") === "on",
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
}

export async function addDeadlineCycleFormAction(scholarshipId: string, formData: FormData): Promise<void> {
  await addDeadlineCycle({
    scholarship_id: scholarshipId,
    academic_year: formData.get("academic_year")?.toString() || undefined,
    opens_at: formData.get("opens_at")?.toString() || undefined,
    closes_at: formData.get("closes_at")?.toString(),
  });
}

export async function upsertProviderFormAction(formData: FormData): Promise<void> {
  await upsertProvider({
    name: formData.get("name")?.toString(),
    type: formData.get("type")?.toString(),
    website: formData.get("website")?.toString() || undefined,
  });
}
