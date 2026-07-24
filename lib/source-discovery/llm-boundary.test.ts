import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedSection } from "@/lib/source-watcher/types";
import type { Anchor } from "./extract-anchors";

// P1-06: the two FR22 LLM steps' control-flow, deterministic + no network.
// Asserts fail-safe returns (null / []), the model's own is_scholarship guard,
// and that link selection can never introduce a URL we didn't provide
// (grounding by index: out-of-range indexes dropped, results deduped).

const { runStructuredExtraction } = vi.hoisted(() => ({ runStructuredExtraction: vi.fn() }));
vi.mock("@/lib/groq/client", () => ({ runStructuredExtraction }));

import { extractCandidate } from "./extract-candidate";
import { selectScholarshipLinks } from "./select-listing";

const SECTIONS: NormalizedSection[] = [{ sectionIndex: 0, headingLabel: "About", text: "A CHED scholarship." }];

function draft(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    is_scholarship: true,
    title: "CHED Merit",
    summary: null,
    coverage_type: "full",
    benefit_summary: null,
    provider_name: null,
    application_url: null,
    deadline_closes_at: null,
    deadline_academic_year: null,
    eligibility_notes: [],
    requirement_labels: [],
    ...overrides,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("extractCandidate (LLM boundary)", () => {
  it("returns null for empty sections without calling the LLM", async () => {
    await expect(extractCandidate([], "https://ched.gov.ph/x")).resolves.toBeNull();
    expect(runStructuredExtraction).not.toHaveBeenCalled();
  });

  it("fail-safes to null when the LLM throws", async () => {
    runStructuredExtraction.mockRejectedValueOnce(new Error("boom"));
    await expect(extractCandidate(SECTIONS, "https://ched.gov.ph/x")).resolves.toBeNull();
  });

  it("fail-safes to null on an unparseable response", async () => {
    runStructuredExtraction.mockResolvedValueOnce("<<not json>>");
    await expect(extractCandidate(SECTIONS, "https://ched.gov.ph/x")).resolves.toBeNull();
  });

  it("skips a page the model flags as not-a-scholarship", async () => {
    runStructuredExtraction.mockResolvedValueOnce(draft({ is_scholarship: false }));
    await expect(extractCandidate(SECTIONS, "https://ched.gov.ph/x")).resolves.toBeNull();
  });

  it("returns a usable draft on the happy path", async () => {
    runStructuredExtraction.mockResolvedValueOnce(draft());
    const result = await extractCandidate(SECTIONS, "https://ched.gov.ph/x");
    expect(result?.title).toBe("CHED Merit");
  });
});

describe("selectScholarshipLinks (LLM boundary, grounded by index)", () => {
  const anchors: Anchor[] = [
    { href: "https://ched.gov.ph/a", text: "Scholarship A" },
    { href: "https://ched.gov.ph/b", text: "Scholarship B" },
    { href: "https://ched.gov.ph/c", text: "News" },
  ];

  it("returns [] for no anchors without calling the LLM", async () => {
    await expect(selectScholarshipLinks([])).resolves.toEqual([]);
    expect(runStructuredExtraction).not.toHaveBeenCalled();
  });

  it("fail-safes to [] when the LLM throws", async () => {
    runStructuredExtraction.mockRejectedValueOnce(new Error("boom"));
    await expect(selectScholarshipLinks(anchors)).resolves.toEqual([]);
  });

  it("resolves only in-range indexes back to the provided anchors", async () => {
    // Index 99 is out of range (the model can't invent a URL); duplicates collapse.
    runStructuredExtraction.mockResolvedValueOnce(JSON.stringify({ scholarship_link_indexes: [0, 1, 1, 99] }));
    const result = await selectScholarshipLinks(anchors);
    expect(result.map((a) => a.href)).toEqual(["https://ched.gov.ph/a", "https://ched.gov.ph/b"]);
  });
});
