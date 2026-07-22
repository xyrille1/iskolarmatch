import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";
import { candidateConfidenceRank } from "@/lib/source-discovery/score-candidate";
import type { CandidateConfidence, CitingSnippet, StoredCandidate } from "@/lib/types/source-discovery";

// FR22 (docs/PRD.md §4.7): the discovery review queue. Admin-only; pending
// candidates surfaced worst-confidence-first so the riskiest drafts get a human's
// eyes soonest. Mirrors get-suggestions-queue.ts -- service-role client.
// `_admin` is required (never read) on both exports below so "called only
// after requireAdmin() gates the caller" lives in the type system, not just a
// comment (docs/QA-CHECKLIST.md P2-04).

export interface DiscoveryQueueItem {
  id: string;
  detailUrl: string;
  confidence: CandidateConfidence;
  draft: StoredCandidate;
  snippets: CitingSnippet[];
  sourceLabel: string | null;
  createdAt: string;
}

interface CandidateRow {
  id: string;
  detail_url: string;
  confidence: CandidateConfidence;
  extracted: StoredCandidate;
  citing_snippets: CitingSnippet[];
  created_at: string;
  source_index_pages: { label: string | null; index_url: string } | null;
}

export async function getPendingCandidates(_admin: AdminContext): Promise<DiscoveryQueueItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scholarship_candidates")
    .select(
      "id, detail_url, confidence, extracted, citing_snippets, created_at, source_index_pages ( label, index_url )"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Failed to load scholarship candidates.");

  const rows = (data ?? []) as unknown as CandidateRow[];

  const items: DiscoveryQueueItem[] = rows.map((row) => ({
    id: row.id,
    detailUrl: row.detail_url,
    confidence: row.confidence,
    draft: row.extracted,
    snippets: row.citing_snippets ?? [],
    sourceLabel: row.source_index_pages?.label ?? row.source_index_pages?.index_url ?? null,
    createdAt: row.created_at,
  }));

  // Worst confidence first; created_at order preserved within a level (stable).
  return items.sort((a, b) => candidateConfidenceRank(a.confidence) - candidateConfidenceRank(b.confidence));
}

export async function getPendingCandidateCount(_admin: AdminContext): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("scholarship_candidates")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
