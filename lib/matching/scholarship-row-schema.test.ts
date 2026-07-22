import { afterEach, describe, expect, it, vi } from "vitest";
import { parseScholarshipRows } from "./scholarship-row-schema";

// P2-08b: the match/digest read-path shape guard drops (and logs) rows that
// don't match the expected join shape, so a schema drift is a caught error
// rather than an undefined-access at render.

const validRow = {
  id: "s1",
  slug: "ched-merit",
  title: "CHED Merit",
  coverage_type: "partial",
  last_verified_at: "2026-01-01T00:00:00.000Z",
  providers: { name: "CHED" },
  deadline_cycles: [{ closes_at: "2026-09-15", opens_at: null, status: "open" }],
  eligibility_rules: [
    { id: "r1", field: "gwa", operator: "gte", value: 85, is_mandatory: true, human_label: "GWA >= 85" },
  ],
  requirements: [{ id: "req1" }],
};

afterEach(() => vi.restoreAllMocks());

describe("parseScholarshipRows", () => {
  it("passes through a well-formed row", () => {
    const result = parseScholarshipRows([validRow], "test");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("drops (and logs) a row missing a required nested array", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // deadline_cycles omitted -> would be an undefined-access at render.
    const { deadline_cycles: _omit, ...broken } = validRow;
    const result = parseScholarshipRows([broken], "test");
    expect(result).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("keeps valid rows and drops invalid ones in a mixed batch", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseScholarshipRows([validRow, { id: "bad" }, validRow], "test");
    expect(result).toHaveLength(2);
  });

  it("returns [] for a non-array input", () => {
    expect(parseScholarshipRows(null, "test")).toEqual([]);
    expect(parseScholarshipRows(undefined, "test")).toEqual([]);
  });
});
