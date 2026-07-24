import "server-only";
import { runStructuredExtraction } from "@/lib/groq/client";
import { candidateDraftSchema, CANDIDATE_DRAFT_JSON_SCHEMA, type CandidateDraft } from "@/lib/types/source-discovery";
import type { NormalizedSection } from "@/lib/source-watcher/types";

// LLM step 2: extract a DRAFT scholarship record from a detail page's normalized
// sections. Facts only -- coverage, benefit, deadline, and plain-text eligibility
// and requirement hints. It deliberately does NOT produce structured eligibility
// rules (field/operator/value): that vocabulary lives in the admin editor, where
// a curator transcribes these hints into real rules at promotion. The model also
// never authors official_url -- the caller sets it to the page it actually
// fetched (allowlist-guaranteed).
//
// This is a DRAFT for human review, never live data, and never published
// automatically -- so "extraction, not decision" (PRD §1.3 / Appendix) holds:
// the model summarizes a public page; the curator decides.
//
// Fail-safe: a malformed/empty response yields null, never a thrown exception
// (one bad detail page must not abort the batch).

function buildSystemPrompt(): string {
  return [
    "You extract structured facts from a single official Philippine scholarship page into a draft record for a human curator to review.",
    "Report ONLY what the page states. Never invent, infer beyond the text, or guess a value that isn't there -- use null / an empty list when the page doesn't say.",
    "",
    "Fields:",
    "- is_scholarship: false if this page is NOT actually about one specific scholarship (e.g. it's a category list, news post, or nav page). If false, the other fields are ignored.",
    "- title: the scholarship's name as written.",
    "- summary: one or two plain sentences describing it, or null.",
    "- coverage_type: one of full | partial | allowance | other. Use 'full' for full tuition/free education, 'allowance' for stipend/allowance-only, 'partial' for partial tuition, 'other' if unclear.",
    "- benefit_summary: what the scholarship gives (tuition, stipend amount, book allowance, etc.), or null.",
    "- provider_name: the sponsoring agency/university/foundation, or null.",
    "- application_url: an explicit 'apply here' link if the page states one, else null.",
    "- deadline_closes_at: the application close date as ISO YYYY-MM-DD, or null if none is stated.",
    "- deadline_academic_year: e.g. '2026-2027', or null.",
    "- eligibility_notes: short plain-language bullet points of who qualifies (GWA, income, course, region, year level, special status). Do NOT format as rules.",
    "- requirement_labels: short labels of documents/requirements to submit.",
    "",
    "Respond ONLY with JSON matching the provided schema.",
  ].join("\n");
}

function buildUserPrompt(sections: NormalizedSection[], sourceUrl: string): string {
  const body = sections
    .map((s) => `[${s.headingLabel ?? "(no heading)"}]\n${s.text}`)
    .join("\n\n");
  return ["SOURCE URL:", sourceUrl, "", "PAGE CONTENT:", body, "", "Extract the draft now."].join("\n");
}

export async function extractCandidate(
  sections: NormalizedSection[],
  sourceUrl: string
): Promise<CandidateDraft | null> {
  if (sections.length === 0) return null;

  let raw: string;
  try {
    raw = await runStructuredExtraction({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(sections, sourceUrl),
      jsonSchema: CANDIDATE_DRAFT_JSON_SCHEMA,
    });
  } catch (err) {
    console.warn(`[discovery] candidate extraction failed for ${sourceUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }

  try {
    const draft = candidateDraftSchema.parse(JSON.parse(raw));
    // The model's own guard: skip pages it says aren't a single scholarship, and
    // skip anything with no usable title.
    if (!draft.is_scholarship || draft.title.trim().length === 0) return null;
    return draft;
  } catch (err) {
    console.warn(`[discovery] candidate response unparseable for ${sourceUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
