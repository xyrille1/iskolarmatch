import "server-only";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { NormalizedSection } from "./types";

// Turn a fetched HTML page into clean, heading-delimited sections. Readability
// (Firefox Reader Mode's engine) strips nav/footer/ads/boilerplate so the hash
// and the extraction prompt see only the article content; jsdom then splits
// that content into sections keyed by their nearest heading. Deterministic --
// no network, no LLM.

const CONTENT_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th";
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

function pushSection(
  sections: NormalizedSection[],
  headingLabel: string | null,
  parts: string[]
): void {
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (text.length > 0) {
    sections.push({ sectionIndex: sections.length, headingLabel, text });
  }
}

export function normalizeHtml(html: string, sourceUrl: string): NormalizedSection[] {
  const dom = new JSDOM(html, { url: sourceUrl });
  const article = new Readability(dom.window.document).parse();

  // Readability returns cleaned article HTML; if it can't (very sparse page),
  // fall back to the raw body so we still get *something* to hash/extract.
  const contentHtml = article?.content ?? dom.window.document.body?.innerHTML ?? "";
  const contentDom = new JSDOM(`<body>${contentHtml}</body>`);
  const root = contentDom.window.document.body;

  const sections: NormalizedSection[] = [];
  let currentHeading: string | null = null;
  let currentParts: string[] = [];

  for (const node of Array.from(root.querySelectorAll(CONTENT_SELECTOR))) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (text.length === 0) continue;

    if (HEADING_TAGS.has(node.tagName)) {
      pushSection(sections, currentHeading, currentParts);
      currentHeading = text;
      currentParts = [];
    } else {
      currentParts.push(text);
    }
  }
  pushSection(sections, currentHeading, currentParts);

  // A page with no headings at all still yields one leading section; if even
  // that is empty, surface the article's plain text as a single section.
  if (sections.length === 0 && article?.textContent) {
    pushSection(sections, null, [article.textContent]);
  }

  return sections;
}
