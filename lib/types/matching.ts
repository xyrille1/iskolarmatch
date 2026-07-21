import { z } from 'zod';

export const MATCH_BUCKETS = ['eligible', 'near_miss', 'not_eligible'] as const;

export type MatchBucket = (typeof MATCH_BUCKETS)[number];

export const matchBucketSchema = z.enum(MATCH_BUCKETS);

export interface RuleResult {
  ruleId: string;
  humanLabel: string | null;
  // FR14 (docs/PRD.md §4.2): curator-authored guidance shown alongside a
  // failed mandatory rule. Null unless the curator wrote one.
  guidanceText: string | null;
  passed: boolean;
}

export interface MatchResult {
  scholarshipId: string;
  bucket: MatchBucket;
  // Restricted to mandatory rules only -- non-mandatory rules never appear here.
  passedReasons: RuleResult[];
  failedReasons: RuleResult[];
}

export const COVERAGE_TYPES = ['full', 'partial', 'allowance', 'other'] as const;

export type CoverageType = (typeof COVERAGE_TYPES)[number];
