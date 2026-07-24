import "server-only";
import { runStructuredExtraction } from "@/lib/groq/client";
import { linkSelectionSchema, LINK_SELECTION_JSON_SCHEMA } from "@/lib/types/source-discovery";
import type { Anchor } from "./extract-anchors";

// LLM step 1: given the anchors we deterministically extracted from an index
// page, decide which ones are links to individual SCHOLARSHIP detail pages (vs
// nav, pagination, "apply now" portals, unrelated news). The model returns only
// indexes into the list we gave it, so it can never introduce a URL we didn't
// already fetch and allowlist-check -- grounding by construction.
//
// Fail-safe: any error or malformed response yields an empty selection, never an
// exception that would abort the cron batch (one bad index page must not stop
// the others), matching lib/source-watcher/run-extraction.ts.

function buildSystemPrompt(): string {
  return [
    "You are given a numbered list of links extracted from an official Philippine scholarship INDEX/listing page (a government agency, LGU, or state/private university).",
    "Your job: return the indexes of the links that lead to an individual SCHOLARSHIP's own detail page.",
    "",
    "Include a link when its text/URL indicates a specific scholarship, grant, or financial-aid program a student could read about and apply to.",
    "EXCLUDE: site navigation, pagination ('next', 'page 2'), category/tag pages, login/portal/apply-now external links, news/announcements not about a specific scholarship, social media, and contact/about pages.",
    "",
    "Return ONLY indexes that appear in the provided list. If you are unsure, leave it out. Respond only with JSON matching the schema.",
  ].join("\n");
}

function buildUserPrompt(anchors: Anchor[]): string {
  const list = anchors
    .map((a, i) => `${i}: ${a.text || "(no link text)"} -> ${a.href}`)
    .join("\n");
  return ["LINKS:", list, "", "Return the indexes of the scholarship detail links."].join("\n");
}

export async function selectScholarshipLinks(anchors: Anchor[]): Promise<Anchor[]> {
  if (anchors.length === 0) return [];

  let raw: string;
  try {
    raw = await runStructuredExtraction({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(anchors),
      jsonSchema: LINK_SELECTION_JSON_SCHEMA,
    });
  } catch (err) {
    console.warn("[discovery] link-selection request failed:", err instanceof Error ? err.message : err);
    return [];
  }

  let indexes: number[];
  try {
    indexes = linkSelectionSchema.parse(JSON.parse(raw)).scholarship_link_indexes;
  } catch (err) {
    console.warn("[discovery] link-selection response was unparseable:", err instanceof Error ? err.message : err);
    return [];
  }

  // Grounding: keep only in-range indexes, dedupe, resolve back to real anchors.
  const chosen = new Map<number, Anchor>();
  for (const i of indexes) {
    if (Number.isInteger(i) && i >= 0 && i < anchors.length) chosen.set(i, anchors[i]);
  }
  return [...chosen.values()];
}
