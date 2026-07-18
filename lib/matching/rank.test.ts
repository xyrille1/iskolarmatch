import { describe, expect, it } from 'vitest';
import type { MatchResult } from '@/lib/types/matching';
import { rank, type RankableResult } from './rank';

function eligibleResult(scholarshipId: string): MatchResult {
  return { scholarshipId, bucket: 'eligible', passedReasons: [], failedReasons: [] };
}

describe('rank', () => {
  it('sorts by closesAt ascending', () => {
    const items: RankableResult[] = [
      { result: eligibleResult('b'), closesAt: '2026-09-01', coverageType: 'full' },
      { result: eligibleResult('a'), closesAt: '2026-07-01', coverageType: 'full' },
    ];

    const sorted = rank(items);

    expect(sorted.map((i) => i.result.scholarshipId)).toEqual(['a', 'b']);
  });

  it('tie-breaks by coverage_type: full > partial > allowance > other', () => {
    const items: RankableResult[] = [
      { result: eligibleResult('allowance'), closesAt: '2026-08-01', coverageType: 'allowance' },
      { result: eligibleResult('full'), closesAt: '2026-08-01', coverageType: 'full' },
      { result: eligibleResult('partial'), closesAt: '2026-08-01', coverageType: 'partial' },
      { result: eligibleResult('other'), closesAt: '2026-08-01', coverageType: 'other' },
    ];

    const sorted = rank(items);

    expect(sorted.map((i) => i.result.scholarshipId)).toEqual(['full', 'partial', 'allowance', 'other']);
  });

  it('does not mutate the input array', () => {
    const items: RankableResult[] = [
      { result: eligibleResult('b'), closesAt: '2026-09-01', coverageType: 'full' },
      { result: eligibleResult('a'), closesAt: '2026-07-01', coverageType: 'full' },
    ];
    const original = [...items];

    rank(items);

    expect(items).toEqual(original);
  });
});
