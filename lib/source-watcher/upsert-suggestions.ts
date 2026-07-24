import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SuggestionProposal } from "@/lib/types/source-watcher";
import type { ConfidenceResult } from "./score-confidence";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export interface ScoredProposal {
  proposal: SuggestionProposal;
  confidence: ConfidenceResult;
}

export interface UpsertSuggestionsResult {
  written: number;
  // Genuine insert/update failures (anything other than a benign duplicate),
  // so the caller's run summary can distinguish "nothing new" from "something
  // broke" (docs/QA-CHECKLIST.md P2-09) instead of swallowing every error.
  failed: number;
}

// Writes scored proposals into scholarship_suggestions with the dedupe
// invariant applied in the app layer: at most one PENDING suggestion per
// (scholarship, table, row, field). A weekly re-run that re-derives the same
// change UPDATES the existing pending row (refreshed value/confidence/source)
// instead of piling up duplicates. The DB partial unique index is the safety
// net; this explicit select-then-update-or-insert is the primary path because
// PostgREST upsert can't target the coalesce() expression index.
//
// All update_field proposals carry a non-null target_row_id (scholarships use
// their own id), so the dedupe lookup is a plain equality match.
export async function upsertSuggestions(
  supabase: AdminClient,
  sourceDocumentId: string,
  scored: ScoredProposal[]
): Promise<UpsertSuggestionsResult> {
  let written = 0;
  let failed = 0;

  for (const { proposal, confidence } of scored) {
    const rowData = {
      scholarship_id: proposal.scholarshipId,
      source_document_id: sourceDocumentId,
      target_table: proposal.targetTable,
      target_row_id: proposal.targetRowId,
      target_field: proposal.targetField,
      change_kind: proposal.changeKind,
      old_value: proposal.oldValue ?? null,
      new_value: proposal.newValue ?? null,
      citing_section_ids: proposal.citingSectionIds,
      confidence: confidence.level,
      confidence_detail: confidence.detail,
      status: "pending" as const,
    };

    const { data: existing } = await supabase
      .from("scholarship_suggestions")
      .select("id")
      .eq("scholarship_id", proposal.scholarshipId)
      .eq("target_table", proposal.targetTable)
      .eq("target_row_id", proposal.targetRowId as string)
      .eq("target_field", proposal.targetField)
      .eq("status", "pending")
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("scholarship_suggestions").update(rowData).eq("id", existing.id);
      if (error) {
        console.error(`[source-watcher] Failed to update suggestion ${existing.id}: ${error.message}`);
        failed += 1;
      } else {
        written += 1;
      }
    } else {
      const { error } = await supabase.from("scholarship_suggestions").insert(rowData);
      if (error) {
        console.error(
          `[source-watcher] Failed to insert suggestion for ${proposal.scholarshipId}/${proposal.targetField}: ${error.message}`
        );
        failed += 1;
      } else {
        written += 1;
      }
    }
  }

  return { written, failed };
}
