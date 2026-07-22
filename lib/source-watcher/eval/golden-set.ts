import type { CitableSection, RecordSnapshot } from "../types";

// Golden set for the extraction eval (docs plan §3 / draft §5.8). Each case is
// a realistic before/after snapshot with the diffs a correct run should
// produce. Deliberately DISTINCT from the few-shot examples in the system
// prompt so the eval measures generalization, not memorization.
//
// `expected` lists the (table, field, value) triples the pipeline should emit.
// run-eval.ts compares the pipeline's proposals against these to report
// precision/recall. This file has no LLM dependency, so it is safe to import
// anywhere; only run-eval.ts makes real Groq calls.

export interface GoldenCase {
  name: string;
  record: RecordSnapshot;
  changedSections: CitableSection[];
  expected: Array<{ table: string; field: string; value: string | number | boolean }>;
}

function record(overrides: Partial<RecordSnapshot>): RecordSnapshot {
  return {
    scholarshipId: "sch-eval",
    scholarship: {
      title: "Sample Scholarship",
      summary: null,
      description: null,
      coverage_type: "partial",
      benefit_summary: null,
      official_url: "https://ched.gov.ph/sample",
      application_url: null,
    },
    eligibilityRules: [],
    deadlineCycles: [],
    requirements: [],
    ...overrides,
  };
}

export const GOLDEN_SET: GoldenCase[] = [
  {
    name: "deadline moved to a new academic year",
    record: record({
      deadlineCycles: [
        { id: "dc-1", academic_year: "2025-2026", opens_at: "2025-05-01", closes_at: "2025-07-31", notes: null },
      ],
    }),
    changedSections: [
      {
        id: "sec-1",
        headingLabel: "Schedule of Application",
        text: "Applications for AY 2026-2027 will be accepted until July 31, 2027.",
      },
    ],
    // The section states BOTH a new academic year and a new closing date, and
    // both differ from the record -- so both are correct extractions (the
    // few-shot in fixtures/few-shot-examples.ts deliberately teaches emitting
    // academic_year alongside closes_at for deadline sections). The original
    // expected list omitted academic_year; that was an under-specification, not
    // a rule that the watcher should ignore a real structured change.
    expected: [
      { table: "deadline_cycles", field: "closes_at", value: "2027-07-31" },
      { table: "deadline_cycles", field: "academic_year", value: "2026-2027" },
    ],
  },
  {
    name: "coverage upgraded from partial to full",
    record: record({ scholarship: { ...record({}).scholarship, coverage_type: "partial" } }),
    changedSections: [
      {
        id: "sec-1",
        headingLabel: "Scholarship Benefits",
        text: "Scholars are entitled to full free tuition and other school fees for the entire duration of the program.",
      },
    ],
    expected: [{ table: "scholarships", field: "coverage_type", value: "full" }],
  },
  {
    name: "GWA requirement raised",
    record: record({
      eligibilityRules: [
        { id: "er-1", field: "gwa", operator: "gte", value: 85, is_mandatory: true, human_label: "GWA of at least 85%" },
      ],
    }),
    changedSections: [
      {
        id: "sec-1",
        headingLabel: "Qualifications",
        text: "Applicants must have a general weighted average of at least 88% in the previous academic year.",
      },
    ],
    expected: [{ table: "eligibility_rules", field: "value", value: 88 }],
  },
  {
    name: "no real change (cosmetic rewording only)",
    record: record({ scholarship: { ...record({}).scholarship, coverage_type: "full" } }),
    changedSections: [
      {
        id: "sec-1",
        headingLabel: "Benefits",
        text: "The program provides FULL tuition coverage to all qualified scholars.",
      },
    ],
    expected: [],
  },
];
