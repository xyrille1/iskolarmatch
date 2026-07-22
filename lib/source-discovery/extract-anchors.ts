import "server-only";
import { JSDOM } from "jsdom";
import { isAllowlistedUrl } from "@/lib/security/url-allowlist";
import { normalizeDetailUrl } from "./dedupe";
import { MAX_ANCHORS_PER_INDEX } from "./config";

// Deterministic anchor extraction for index/listing pages. Unlike the detail-
// page path, this does NOT use Readability: Readability returns cleaned text and
// throws away href attributes, but for a listing page the hrefs ARE the payload.
// So we parse the raw DOM, resolve every <a href> against the page URL, and keep
// only the links that are safe and in-scope to crawl:
//   - https + on the gov.ph/edu.ph/curated allowlist (the legal boundary), and
//   - same host as the index page (politeness/scope: don't wander off-site).
// The result is deduped and capped, then handed to the LLM to classify which are
// actually scholarship detail links. Because the model only ever selects from
// this list, it can never fabricate a URL.

export interface Anchor {
  text: string;
  href: string;
}

export function extractAnchors(html: string, baseUrl: string): Anchor[] {
  let indexHost: string;
  try {
    indexHost = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return [];
  }

  const dom = new JSDOM(html, { url: baseUrl });
  const anchors: Anchor[] = [];
  const seen = new Set<string>();
  const selfKey = normalizeDetailUrl(baseUrl);

  for (const el of Array.from(dom.window.document.querySelectorAll("a[href]"))) {
    const rawHref = el.getAttribute("href");
    if (!rawHref) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }

    if (resolved.protocol !== "https:") continue;
    if (resolved.hostname.toLowerCase() !== indexHost) continue; // same-site only
    if (!isAllowlistedUrl(resolved.href)) continue;

    const key = normalizeDetailUrl(resolved.href);
    if (!key || key === selfKey || seen.has(key)) continue; // skip self + dupes
    seen.add(key);

    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    anchors.push({ text, href: resolved.href });

    if (anchors.length >= MAX_ANCHORS_PER_INDEX) break;
  }

  return anchors;
}
