// Internal pipeline types for the source-watcher ingestion path. (The
// extraction/suggestion types shared with the DB schema live in
// lib/types/source-watcher.ts.)

export type SourceKind = "html" | "pdf";

// A heading-delimited section produced by the normalizers, before it is
// persisted to source_sections.
export interface NormalizedSection {
  sectionIndex: number;
  headingLabel: string | null;
  text: string;
}

// A section as stored (carries its hash + id for change-gating and citation).
export interface StoredSection {
  id: string;
  sectionIndex: number;
  headingLabel: string | null;
  sectionHash: string;
  sectionText: string;
}

// A changed/added source section paired with the id it will have (or has) in
// source_sections, so the LLM can cite it and diff-against-record can resolve
// the citation back to a real row.
export interface CitableSection {
  id: string;
  headingLabel: string | null;
  text: string;
}

// The live record the extraction is diffed against, loaded fresh before each
// run. Child rows carry their ids so the model can target an existing row
// (update_field) rather than always proposing a new one.
export interface RecordSnapshot {
  scholarshipId: string;
  scholarship: {
    title: string | null;
    summary: string | null;
    description: string | null;
    coverage_type: string | null;
    benefit_summary: string | null;
    official_url: string | null;
    application_url: string | null;
  };
  eligibilityRules: Array<{
    id: string;
    field: string;
    operator: string;
    value: unknown;
    is_mandatory: boolean;
    human_label: string | null;
  }>;
  deadlineCycles: Array<{
    id: string;
    academic_year: string | null;
    opens_at: string | null;
    closes_at: string | null;
    notes: string | null;
  }>;
  requirements: Array<{
    id: string;
    label: string;
    is_mandatory: boolean;
    sort_order: number;
  }>;
}
