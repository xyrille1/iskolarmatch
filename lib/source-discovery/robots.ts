import "server-only";
import { fetchSource } from "@/lib/source-watcher/fetch-source";
import { DISCOVERY_ROBOTS_TOKEN } from "./config";

// robots.txt compliance for the discovery crawler. Honoring robots.txt (plus a
// self-identifying User-Agent and a crawl delay) is the concrete "good-citizen
// crawler" control the legality requirement rests on (docs/SECURITY.md): we only
// fetch pages the site's operator permits robots to fetch.
//
// The parser + matcher are pure and I/O-free so they unit-test like the rest of
// lib/*. robotsRulesFor() is the one impure entry point (it fetches robots.txt
// through the same SSRF-guarded fetchSource the crawler uses).

export interface RobotsRules {
  // Longest-match-wins allow/disallow rules for the applicable user-agent group.
  allow: string[];
  disallow: string[];
  crawlDelaySeconds: number | null;
}

// A missing/unreachable robots.txt means "no restrictions" per the standard.
export const PERMISSIVE_RULES: RobotsRules = { allow: [], disallow: [], crawlDelaySeconds: null };

interface RawGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  crawlDelaySeconds: number | null;
}

// Parse robots.txt and return the rules for the group applicable to `token`
// (our product token, lowercased). A UA-specific group wins over the wildcard
// `*` group; if neither exists, no restrictions.
export function parseRobots(content: string, token: string): RobotsRules {
  const groups: RawGroup[] = [];
  let current: RawGroup | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim(); // strip comments
    if (line === "") continue;

    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one group; a UA line after a rule
      // line starts a fresh group.
      if (!current || !lastLineWasAgent) {
        current = { agents: [], allow: [], disallow: [], crawlDelaySeconds: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    if (!current) continue; // rule before any User-agent: ignore
    lastLineWasAgent = false;

    if (field === "disallow") current.disallow.push(value);
    else if (field === "allow") current.allow.push(value);
    else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelaySeconds = n;
    }
  }

  const matches = (group: RawGroup, specificOnly: boolean) =>
    group.agents.some((a) => (specificOnly ? a !== "*" && token.includes(a) : a === "*"));

  const specific = groups.filter((g) => matches(g, true));
  const applicable = specific.length > 0 ? specific : groups.filter((g) => matches(g, false));

  const merged: RobotsRules = { allow: [], disallow: [], crawlDelaySeconds: null };
  for (const g of applicable) {
    merged.allow.push(...g.allow);
    merged.disallow.push(...g.disallow);
    if (g.crawlDelaySeconds !== null) {
      merged.crawlDelaySeconds = merged.crawlDelaySeconds === null ? g.crawlDelaySeconds : Math.max(merged.crawlDelaySeconds, g.crawlDelaySeconds);
    }
  }
  return merged;
}

// Compile a robots path pattern (supports `*` wildcard and `$` end-anchor) into
// a RegExp anchored at the path root.
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

// True if the crawler may fetch `path` under these rules. Longest-matching rule
// wins (Allow beats Disallow on a tie of length, per Google's spec). An empty
// Disallow value imposes no restriction.
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  let bestLen = -1;
  let allowed = true; // default: allowed unless a Disallow rule wins

  for (const value of rules.disallow) {
    if (value === "") continue; // "Disallow:" == allow all
    if (patternToRegex(value).test(path) && value.length > bestLen) {
      bestLen = value.length;
      allowed = false;
    }
  }
  for (const value of rules.allow) {
    if (value === "") continue;
    if (patternToRegex(value).test(path) && value.length >= bestLen) {
      bestLen = value.length;
      allowed = true;
    }
  }
  return allowed;
}

// Fetch and parse robots.txt for a URL's origin. Any failure (404, network,
// off-allowlist) yields permissive rules -- a site with no reachable robots.txt
// is treated as unrestricted, the standard behavior.
export async function robotsRulesFor(pageUrl: string): Promise<RobotsRules> {
  let robotsUrl: string;
  try {
    robotsUrl = new URL("/robots.txt", pageUrl).href;
  } catch {
    return PERMISSIVE_RULES;
  }

  const fetched = await fetchSource(robotsUrl);
  if (!fetched.ok) return PERMISSIVE_RULES;

  try {
    return parseRobots(fetched.body.toString("utf-8"), DISCOVERY_ROBOTS_TOKEN);
  } catch {
    return PERMISSIVE_RULES;
  }
}
