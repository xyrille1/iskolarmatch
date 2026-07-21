import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/types/profile";
import { buildScholarshipMatches, type ScholarshipRow } from "./build-scholarship-matches";

function makeRow(overrides: Partial<ScholarshipRow> & Pick<ScholarshipRow, "id" | "slug" | "title">): ScholarshipRow {
  return {
    coverage_type: "full",
    last_verified_at: "2026-07-01T00:00:00Z",
    providers: { name: "Test Provider" },
    deadline_cycles: [{ closes_at: "2026-09-01", opens_at: "2026-06-01", status: "open" }],
    eligibility_rules: [],
    requirements: [{ id: "req-1" }],
    ...overrides,
  };
}

describe("buildScholarshipMatches", () => {
  it("buckets a scholarship as eligible when all mandatory rules pass", () => {
    const profile: Profile = { education_level: "college", gwa: 90 };
    const rows: ScholarshipRow[] = [
      makeRow({
        id: "s1",
        slug: "s1",
        title: "Scholarship One",
        eligibility_rules: [
          { id: "r1", field: "education_level", operator: "in", value: ["college"], is_mandatory: true, human_label: "College" },
          { id: "r2", field: "gwa", operator: "gte", value: 85, is_mandatory: true, human_label: "GWA 85+" },
        ],
      }),
    ];

    const result = buildScholarshipMatches(rows, profile);

    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0].scholarshipId).toBe("s1");
    expect(result.eligible[0].providerName).toBe("Test Provider");
    expect(result.eligible[0].requirementCount).toBe(1);
    expect(result.eligible[0].whyChips).toEqual(["College", "GWA 85+"]);
    expect(result.nearMiss).toHaveLength(0);
    expect(result.notEligible).toHaveLength(0);
  });

  it("buckets a scholarship as near_miss and sets gapExplainer to the failed rule's label", () => {
    const profile: Profile = { education_level: "college", gwa: 80 };
    const rows: ScholarshipRow[] = [
      makeRow({
        id: "s1",
        slug: "s1",
        title: "Scholarship One",
        eligibility_rules: [
          { id: "r1", field: "education_level", operator: "in", value: ["college"], is_mandatory: true, human_label: "College" },
          { id: "r2", field: "gwa", operator: "gte", value: 85, is_mandatory: true, human_label: "GWA 85+" },
        ],
      }),
    ];

    const result = buildScholarshipMatches(rows, profile);

    expect(result.nearMiss).toHaveLength(1);
    expect(result.nearMiss[0].gapExplainer).toBe("GWA 85+");
  });

  it("surfaces the failed rule's guidance_text as guidance on a near-miss result (FR14)", () => {
    const profile: Profile = { education_level: "college", gwa: 80 };
    const rows: ScholarshipRow[] = [
      makeRow({
        id: "s1",
        slug: "s1",
        title: "Scholarship One",
        eligibility_rules: [
          {
            id: "r1",
            field: "gwa",
            operator: "gte",
            value: 85,
            is_mandatory: true,
            human_label: "GWA 85+",
            guidance_text: "Retake units to raise your GWA before the next cycle.",
          },
        ],
      }),
    ];

    const result = buildScholarshipMatches(rows, profile);

    expect(result.nearMiss[0].guidance).toBe("Retake units to raise your GWA before the next cycle.");
  });

  it("populates failedChips with every failed mandatory rule's label on a not-eligible result (FR15)", () => {
    const profile: Profile = { education_level: "shs", gwa: 60 };
    const rows: ScholarshipRow[] = [
      makeRow({
        id: "s1",
        slug: "s1",
        title: "Scholarship One",
        eligibility_rules: [
          { id: "r1", field: "education_level", operator: "in", value: ["college"], is_mandatory: true, human_label: "College" },
          { id: "r2", field: "gwa", operator: "gte", value: 85, is_mandatory: true, human_label: "GWA 85+" },
        ],
      }),
    ];

    const result = buildScholarshipMatches(rows, profile);

    expect(result.notEligible).toHaveLength(1);
    expect(result.notEligible[0].failedChips).toEqual(["College", "GWA 85+"]);
    expect(result.notEligible[0].guidance).toBeNull();
  });

  it("leaves failedChips empty for an eligible result", () => {
    const profile: Profile = { education_level: "college", gwa: 90 };
    const rows: ScholarshipRow[] = [
      makeRow({
        id: "s1",
        slug: "s1",
        title: "Scholarship One",
        eligibility_rules: [
          { id: "r1", field: "education_level", operator: "in", value: ["college"], is_mandatory: true, human_label: "College" },
        ],
      }),
    ];

    const result = buildScholarshipMatches(rows, profile);

    expect(result.eligible[0].failedChips).toEqual([]);
  });

  it("skips a scholarship with no deadline cycle", () => {
    const rows: ScholarshipRow[] = [makeRow({ id: "s1", slug: "s1", title: "No Cycle", deadline_cycles: [] })];

    const result = buildScholarshipMatches(rows, {});

    expect(result.eligible).toHaveLength(0);
    expect(result.nearMiss).toHaveLength(0);
    expect(result.notEligible).toHaveLength(0);
  });

  it("ranks eligible results by closes_at ascending across scholarships", () => {
    const rows: ScholarshipRow[] = [
      makeRow({
        id: "later",
        slug: "later",
        title: "Later",
        deadline_cycles: [{ closes_at: "2026-12-01", opens_at: null, status: "open" }],
      }),
      makeRow({
        id: "sooner",
        slug: "sooner",
        title: "Sooner",
        deadline_cycles: [{ closes_at: "2026-08-01", opens_at: null, status: "open" }],
      }),
    ];

    const result = buildScholarshipMatches(rows, {});

    expect(result.eligible.map((m) => m.scholarshipId)).toEqual(["sooner", "later"]);
  });

  it("falls back to the provider name placeholder when providers is null", () => {
    const rows: ScholarshipRow[] = [makeRow({ id: "s1", slug: "s1", title: "Orphan", providers: null })];

    const result = buildScholarshipMatches(rows, {});

    expect(result.eligible[0].providerName).toBe("Unknown provider");
  });
});
