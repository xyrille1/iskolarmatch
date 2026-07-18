import type { Profile, Rule } from "@/lib/types/profile";
import type { CoverageType } from "@/lib/types/matching";
import type { DeadlineStatus } from "@/lib/deadline/format-status";
import { evaluateScholarship } from "./evaluate-scholarship";
import { rank, type RankableResult } from "./rank";

export interface ScholarshipMatch {
  scholarshipId: string;
  slug: string;
  title: string;
  providerName: string;
  coverageType: CoverageType;
  status: DeadlineStatus;
  closesAt: string;
  opensAt: string | null;
  lastVerifiedAt: string | null;
  requirementCount: number;
  whyChips: string[];
  gapExplainer: string | null;
}

export interface MatchProfileResult {
  eligible: ScholarshipMatch[];
  nearMiss: ScholarshipMatch[];
  notEligible: ScholarshipMatch[];
}

export interface ScholarshipRow {
  id: string;
  slug: string;
  title: string;
  coverage_type: CoverageType | null;
  last_verified_at: string | null;
  providers: { name: string } | null;
  deadline_cycles: { closes_at: string; opens_at: string | null; status: DeadlineStatus }[];
  eligibility_rules: {
    id: string;
    field: string;
    operator: string;
    value: unknown;
    is_mandatory: boolean;
    human_label: string | null;
  }[];
  requirements: { id: string }[];
}

// Pure: no I/O. Takes the already-fetched, published-scholarship rows and a
// profile, and returns the bucketed, ranked match results. Kept separate from
// lib/actions/match-profile.ts (which does the Supabase fetch) so the row ->
// bucket transformation is unit-testable without mocking supabase-js.
export function buildScholarshipMatches(rows: ScholarshipRow[], profile: Profile): MatchProfileResult {
  const eligibleItems: { match: ScholarshipMatch; rankable: RankableResult }[] = [];
  const nearMissItems: { match: ScholarshipMatch; rankable: RankableResult }[] = [];
  const notEligibleItems: { match: ScholarshipMatch; rankable: RankableResult }[] = [];

  for (const row of rows) {
    const cycle = [...row.deadline_cycles].sort(
      (a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at)
    )[0];
    if (!cycle) continue; // no deadline cycle -- nothing to show or rank against

    const rules: Rule[] = row.eligibility_rules.map((r) => ({
      id: r.id,
      scholarship_id: row.id,
      field: r.field as Rule["field"],
      operator: r.operator as Rule["operator"],
      value: r.value,
      is_mandatory: r.is_mandatory,
      human_label: r.human_label,
    }));

    const result = evaluateScholarship(profile, rules, row.id);
    const coverageType: CoverageType = row.coverage_type ?? "other";

    const match: ScholarshipMatch = {
      scholarshipId: row.id,
      slug: row.slug,
      title: row.title,
      providerName: row.providers?.name ?? "Unknown provider",
      coverageType,
      status: cycle.status,
      closesAt: cycle.closes_at,
      opensAt: cycle.opens_at,
      lastVerifiedAt: row.last_verified_at,
      requirementCount: row.requirements.length,
      whyChips: result.passedReasons.map((r) => r.humanLabel).filter((l): l is string => Boolean(l)),
      gapExplainer: result.bucket === "near_miss" ? (result.failedReasons[0]?.humanLabel ?? null) : null,
    };

    const rankable: RankableResult = { result, closesAt: cycle.closes_at, coverageType };

    if (result.bucket === "eligible") eligibleItems.push({ match, rankable });
    else if (result.bucket === "near_miss") nearMissItems.push({ match, rankable });
    else notEligibleItems.push({ match, rankable });
  }

  function ranked(items: { match: ScholarshipMatch; rankable: RankableResult }[]): ScholarshipMatch[] {
    const byId = new Map(items.map((i) => [i.rankable.result.scholarshipId, i.match]));
    return rank(items.map((i) => i.rankable)).map((r) => byId.get(r.result.scholarshipId)!);
  }

  return {
    eligible: ranked(eligibleItems),
    nearMiss: ranked(nearMissItems),
    notEligible: ranked(notEligibleItems),
  };
}
