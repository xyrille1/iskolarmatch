import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSource } from "@/lib/source-watcher/fetch-source";
import { normalizeHtml } from "@/lib/source-watcher/normalize-html";
import { normalizePdf } from "@/lib/source-watcher/normalize-pdf";
import { hashSection, hashDocument } from "@/lib/source-watcher/section-hash";
import type { NormalizedSection } from "@/lib/source-watcher/types";
import type { CitingSnippet, StoredCandidate } from "@/lib/types/source-discovery";
import {
  DISCOVER_INDEX_BATCH_SIZE,
  DISCOVER_MAX_DETAIL_PAGES_PER_RUN,
  DISCOVER_CRAWL_DELAY_MS,
  MAX_CRAWL_DELAY_MS,
} from "./config";
import { extractAnchors } from "./extract-anchors";
import { selectScholarshipLinks } from "./select-listing";
import { extractCandidate } from "./extract-candidate";
import { scoreCandidate } from "./score-candidate";
import { normalizeDetailUrl } from "./dedupe";
import { robotsRulesFor, isPathAllowed, type RobotsRules } from "./robots";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

// The FR22 discovery loop (docs/PRD.md §4.7), one legible place. Per registered
// index page:
//   robots.txt-gated fetch -> deterministic anchor extraction -> change-gate ->
//   LLM link selection -> per NEW detail page: robots-gated fetch -> normalize ->
//   LLM draft extraction -> file a candidate. A curator promotes candidates in
//   /admin/discoveries; nothing here ever writes real scholarship data or
//   publishes. The whole crawl surface is the curator-registered index pages.

const SNIPPET_CAP = 6;
const SNIPPET_CHARS = 600;

export interface DiscoveryRunSummary {
  indexPagesProcessed: number;
  candidatesCreated: number;
  duplicatesSkipped: number;
  detailPagesFetched: number;
  robotsBlocked: number;
  failures: number;
}

interface IndexPageRow {
  id: string;
  index_url: string;
  last_content_hash: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(body: Buffer, sourceKind: "html" | "pdf", url: string): Promise<NormalizedSection[]> {
  return sourceKind === "pdf" ? normalizePdf(body) : Promise.resolve(normalizeHtml(body.toString("utf-8"), url));
}

// Effective politeness delay: our floor, raised by robots Crawl-delay, capped so
// a hostile/typo'd directive can't stall the whole serverless run.
function effectiveDelayMs(rules: RobotsRules): number {
  const robotsMs = (rules.crawlDelaySeconds ?? 0) * 1000;
  return Math.min(Math.max(DISCOVER_CRAWL_DELAY_MS, robotsMs), MAX_CRAWL_DELAY_MS);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname + new URL(url).search;
  } catch {
    return "/";
  }
}

async function processIndexPage(
  supabase: AdminClient,
  page: IndexPageRow,
  seenKeys: Set<string>,
  budget: { detailPages: number },
  robotsCache: Map<string, RobotsRules>,
  summary: DiscoveryRunSummary
): Promise<void> {
  const touch = async (fields: Record<string, unknown>) =>
    supabase.from("source_index_pages").update(fields).eq("id", page.id);

  // robots.txt for the index page's host (cached across the run).
  let host: string;
  try {
    host = new URL(page.index_url).hostname.toLowerCase();
  } catch {
    await touch({ last_crawled_at: new Date().toISOString(), last_error: "Malformed index_url." });
    summary.failures += 1;
    return;
  }
  let robots = robotsCache.get(host);
  if (!robots) {
    robots = await robotsRulesFor(page.index_url);
    robotsCache.set(host, robots);
  }

  if (!isPathAllowed(robots, pathOf(page.index_url))) {
    await touch({ last_crawled_at: new Date().toISOString(), last_error: "Blocked by robots.txt." });
    summary.robotsBlocked += 1;
    return;
  }

  const fetched = await fetchSource(page.index_url);
  if (!fetched.ok) {
    await touch({ last_crawled_at: new Date().toISOString(), last_error: fetched.error });
    summary.failures += 1;
    return;
  }
  if (fetched.sourceKind !== "html") {
    await touch({ last_crawled_at: new Date().toISOString(), last_error: "Index page is not HTML." });
    summary.failures += 1;
    return;
  }

  const anchors = extractAnchors(fetched.body.toString("utf-8"), fetched.finalUrl);
  const contentHash = hashDocument(anchors.map((a) => hashSection(`${a.href}|${a.text}`)));

  // Change-gate: if the set of links is identical to last crawl, skip the LLM
  // entirely (the cost-control path, mirroring the source-watcher).
  if (contentHash === page.last_content_hash) {
    await touch({ last_crawled_at: new Date().toISOString(), last_error: null });
    return;
  }

  const selected = await selectScholarshipLinks(anchors);
  const delay = effectiveDelayMs(robots);

  for (const link of selected) {
    if (budget.detailPages <= 0) break;

    const key = normalizeDetailUrl(link.href);
    if (!key || seenKeys.has(key)) {
      summary.duplicatesSkipped += 1;
      continue;
    }
    if (!isPathAllowed(robots, pathOf(link.href))) {
      summary.robotsBlocked += 1;
      continue;
    }

    await sleep(delay);
    const detail = await fetchSource(link.href);
    budget.detailPages -= 1;
    summary.detailPagesFetched += 1;
    if (!detail.ok) continue;

    const sections = await normalize(detail.body, detail.sourceKind, detail.finalUrl);
    if (sections.length === 0) continue;

    const draft = await extractCandidate(sections, detail.finalUrl);
    if (!draft) continue;

    // Re-check dedupe against the FINAL url (a redirect may have landed on a
    // page we already have).
    const finalKey = normalizeDetailUrl(detail.finalUrl);
    if (!finalKey || seenKeys.has(finalKey)) {
      summary.duplicatesSkipped += 1;
      continue;
    }

    const snippets: CitingSnippet[] = sections.slice(0, SNIPPET_CAP).map((s) => ({
      heading: s.headingLabel,
      text: s.text.length > SNIPPET_CHARS ? `${s.text.slice(0, SNIPPET_CHARS)}…` : s.text,
    }));
    const stored: StoredCandidate = { ...draft, official_url: detail.finalUrl };

    const { error } = await supabase.from("scholarship_candidates").insert({
      source_index_page_id: page.id,
      detail_url: detail.finalUrl,
      content_hash: hashDocument(sections.map((s) => hashSection(s.text))),
      extracted: stored,
      citing_snippets: snippets,
      confidence: scoreCandidate(draft),
      dedupe_key: finalKey,
      status: "pending",
    });

    if (error) {
      // A unique-index collision (a concurrent/rerun duplicate) is expected and
      // benign; anything else is a real failure worth counting.
      summary.duplicatesSkipped += 1;
      continue;
    }

    seenKeys.add(finalKey);
    summary.candidatesCreated += 1;
  }

  await touch({ last_content_hash: contentHash, last_crawled_at: new Date().toISOString(), last_error: null });
}

export async function runSourceDiscovery(supabase: AdminClient): Promise<DiscoveryRunSummary> {
  const summary: DiscoveryRunSummary = {
    indexPagesProcessed: 0,
    candidatesCreated: 0,
    duplicatesSkipped: 0,
    detailPagesFetched: 0,
    robotsBlocked: 0,
    failures: 0,
  };

  // Active index pages, most-stale first (never-crawled sorts first).
  const { data: pages, error } = await supabase
    .from("source_index_pages")
    .select("id, index_url, last_content_hash, last_crawled_at")
    .eq("is_active", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })
    .limit(DISCOVER_INDEX_BATCH_SIZE);
  if (error) throw new Error("Failed to load source index pages.");

  const targets = (pages ?? []) as Array<IndexPageRow & { last_crawled_at: string | null }>;
  if (targets.length === 0) return summary;

  // Build the dedupe set once: existing published/draft official_urls, plus any
  // pending/approved candidate already in the queue. So we never re-propose a
  // scholarship we already have or are already reviewing.
  const seenKeys = new Set<string>();
  const { data: existingScholarships } = await supabase.from("scholarships").select("official_url");
  for (const s of (existingScholarships ?? []) as Array<{ official_url: string | null }>) {
    const k = s.official_url ? normalizeDetailUrl(s.official_url) : null;
    if (k) seenKeys.add(k);
  }
  const { data: existingCandidates } = await supabase
    .from("scholarship_candidates")
    .select("dedupe_key")
    .in("status", ["pending", "approved"]);
  for (const c of (existingCandidates ?? []) as Array<{ dedupe_key: string }>) {
    seenKeys.add(c.dedupe_key);
  }

  const budget = { detailPages: DISCOVER_MAX_DETAIL_PAGES_PER_RUN };
  const robotsCache = new Map<string, RobotsRules>();

  for (const page of targets) {
    try {
      await processIndexPage(supabase, page, seenKeys, budget, robotsCache, summary);
    } catch {
      // One index page failing must not abort the batch.
      summary.failures += 1;
    }
    summary.indexPagesProcessed += 1;
  }

  return summary;
}
