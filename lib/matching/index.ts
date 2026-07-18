export { applyOperator } from './apply-operator';
export { evaluateScholarship } from './evaluate-scholarship';
export { rank } from './rank';
export type { RankableResult } from './rank';

// TODO(P1): matchProfile(profile) server action -- validates the incoming
// profile via profileSchema, loads published scholarships + eligibility_rules
// + deadline_cycles via supabase-js, calls evaluateScholarship per
// scholarship, then ranks the eligible results via rank(). This is deferred
// out of P0 because it requires live I/O (supabase-js reads), whereas
// everything in this module is pure and I/O-free. It belongs alongside the
// profile form and results UI in P1 (see app/match or lib/actions).
