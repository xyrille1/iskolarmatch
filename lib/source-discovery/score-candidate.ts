import type { CandidateDraft, CandidateConfidence } from "@/lib/types/source-discovery";

// Deterministic, rule-based confidence for a discovered candidate -- no LLM in
// the scoring path (parallel to lib/source-watcher/score-confidence.ts). This
// only orders the curator's review queue (riskiest first); it never gates
// anything, because nothing publishes without a human either way.
//
// A candidate is only as trustworthy as the facts it pins down. The two facts a
// scholarship record most needs are a close date (deadline safety, PRD G3) and
// a concrete coverage type. Missing either drops confidence.

export function scoreCandidate(draft: CandidateDraft): CandidateConfidence {
  const hasDeadline = Boolean(draft.deadline_closes_at);
  const hasCoverage = draft.coverage_type !== "other";
  const hasTitle = draft.title.trim().length > 0;
  const hasEligibility = draft.eligibility_notes.length > 0;

  if (!hasTitle) return "low";
  if (hasDeadline && hasCoverage && hasEligibility) return "high";
  if (hasDeadline || hasCoverage) return "medium";
  return "low";
}

// Queue ordering: worst confidence first, so the riskiest drafts get eyes first.
const RANK: Record<CandidateConfidence, number> = { low: 0, medium: 1, high: 2 };
export function candidateConfidenceRank(level: CandidateConfidence): number {
  return RANK[level];
}
