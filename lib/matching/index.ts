export { applyOperator } from './apply-operator';
export { evaluateScholarship } from './evaluate-scholarship';
export { rank } from './rank';
export type { RankableResult } from './rank';
export { buildScholarshipMatches } from './build-scholarship-matches';
export type { ScholarshipMatch, MatchProfileResult, ScholarshipRow } from './build-scholarship-matches';

// The Supabase-reading entry point (fetch published scholarships, then call
// buildScholarshipMatches) lives in lib/actions/match-profile.ts, not here --
// this module stays pure and I/O-free.
