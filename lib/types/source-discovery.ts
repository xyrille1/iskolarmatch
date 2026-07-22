import { z } from "zod";
import { isAllowlistedUrl } from "@/lib/security/url-allowlist";

// Shared types + LLM contracts for the FR22 discovery pipeline (docs/PRD.md
// §4.7). Two LLM steps, each with a strict-JSON-Schema contract mirrored by a
// Zod schema (same discipline as lib/types/source-watcher.ts): the model output
// is always Zod-validated, never trusted blindly.

export const COVERAGE_TYPES = ["full", "partial", "allowance", "other"] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

export const CANDIDATE_CONFIDENCE = ["high", "medium", "low"] as const;
export type CandidateConfidence = (typeof CANDIDATE_CONFIDENCE)[number];

// ---- Curator input: registering an index page -------------------------------
// Allowlist-refined at the app layer (defense-in-depth with the DB trigger in
// migration ...014), so the curator gets a clear error, not a raw constraint
// violation -- the same pattern as scholarshipUpsertSchema (lib/types/admin.ts).
export const sourceIndexPageInputSchema = z
  .object({
    provider_id: z.string().optional().or(z.literal("")),
    index_url: z
      .string()
      .url()
      .refine((v) => isAllowlistedUrl(v), "index_url must be on *.gov.ph, *.edu.ph, or the curated allowlist."),
    label: z.string().optional(),
  })
  .strict();

export type SourceIndexPageInput = z.infer<typeof sourceIndexPageInputSchema>;

// ---- LLM step 1: select which anchors are scholarship detail links ----------
// The crawler extracts real <a href> anchors from the index page DOM
// deterministically (Readability drops href attributes, so we can't rely on it
// here) and hands the model a NUMBERED list. The model returns only indexes
// into that list -- so it can never invent a URL; we resolve indexes back to the
// hrefs we actually provided. Grounding by construction.
export const linkSelectionSchema = z
  .object({
    scholarship_link_indexes: z.array(z.number().int().nonnegative()),
  })
  .strict();

export type LinkSelection = z.infer<typeof linkSelectionSchema>;

export const LINK_SELECTION_JSON_SCHEMA = {
  name: "scholarship_link_selection",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["scholarship_link_indexes"],
    properties: {
      scholarship_link_indexes: {
        type: "array",
        items: { type: "integer" },
      },
    },
  },
} as const;

// ---- LLM step 2: extract a draft scholarship from a detail page -------------
// Facts only (deadline/coverage/benefit/eligibility notes). The model never
// authors the official_url -- that is the page we fetched (allowlist-guaranteed).
// Eligibility and requirements are captured as plain-text hints, NOT structured
// rules: the strict field/operator vocabulary lives in the admin editor, and a
// curator transcribes these into real rules at promotion. Keeping the model out
// of the rule vocabulary avoids it guessing enum values it can't verify.
export const candidateDraftSchema = z
  .object({
    // The model's own guard: false if the page isn't actually a scholarship
    // (a category/nav page slipped through). We skip those.
    is_scholarship: z.boolean(),
    title: z.string(),
    summary: z.string().nullable(),
    coverage_type: z.enum(COVERAGE_TYPES),
    benefit_summary: z.string().nullable(),
    provider_name: z.string().nullable(),
    application_url: z.string().nullable(),
    deadline_closes_at: z.string().nullable(), // ISO date (YYYY-MM-DD)
    deadline_academic_year: z.string().nullable(),
    eligibility_notes: z.array(z.string()),
    requirement_labels: z.array(z.string()),
  })
  .strict();

export type CandidateDraft = z.infer<typeof candidateDraftSchema>;

export const CANDIDATE_DRAFT_JSON_SCHEMA = {
  name: "scholarship_candidate",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "is_scholarship",
      "title",
      "summary",
      "coverage_type",
      "benefit_summary",
      "provider_name",
      "application_url",
      "deadline_closes_at",
      "deadline_academic_year",
      "eligibility_notes",
      "requirement_labels",
    ],
    properties: {
      is_scholarship: { type: "boolean" },
      title: { type: "string" },
      summary: { type: ["string", "null"] },
      coverage_type: { type: "string", enum: [...COVERAGE_TYPES] },
      benefit_summary: { type: ["string", "null"] },
      provider_name: { type: ["string", "null"] },
      application_url: { type: ["string", "null"] },
      deadline_closes_at: { type: ["string", "null"] },
      deadline_academic_year: { type: ["string", "null"] },
      eligibility_notes: { type: "array", items: { type: "string" } },
      requirement_labels: { type: "array", items: { type: "string" } },
    },
  },
} as const;

// A verbatim source snippet stored on the candidate as curator evidence.
export interface CitingSnippet {
  heading: string | null;
  text: string;
}

// The full extracted draft as persisted to scholarship_candidates.extracted,
// with the official_url the crawler resolved (the detail page URL).
export interface StoredCandidate extends CandidateDraft {
  official_url: string;
}
