import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";
import { confidenceRank } from "@/lib/source-watcher/score-confidence";
import type { ChangeKind, ConfidenceLevel, TargetTable } from "@/lib/types/source-watcher";

// FR10 (docs/PRD.md §1.6): the curator suggestion queue. Admin-only, pending
// suggestions surfaced worst-confidence-first so the riskiest proposed changes
// get a human's eyes soonest. Mirrors get-scholarship-reports.ts -- service-
// role client, called only after requireAdmin() gates the caller.

export interface SuggestionQueueItem {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  scholarshipSlug: string;
  targetTable: TargetTable;
  targetField: string;
  changeKind: ChangeKind;
  oldValue: unknown;
  newValue: unknown;
  confidence: ConfidenceLevel;
  citingLabels: string[];
  createdAt: string;
}

interface SuggestionRow {
  id: string;
  scholarship_id: string;
  target_table: TargetTable;
  target_field: string;
  change_kind: ChangeKind;
  old_value: unknown;
  new_value: unknown;
  confidence: ConfidenceLevel;
  citing_section_ids: string[];
  created_at: string;
  scholarships: { title: string; slug: string } | null;
}

// `_admin` is required (never read) so "called only after requireAdmin()
// gates the caller" lives in the type system, not just a comment
// (docs/QA-CHECKLIST.md P2-04).
export async function getPendingSuggestions(_admin: AdminContext): Promise<SuggestionQueueItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scholarship_suggestions")
    .select(
      "id, scholarship_id, target_table, target_field, change_kind, old_value, new_value, confidence, citing_section_ids, created_at, scholarships ( title, slug )"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Failed to load scholarship suggestions.");

  const rows = (data ?? []) as unknown as SuggestionRow[];

  // Resolve citing section ids -> heading labels in one follow-up query, so the
  // curator sees which part of the page each change came from.
  const allSectionIds = [...new Set(rows.flatMap((r) => r.citing_section_ids ?? []))];
  const labelById = new Map<string, string>();
  if (allSectionIds.length > 0) {
    const { data: sections } = await supabase
      .from("source_sections")
      .select("id, heading_label")
      .in("id", allSectionIds);
    for (const s of (sections ?? []) as Array<{ id: string; heading_label: string | null }>) {
      labelById.set(s.id, s.heading_label ?? "(unlabeled section)");
    }
  }

  const items = rows.map((row) => ({
    id: row.id,
    scholarshipId: row.scholarship_id,
    scholarshipTitle: row.scholarships?.title ?? "Unknown scholarship",
    scholarshipSlug: row.scholarships?.slug ?? "",
    targetTable: row.target_table,
    targetField: row.target_field,
    changeKind: row.change_kind,
    oldValue: row.old_value,
    newValue: row.new_value,
    confidence: row.confidence,
    citingLabels: (row.citing_section_ids ?? []).map((id) => labelById.get(id) ?? "(unlabeled section)"),
    createdAt: row.created_at,
  }));

  // Worst confidence first; within a confidence level, oldest first (already
  // ordered by created_at from the query, so this stable sort preserves it).
  return items.sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence));
}
