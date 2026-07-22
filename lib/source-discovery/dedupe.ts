// Pure URL normalization for de-duplicating discovered scholarships. Two URLs
// that point at the same page should collapse to the same dedupe_key so a weekly
// re-crawl (and a link that already became a published scholarship's
// official_url) is not proposed twice. Pure and I/O-free, so it unit-tests
// exactly like lib/matching/* and lib/source-watcher/section-hash.ts.

// Normalizes a URL to a stable dedupe key: lowercased host, no port, no query,
// no fragment, no trailing slash, path kept case-sensitive (paths can be
// case-significant on some servers). "www." is stripped so www/non-www collapse.
// Returns null for a URL we can't parse -- the caller treats that as "skip".
export function normalizeDetailUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let path = url.pathname.replace(/\/+$/, ""); // drop trailing slash(es)
  if (path === "") path = "/";

  return `${host}${path}`;
}

// True when two URLs resolve to the same normalized detail page.
export function sameDetailUrl(a: string, b: string): boolean {
  const na = normalizeDetailUrl(a);
  const nb = normalizeDetailUrl(b);
  return na !== null && na === nb;
}
