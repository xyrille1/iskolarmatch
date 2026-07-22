import { z } from "zod";
import type { ScholarshipRow } from "./build-scholarship-matches";

// Runtime shape-check for the Supabase join that feeds the matcher and the
// weekly digest (docs/QA-CHECKLIST.md P2-08b). These are the highest-risk read
// paths -- they render directly to users -- and were previously trusted via
// `as unknown as ScholarshipRow[]`, so a query/schema drift (a renamed column,
// a dropped nested select) would surface as an undefined-access at render
// rather than a caught error. Validating here turns that into a logged, dropped
// row. Enum-valued fields stay loose (`string`) so this checks structural
// integrity, not business rules -- the matcher already treats an unknown
// coverage/status safely.
const scholarshipRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  coverage_type: z.string().nullable(),
  last_verified_at: z.string().nullable(),
  providers: z.object({ name: z.string() }).nullable(),
  deadline_cycles: z.array(
    z.object({
      closes_at: z.string(),
      opens_at: z.string().nullable(),
      status: z.string(),
    })
  ),
  eligibility_rules: z.array(
    z.object({
      id: z.string(),
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
      is_mandatory: z.boolean(),
      human_label: z.string().nullable(),
      guidance_text: z.string().nullable().optional(),
    })
  ),
  requirements: z.array(z.object({ id: z.string() })),
});

// Validates each row, dropping (and logging) any that fail rather than throwing
// -- one malformed row must not take down the whole match/digest. Returns rows
// typed as ScholarshipRow (the enum fields are re-narrowed by the cast; the
// matcher tolerates unexpected values).
export function parseScholarshipRows(data: unknown, context: string): ScholarshipRow[] {
  const rows = Array.isArray(data) ? data : [];
  const valid: ScholarshipRow[] = [];

  for (const row of rows) {
    const parsed = scholarshipRowSchema.safeParse(row);
    if (parsed.success) {
      valid.push(parsed.data as ScholarshipRow);
    } else {
      const id = (row as { id?: unknown })?.id;
      console.warn(
        `[${context}] dropping a scholarship row that failed shape validation (id=${String(id)}): ${
          parsed.error.issues[0]?.message ?? "unknown issue"
        }`
      );
    }
  }

  return valid;
}
