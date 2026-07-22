// Few-shot grounding for the extraction prompt. Open-weight models (the Groq
// free-tier line) lean on examples more than frontier models, so this is where
// extraction quality is actually won (docs plan §3). Each example is a
// realistic CHED/DOST-SEI-style source snippet paired with the exact JSON the
// model should emit. Kept as data (not inlined in the prompt string) so they
// can be reviewed and extended independently.

export interface FewShotExample {
  sectionsBlock: string;
  currentRecordBlock: string;
  expectedJson: string;
}

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    sectionsBlock: [
      "[section id=sec-a1 | heading: Application Period]",
      "Applications for the CHED Merit Scholarship Program AY 2026-2027 are open from June 1, 2026 until August 15, 2026. Late submissions will not be entertained.",
    ].join("\n"),
    currentRecordBlock: [
      "deadline_cycles:",
      "  - id: dc-1 | academic_year: 2025-2026 | opens_at: 2025-06-01 | closes_at: 2025-08-15",
    ].join("\n"),
    expectedJson: JSON.stringify({
      candidates: [
        {
          target_table: "deadline_cycles",
          target_field: "closes_at",
          target_row_id: "dc-1",
          new_value: "2026-08-15",
          citing_section_ids: ["sec-a1"],
          rationale: "Application period section states applications close August 15, 2026.",
        },
        {
          target_table: "deadline_cycles",
          target_field: "academic_year",
          target_row_id: "dc-1",
          new_value: "2026-2027",
          citing_section_ids: ["sec-a1"],
          rationale: "Section names AY 2026-2027.",
        },
      ],
    }),
  },
  {
    sectionsBlock: [
      "[section id=sec-b2 | heading: Benefits]",
      "Qualified DOST-SEI scholars receive full tuition and school fees, a monthly living allowance, and a book allowance each semester.",
    ].join("\n"),
    currentRecordBlock: [
      "scholarships:",
      "  coverage_type: partial",
      "  benefit_summary: Monthly stipend only",
    ].join("\n"),
    expectedJson: JSON.stringify({
      candidates: [
        {
          target_table: "scholarships",
          target_field: "coverage_type",
          target_row_id: null,
          new_value: "full",
          citing_section_ids: ["sec-b2"],
          rationale: "Benefits section states full tuition and school fees are covered.",
        },
        {
          target_table: "scholarships",
          target_field: "benefit_summary",
          target_row_id: null,
          new_value: "Full tuition and school fees, monthly living allowance, and a book allowance per semester.",
          citing_section_ids: ["sec-b2"],
          rationale: "Benefits section enumerates the coverage.",
        },
      ],
    }),
  },
  {
    sectionsBlock: [
      "[section id=sec-c3 | heading: Eligibility]",
      "Open to incoming college freshmen who are Filipino citizens with a general weighted average of at least 90% in senior high school.",
    ].join("\n"),
    currentRecordBlock: [
      "eligibility_rules:",
      "  - id: er-1 | field: gwa | operator: gte | value: 88 | mandatory: true",
    ].join("\n"),
    expectedJson: JSON.stringify({
      candidates: [
        {
          target_table: "eligibility_rules",
          target_field: "value",
          target_row_id: "er-1",
          new_value: 90,
          citing_section_ids: ["sec-c3"],
          rationale: "Eligibility section requires a GWA of at least 90%.",
        },
      ],
    }),
  },
];
