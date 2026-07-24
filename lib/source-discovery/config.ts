// Tunables for the FR22 discovery crawler (docs/PRD.md §4.7). Kept small and in
// one place, like lib/source-watcher/config.ts. The fetch safety limits
// (timeout / byte cap / redirects) are reused from the source-watcher config --
// discovery shares the exact same SSRF-guarded fetchSource, so it inherits them.

// Self-identifying User-Agent for every request the crawler makes, with a
// contact URL, so a site operator can see who is crawling and reach us. Sending
// this (and honoring robots.txt, see robots.ts) is the "good-citizen crawler"
// posture the legality requirement depends on (docs/SECURITY.md).
export const DISCOVERY_USER_AGENT =
  "IskolarMatch-Discovery/1.0 (+https://iskolarmatch.app/about; scholarship-index-crawler)";

// The product token robots.txt groups are matched against (the name before the
// slash in the UA above), lowercased.
export const DISCOVERY_ROBOTS_TOKEN = "iskolarmatch-discovery";

// Index pages processed per cron tick, oldest-crawled first. Small so the job
// stays well within the 60s serverless budget (docs/DEPLOYMENT.md §3).
export const DISCOVER_INDEX_BATCH_SIZE = 3;

// Hard ceiling on NEW detail pages fetched across the whole run. Each fetch can
// take up to FETCH_TIMEOUT_MS (15s), so this caps worst-case wall time.
export const DISCOVER_MAX_DETAIL_PAGES_PER_RUN = 5;

// Politeness delay between successive fetches to the same host. robots.txt
// Crawl-delay overrides this when larger, capped by MAX_CRAWL_DELAY_MS so a
// hostile/typo'd directive can't hang the whole run.
export const DISCOVER_CRAWL_DELAY_MS = 800;
export const MAX_CRAWL_DELAY_MS = 5_000;

// Cap on anchors handed to the link-selection LLM step, so a link-heavy index
// page can't blow up the prompt. Extracted anchors past this are dropped.
export const MAX_ANCHORS_PER_INDEX = 120;
