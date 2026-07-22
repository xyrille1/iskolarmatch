import { ALLOWED_FIELDS_BY_TABLE } from "@/lib/types/source-watcher";
import type { CitableSection, RecordSnapshot } from "./types";
import { FEW_SHOT_EXAMPLES } from "./fixtures/few-shot-examples";

// Builds the RAG-grounded extraction prompt. "Retrieval" here is the
// deterministic change-gate's output: the CHANGED source sections are the
// retrieved evidence, and the LLM must cite the section id each value came
// from. The current record is included so the model reports the page's current
// truth for exactly the fields we track -- our diff step, not the model,
// decides what actually changed.

function fieldAllowlistBlock(): string {
  return (Object.keys(ALLOWED_FIELDS_BY_TABLE) as Array<keyof typeof ALLOWED_FIELDS_BY_TABLE>)
    .map((table) => `- ${table}: ${ALLOWED_FIELDS_BY_TABLE[table].join(", ")}`)
    .join("\n");
}

export function buildSystemPrompt(): string {
  const fewShot = FEW_SHOT_EXAMPLES.map(
    (ex, i) =>
      [
        `EXAMPLE ${i + 1}`,
        "Changed sections:",
        ex.sectionsBlock,
        "Current record:",
        ex.currentRecordBlock,
        "Correct output:",
        ex.expectedJson,
      ].join("\n")
  ).join("\n\n");

  return [
    "You extract structured scholarship facts from official Philippine government scholarship pages (CHED, DOST-SEI, LGUs, state universities).",
    "You are given (a) the CHANGED sections of an official source page and (b) the current database record for that scholarship.",
    "",
    "Your job: report what the CHANGED sections currently say for ONLY these fields, and nothing else:",
    fieldAllowlistBlock(),
    "",
    "Hard rules:",
    "- Report a candidate ONLY when a changed section states a concrete value for one of the allowed fields above. Never invent, infer beyond the text, or guess.",
    "- Every candidate MUST cite the id(s) of the section(s) it was read from in citing_section_ids. A candidate with no citation is invalid.",
    "- Do NOT decide whether the value differs from the database -- always report the page's current value; a separate deterministic step does the diffing.",
    "- When a value refers to an existing row shown in the current record, set target_row_id to that row's id. For a genuinely new item not present in the record, set target_row_id to null.",
    "- Dates must be ISO (YYYY-MM-DD). GWA/numeric thresholds as numbers. Booleans as true/false.",
    "- Never propose changes to any field not in the allowlist (e.g. curator-authored guidance text).",
    "- Prefer the most specific STRUCTURED field. Do not ALSO emit a free-text field (summary, benefit_summary, description) that merely restates a fact already captured by a structured field. Example: if a section says \"full free tuition\", emit coverage_type=full and do NOT additionally emit benefit_summary just to paraphrase that same fact.",
    "- Emit a free-text field (summary, benefit_summary, description) only when it adds substantive detail the structured fields cannot capture -- e.g. a benefits section enumerating several distinct benefits (tuition AND a monthly stipend AND a book allowance).",
    "- Emit at most one candidate per (target_table, target_field, target_row_id). Do not repeat a field.",
    "",
    "Respond ONLY with JSON matching the provided schema.",
    "",
    fewShot,
  ].join("\n");
}

function formatRecord(record: RecordSnapshot): string {
  const s = record.scholarship;
  const lines: string[] = [
    "scholarships:",
    `  title: ${s.title ?? "(none)"}`,
    `  summary: ${s.summary ?? "(none)"}`,
    `  coverage_type: ${s.coverage_type ?? "(none)"}`,
    `  benefit_summary: ${s.benefit_summary ?? "(none)"}`,
    `  official_url: ${s.official_url ?? "(none)"}`,
    `  application_url: ${s.application_url ?? "(none)"}`,
  ];

  if (record.eligibilityRules.length > 0) {
    lines.push("eligibility_rules:");
    for (const r of record.eligibilityRules) {
      lines.push(
        `  - id: ${r.id} | field: ${r.field} | operator: ${r.operator} | value: ${JSON.stringify(r.value)} | mandatory: ${r.is_mandatory} | label: ${r.human_label ?? "(none)"}`
      );
    }
  }
  if (record.deadlineCycles.length > 0) {
    lines.push("deadline_cycles:");
    for (const d of record.deadlineCycles) {
      lines.push(
        `  - id: ${d.id} | academic_year: ${d.academic_year ?? "(none)"} | opens_at: ${d.opens_at ?? "(none)"} | closes_at: ${d.closes_at ?? "(none)"} | notes: ${d.notes ?? "(none)"}`
      );
    }
  }
  if (record.requirements.length > 0) {
    lines.push("requirements:");
    for (const req of record.requirements) {
      lines.push(`  - id: ${req.id} | label: ${req.label} | mandatory: ${req.is_mandatory} | sort_order: ${req.sort_order}`);
    }
  }

  return lines.join("\n");
}

function formatSections(sections: CitableSection[]): string {
  return sections
    .map((sec) => `[section id=${sec.id} | heading: ${sec.headingLabel ?? "(none)"}]\n${sec.text}`)
    .join("\n\n");
}

export function buildUserPrompt(record: RecordSnapshot, changedSections: CitableSection[]): string {
  return [
    "CHANGED SECTIONS (the only evidence you may cite):",
    formatSections(changedSections),
    "",
    "CURRENT DATABASE RECORD:",
    formatRecord(record),
    "",
    "Extract candidates now.",
  ].join("\n");
}
