import type { CoverageType, MatchResult } from '@/lib/types/matching';

// Pure comparator. Doesn't take MatchResult directly since it doesn't carry
// closes_at/coverage_type -- the caller (P1's matchProfile) joins those in
// from the DB rows it already has.
export interface RankableResult {
  result: MatchResult;
  closesAt: string;
  coverageType: CoverageType;
}

const COVERAGE_RANK: Record<CoverageType, number> = {
  full: 0,
  partial: 1,
  allowance: 2,
  other: 3,
};

export function rank(items: RankableResult[]): RankableResult[] {
  return [...items].sort((a, b) => {
    const dateDiff = Date.parse(a.closesAt) - Date.parse(b.closesAt);
    if (dateDiff !== 0) return dateDiff;
    return COVERAGE_RANK[a.coverageType] - COVERAGE_RANK[b.coverageType];
  });
}
