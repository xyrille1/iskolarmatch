import { describe, expect, it } from "vitest";
import { scoreCandidate, candidateConfidenceRank } from "./score-candidate";
import type { CandidateDraft } from "@/lib/types/source-discovery";

function draft(overrides: Partial<CandidateDraft> = {}): CandidateDraft {
  return {
    is_scholarship: true,
    title: "Sample Scholarship",
    summary: null,
    coverage_type: "full",
    benefit_summary: null,
    provider_name: null,
    application_url: null,
    deadline_closes_at: "2026-09-30",
    deadline_academic_year: null,
    eligibility_notes: ["GWA of at least 90"],
    requirement_labels: [],
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  it("is high when title, deadline, concrete coverage, and eligibility are all present", () => {
    expect(scoreCandidate(draft())).toBe("high");
  });

  it("is medium with a deadline but no eligibility", () => {
    expect(scoreCandidate(draft({ eligibility_notes: [] }))).toBe("medium");
  });

  it("is medium with coverage but no deadline", () => {
    expect(scoreCandidate(draft({ deadline_closes_at: null, eligibility_notes: [] }))).toBe("medium");
  });

  it("is low with no deadline and vague coverage", () => {
    expect(scoreCandidate(draft({ deadline_closes_at: null, coverage_type: "other", eligibility_notes: [] }))).toBe("low");
  });

  it("is low when the title is blank regardless of other fields", () => {
    expect(scoreCandidate(draft({ title: "   " }))).toBe("low");
  });

  it("ranks worst-first for queue ordering", () => {
    expect(candidateConfidenceRank("low")).toBeLessThan(candidateConfidenceRank("medium"));
    expect(candidateConfidenceRank("medium")).toBeLessThan(candidateConfidenceRank("high"));
  });
});
