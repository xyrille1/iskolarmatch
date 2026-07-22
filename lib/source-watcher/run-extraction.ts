import "server-only";
import { runStructuredExtraction } from "@/lib/groq/client";
import { buildSystemPrompt, buildUserPrompt } from "./build-extraction-prompt";
import { diffAgainstRecord } from "./diff-against-record";
import { EXTRACTION_JSON_SCHEMA, extractionResponseSchema, type SuggestionProposal } from "@/lib/types/source-watcher";
import type { CitableSection, RecordSnapshot } from "./types";

// The RAG "generation" step: given the retrieved evidence (the CHANGED source
// sections) and the current record, call Groq for a strict-JSON extraction,
// Zod-validate it, drop any ungrounded/hallucinated citations, and hand the
// grounded candidates to the deterministic diff. Returns proposals ready to be
// written to scholarship_suggestions (or [] if nothing changed / the model
// produced nothing usable).
//
// Fail-safe: a malformed model response yields zero proposals, never an
// exception that would abort the whole cron batch -- one bad page shouldn't
// stop the watcher from processing the others.

export async function runExtraction(
  record: RecordSnapshot,
  changedSections: CitableSection[]
): Promise<SuggestionProposal[]> {
  if (changedSections.length === 0) return [];

  let raw: string;
  try {
    raw = await runStructuredExtraction({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(record, changedSections),
      jsonSchema: EXTRACTION_JSON_SCHEMA,
    });
  } catch (err) {
    // Fail-safe: never abort the cron batch over one page. But log it -- an API
    // error (e.g. a 429 rate-limit) is NOT the same as "the model found nothing",
    // and silently returning [] hides outages and skews the extraction eval.
    console.warn(`[source-watcher] extraction request failed for ${record.scholarshipId}:`, err instanceof Error ? err.message : err);
    return [];
  }

  let candidates;
  try {
    candidates = extractionResponseSchema.parse(JSON.parse(raw)).candidates;
  } catch (err) {
    console.warn(`[source-watcher] extraction response was unparseable for ${record.scholarshipId}:`, err instanceof Error ? err.message : err);
    return [];
  }

  // Enforce grounding: keep only citations that reference a section we actually
  // provided, and drop candidates left with no valid citation.
  const providedIds = new Set(changedSections.map((s) => s.id));
  const grounded = candidates
    .map((c) => ({ ...c, citing_section_ids: c.citing_section_ids.filter((id) => providedIds.has(id)) }))
    .filter((c) => c.citing_section_ids.length > 0);

  return diffAgainstRecord(grounded, record);
}
