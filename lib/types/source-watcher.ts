import { z } from "zod";

// Shared extraction/suggestion types for the FR10 source-watcher. This is the
// TS source of truth for ALLOWED_FIELDS_BY_TABLE; the DB CHECK in
// supabase/migrations/20260101000012_source_watcher.sql mirrors it (kept in
// sync manually, same pattern as eligibility_rules_field_check).

export const TARGET_TABLES = ["scholarships", "eligibility_rules", "deadline_cycles", "requirements"] as const;
export type TargetTable = (typeof TARGET_TABLES)[number];

// Fields the watcher is allowed to propose changes to. Deliberately excludes
// curator-authored fields (e.g. eligibility_rules.guidance_text, FR14) -- the
// watcher never touches human-authored guidance.
export const ALLOWED_FIELDS_BY_TABLE: Record<TargetTable, readonly string[]> = {
  scholarships: ["title", "summary", "description", "coverage_type", "benefit_summary", "official_url", "application_url"],
  eligibility_rules: ["field", "operator", "value", "is_mandatory", "human_label"],
  // 'notes' is intentionally omitted: it has no field in deadlineCycleInputSchema,
  // so approval would have nothing to route it through. Keep this list == the
  // set of fields the validated admin update actions accept.
  deadline_cycles: ["academic_year", "opens_at", "closes_at"],
  requirements: ["label", "is_mandatory", "sort_order"],
} as const;

export const CHANGE_KINDS = ["update_field", "add_row", "remove_row"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Fields whose changes always get extra scrutiny (docs plan §4 / draft §5.5):
// a change to any of these is treated as critical when scoring confidence.
export const CRITICAL_FIELDS: ReadonlySet<string> = new Set([
  "deadline_cycles.opens_at",
  "deadline_cycles.closes_at",
  "eligibility_rules.field",
  "eligibility_rules.operator",
  "eligibility_rules.value",
  "scholarships.coverage_type",
  "scholarships.benefit_summary",
  "scholarships.official_url",
]);

export function isCriticalField(table: TargetTable, field: string): boolean {
  return CRITICAL_FIELDS.has(`${table}.${field}`);
}

// ---- LLM extraction contract -------------------------------------------------
// What the LLM is allowed to emit. Critically, it reports only what the page
// CURRENTLY says (target_table/field, new_value, citations) -- it never emits
// old_value. Our deterministic diff (lib/source-watcher/diff-against-record.ts)
// supplies old_value from the live DB record, so "deterministically diffs
// against the live record" stays literally true.

export const extractionCandidateSchema = z
  .object({
    target_table: z.enum(TARGET_TABLES),
    target_field: z.string().min(1),
    // Present when the candidate refers to an existing child row the model was
    // shown (by id in the prompt); null/absent for a brand-new proposed row.
    target_row_id: z.string().nullable().optional(),
    new_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    // ids of the source sections this value was read from (grounding citation).
    citing_section_ids: z.array(z.string()).default([]),
    rationale: z.string().default(""),
  })
  .strict();

export const extractionResponseSchema = z
  .object({
    candidates: z.array(extractionCandidateSchema),
  })
  .strict();

export type ExtractionCandidate = z.infer<typeof extractionCandidateSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

// The JSON Schema handed to Groq's Structured Outputs (strict mode). Mirrors
// extractionResponseSchema; kept as a literal because Groq needs raw JSON
// Schema, not a Zod object.
export const EXTRACTION_JSON_SCHEMA = {
  name: "scholarship_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["target_table", "target_field", "target_row_id", "new_value", "citing_section_ids", "rationale"],
          properties: {
            target_table: { type: "string", enum: [...TARGET_TABLES] },
            target_field: { type: "string" },
            target_row_id: { type: ["string", "null"] },
            new_value: { type: ["string", "number", "boolean", "null"] },
            citing_section_ids: { type: "array", items: { type: "string" } },
            rationale: { type: "string" },
          },
        },
      },
    },
  },
} as const;

// ---- Post-diff proposal (what gets written to scholarship_suggestions) --------
// Produced by diff-against-record.ts after comparing candidates to the live
// record. old_value is now filled in from the DB, and change_kind is resolved.
export interface SuggestionProposal {
  scholarshipId: string;
  targetTable: TargetTable;
  targetRowId: string | null;
  targetField: string;
  changeKind: ChangeKind;
  oldValue: unknown;
  newValue: unknown;
  citingSectionIds: string[];
}
