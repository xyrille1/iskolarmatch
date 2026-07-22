import type { TargetTable } from "@/lib/types/source-watcher";

// Per-field format validators for confidence scoring. Deliberately independent
// of the big admin Zod schemas (several are ZodEffects from .refine() and are
// awkward to introspect per single field). A value that fails its format check
// is a strong "low confidence" signal -- the model probably misread the page.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COVERAGE_TYPES = new Set(["full", "partial", "allowance", "other"]);
const OPERATORS = new Set(["gte", "lte", "eq", "neq", "in", "includes", "is_true", "is_false"]);

type Validator = (value: unknown) => boolean;

const isNonEmptyString: Validator = (v) => typeof v === "string" && v.trim().length > 0;
const isBoolean: Validator = (v) => typeof v === "boolean";
const isIsoDate: Validator = (v) => typeof v === "string" && ISO_DATE.test(v.trim());
const isNumberLike: Validator = (v) =>
  typeof v === "number" ? !Number.isNaN(v) : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v));

const VALIDATORS: Record<TargetTable, Record<string, Validator>> = {
  scholarships: {
    title: isNonEmptyString,
    summary: isNonEmptyString,
    description: isNonEmptyString,
    coverage_type: (v) => typeof v === "string" && COVERAGE_TYPES.has(v.trim().toLowerCase()),
    benefit_summary: isNonEmptyString,
    official_url: (v) => typeof v === "string" && /^https:\/\//.test(v.trim()),
    application_url: (v) => typeof v === "string" && /^https:\/\//.test(v.trim()),
  },
  eligibility_rules: {
    field: isNonEmptyString,
    operator: (v) => typeof v === "string" && OPERATORS.has(v.trim()),
    value: (v) => v !== null && v !== undefined,
    is_mandatory: isBoolean,
    human_label: isNonEmptyString,
  },
  deadline_cycles: {
    academic_year: isNonEmptyString,
    opens_at: isIsoDate,
    closes_at: isIsoDate,
    notes: isNonEmptyString,
  },
  requirements: {
    label: isNonEmptyString,
    is_mandatory: isBoolean,
    sort_order: isNumberLike,
  },
};

// Returns true when the value passes its field's format check. Unknown
// table/field combinations are treated as invalid (fail closed) -- they should
// have been filtered by the allowlist upstream.
export function isValidFieldFormat(table: TargetTable, field: string, value: unknown): boolean {
  const validator = VALIDATORS[table]?.[field];
  if (!validator) return false;
  return validator(value);
}
