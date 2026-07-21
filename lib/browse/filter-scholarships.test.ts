import { describe, expect, it } from "vitest";
import type { BrowseScholarshipItem } from "@/lib/data/get-published-scholarships";
import { filterScholarships } from "./filter-scholarships";

function item(overrides: Partial<BrowseScholarshipItem> & Pick<BrowseScholarshipItem, "id" | "title">): BrowseScholarshipItem {
  return {
    slug: overrides.id,
    summary: null,
    providerName: "Test Provider",
    providerType: "government",
    coverageType: "full",
    status: "open",
    closesAt: "2026-09-01",
    opensAt: null,
    regions: [],
    ...overrides,
  };
}

describe("filterScholarships", () => {
  const items: BrowseScholarshipItem[] = [
    item({ id: "a", title: "CHED Merit", coverageType: "full", providerType: "government", regions: ["Region I"] }),
    item({ id: "b", title: "DOST-SEI Undergrad", coverageType: "allowance", providerType: "government", regions: [] }),
    item({ id: "c", title: "Foundation Grant", coverageType: "partial", providerType: "private", regions: ["NCR"] }),
  ];

  it("returns everything when no filters are set", () => {
    expect(filterScholarships(items, {})).toHaveLength(3);
  });

  it("filters by coverage type", () => {
    const result = filterScholarships(items, { coverageType: "full" });
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters by provider type", () => {
    const result = filterScholarships(items, { providerType: "private" });
    expect(result.map((i) => i.id)).toEqual(["c"]);
  });

  it("includes region-agnostic scholarships in every region filter", () => {
    const result = filterScholarships(items, { region: "Region I" });
    // "a" has Region I explicitly, "b" has no region rule (open to all).
    expect(result.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes a scholarship whose region list doesn't include the filter", () => {
    const result = filterScholarships(items, { region: "NCR" });
    expect(result.map((i) => i.id).sort()).toEqual(["b", "c"]);
  });

  it("matches keyword search case-insensitively against the title", () => {
    const result = filterScholarships(items, { q: "dost" });
    expect(result.map((i) => i.id)).toEqual(["b"]);
  });

  it("combines multiple filters (AND semantics)", () => {
    const result = filterScholarships(items, { providerType: "government", coverageType: "allowance" });
    expect(result.map((i) => i.id)).toEqual(["b"]);
  });

  it("ignores a blank keyword search", () => {
    expect(filterScholarships(items, { q: "   " })).toHaveLength(3);
  });
});
