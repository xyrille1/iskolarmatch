import { describe, expect, it } from "vitest";
import { diffAgainstRecord } from "./diff-against-record";
import type { ExtractionCandidate } from "@/lib/types/source-watcher";
import type { RecordSnapshot } from "./types";

function baseRecord(overrides: Partial<RecordSnapshot> = {}): RecordSnapshot {
  return {
    scholarshipId: "sch-1",
    scholarship: {
      title: "CHED Merit",
      summary: null,
      description: null,
      coverage_type: "partial",
      benefit_summary: "Monthly stipend only",
      official_url: "https://ched.gov.ph/merit",
      application_url: null,
    },
    eligibilityRules: [],
    deadlineCycles: [],
    requirements: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<ExtractionCandidate>): ExtractionCandidate {
  return {
    target_table: "scholarships",
    target_field: "coverage_type",
    target_row_id: null,
    new_value: "full",
    citing_section_ids: ["sec-1"],
    rationale: "",
    ...overrides,
  };
}

describe("diffAgainstRecord", () => {
  it("emits nothing when the extracted value equals the current value", () => {
    const proposals = diffAgainstRecord([candidate({ new_value: "partial" })], baseRecord());
    expect(proposals).toHaveLength(0);
  });

  it("emits an update_field proposal with the correct old_value when the value differs", () => {
    const proposals = diffAgainstRecord([candidate({ new_value: "full" })], baseRecord());
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      targetTable: "scholarships",
      targetField: "coverage_type",
      changeKind: "update_field",
      oldValue: "partial",
      newValue: "full",
      targetRowId: "sch-1",
    });
  });

  it("drops a candidate targeting a field not on the allowlist", () => {
    const proposals = diffAgainstRecord([candidate({ target_field: "is_published" })], baseRecord());
    expect(proposals).toHaveLength(0);
  });

  it("drops an ungrounded candidate (no citation)", () => {
    const proposals = diffAgainstRecord([candidate({ new_value: "full", citing_section_ids: [] })], baseRecord());
    expect(proposals).toHaveLength(0);
  });

  it("treats a numeric string from the page as equal to a number in the DB", () => {
    const record = baseRecord({
      eligibilityRules: [
        { id: "er-1", field: "gwa", operator: "gte", value: 90, is_mandatory: true, human_label: null },
      ],
    });
    const proposals = diffAgainstRecord(
      [candidate({ target_table: "eligibility_rules", target_field: "value", target_row_id: "er-1", new_value: "90" })],
      record
    );
    expect(proposals).toHaveLength(0);
  });

  it("emits a proposal when an eligibility threshold changes", () => {
    const record = baseRecord({
      eligibilityRules: [
        { id: "er-1", field: "gwa", operator: "gte", value: 88, is_mandatory: true, human_label: null },
      ],
    });
    const proposals = diffAgainstRecord(
      [candidate({ target_table: "eligibility_rules", target_field: "value", target_row_id: "er-1", new_value: 90 })],
      record
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ oldValue: 88, newValue: 90, targetRowId: "er-1" });
  });

  it("falls back to the sole child row when no id is given", () => {
    const record = baseRecord({
      deadlineCycles: [
        { id: "dc-1", academic_year: "2025-2026", opens_at: null, closes_at: "2025-08-15", notes: null },
      ],
    });
    const proposals = diffAgainstRecord(
      [candidate({ target_table: "deadline_cycles", target_field: "closes_at", target_row_id: null, new_value: "2026-08-15" })],
      record
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ targetRowId: "dc-1", oldValue: "2025-08-15", newValue: "2026-08-15" });
  });

  it("skips an ambiguous child match (multiple rows, no id) rather than guessing", () => {
    const record = baseRecord({
      deadlineCycles: [
        { id: "dc-1", academic_year: "2025-2026", opens_at: null, closes_at: "2025-08-15", notes: null },
        { id: "dc-2", academic_year: "2024-2025", opens_at: null, closes_at: "2024-08-15", notes: null },
      ],
    });
    const proposals = diffAgainstRecord(
      [candidate({ target_table: "deadline_cycles", target_field: "closes_at", target_row_id: null, new_value: "2026-08-15" })],
      record
    );
    expect(proposals).toHaveLength(0);
  });
});
