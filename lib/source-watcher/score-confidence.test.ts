import { describe, expect, it } from "vitest";
import { confidenceRank, scoreConfidence } from "./score-confidence";
import type { SuggestionProposal } from "@/lib/types/source-watcher";

function proposal(overrides: Partial<SuggestionProposal>): SuggestionProposal {
  return {
    scholarshipId: "sch-1",
    targetTable: "scholarships",
    targetRowId: "sch-1",
    targetField: "summary",
    changeKind: "update_field",
    oldValue: "old",
    newValue: "a new summary",
    citingSectionIds: ["sec-1"],
    ...overrides,
  };
}

describe("scoreConfidence", () => {
  it("is low when the value fails format validation", () => {
    // coverage_type must be one of the enum values.
    const result = scoreConfidence(
      proposal({ targetField: "coverage_type", newValue: "not-a-coverage-type" })
    );
    expect(result.level).toBe("low");
  });

  it("is high for a non-critical field with valid format and a single citation", () => {
    const result = scoreConfidence(proposal({ targetField: "summary", newValue: "clear summary text" }));
    expect(result.level).toBe("high");
  });

  it("is medium for a non-critical field with multiple citations", () => {
    const result = scoreConfidence(
      proposal({ targetField: "summary", newValue: "text", citingSectionIds: ["sec-1", "sec-2"] })
    );
    expect(result.level).toBe("medium");
  });

  it("caps a critical field at medium even when cleanly grounded", () => {
    const result = scoreConfidence(
      proposal({
        targetTable: "deadline_cycles",
        targetRowId: "dc-1",
        targetField: "closes_at",
        newValue: "2026-08-15",
        citingSectionIds: ["sec-1"],
      })
    );
    expect(result.level).toBe("medium");
    expect(result.detail.critical).toBe(true);
  });

  it("drops a critical field to low when citations are ambiguous", () => {
    const result = scoreConfidence(
      proposal({
        targetTable: "deadline_cycles",
        targetRowId: "dc-1",
        targetField: "closes_at",
        newValue: "2026-08-15",
        citingSectionIds: ["sec-1", "sec-2"],
      })
    );
    expect(result.level).toBe("low");
  });

  it("drops a critical field to low when its format is invalid", () => {
    const result = scoreConfidence(
      proposal({
        targetTable: "deadline_cycles",
        targetRowId: "dc-1",
        targetField: "closes_at",
        newValue: "August 15", // not ISO
        citingSectionIds: ["sec-1"],
      })
    );
    expect(result.level).toBe("low");
  });

  it("ranks low before medium before high", () => {
    expect(confidenceRank("low")).toBeLessThan(confidenceRank("medium"));
    expect(confidenceRank("medium")).toBeLessThan(confidenceRank("high"));
  });
});
