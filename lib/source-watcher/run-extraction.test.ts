import { beforeEach, describe, expect, it, vi } from "vitest";

// P1-06: the RAG generation step's control-flow, deterministic + no network.
// Asserts: no changed sections skips the LLM entirely; an LLM error fail-safes
// to [] (never throws, so one bad page can't abort the cron batch); an
// unparseable response fail-safes to []; and a candidate whose only citation
// is ungrounded (references a section we never provided) is dropped.

const { runStructuredExtraction } = vi.hoisted(() => ({ runStructuredExtraction: vi.fn() }));
vi.mock("@/lib/groq/client", () => ({ runStructuredExtraction }));

import { runExtraction } from "./run-extraction";
import type { CitableSection, RecordSnapshot } from "./types";

const RECORD: RecordSnapshot = {
  scholarshipId: "sch-1",
  scholarship: {
    title: "T",
    summary: "S",
    description: "D",
    coverage_type: "partial",
    benefit_summary: "Old benefit",
    official_url: "https://ched.gov.ph/x",
    application_url: null,
  },
  eligibilityRules: [],
  deadlineCycles: [],
  requirements: [],
};

const SECTIONS: CitableSection[] = [{ id: "sec-1", headingLabel: "Benefits", text: "New benefit text" }];

beforeEach(() => vi.clearAllMocks());

describe("runExtraction (LLM boundary)", () => {
  it("skips the LLM entirely when nothing changed", async () => {
    const result = await runExtraction(RECORD, []);
    expect(result).toEqual([]);
    expect(runStructuredExtraction).not.toHaveBeenCalled();
  });

  it("fail-safes to [] when the LLM call throws (never aborts the batch)", async () => {
    runStructuredExtraction.mockRejectedValueOnce(new Error("429 rate limited"));
    await expect(runExtraction(RECORD, SECTIONS)).resolves.toEqual([]);
  });

  it("fail-safes to [] on an unparseable response", async () => {
    runStructuredExtraction.mockResolvedValueOnce("not json {{{");
    await expect(runExtraction(RECORD, SECTIONS)).resolves.toEqual([]);
  });

  it("drops a candidate whose only citation is ungrounded", async () => {
    // Cites 'sec-999', which was never in the provided sections -> after the
    // grounding filter the candidate has no citation and is dropped, so no
    // proposal reaches the diff.
    runStructuredExtraction.mockResolvedValueOnce(
      JSON.stringify({
        candidates: [
          {
            target_table: "scholarships",
            target_field: "benefit_summary",
            target_row_id: "sch-1",
            new_value: "Hallucinated benefit",
            citing_section_ids: ["sec-999"],
            rationale: "",
          },
        ],
      })
    );

    await expect(runExtraction(RECORD, SECTIONS)).resolves.toEqual([]);
  });

  it("keeps a grounded candidate and emits a proposal through the diff", async () => {
    runStructuredExtraction.mockResolvedValueOnce(
      JSON.stringify({
        candidates: [
          {
            target_table: "scholarships",
            target_field: "benefit_summary",
            target_row_id: "sch-1",
            new_value: "New benefit text value",
            citing_section_ids: ["sec-1"],
            rationale: "stated on the page",
          },
        ],
      })
    );

    const result = await runExtraction(RECORD, SECTIONS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      targetField: "benefit_summary",
      newValue: "New benefit text value",
      oldValue: "Old benefit",
      citingSectionIds: ["sec-1"],
    });
  });
});
