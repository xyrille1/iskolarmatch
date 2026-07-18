// TS mirror of the DB outbound-link allowlist (see
// supabase/migrations/20260101000002_url_allowlist.sql). Anticipates the P5
// admin Zod schema's `.refine()` validation. Manually kept in sync with the DB
// trigger -- there is no shared runtime source between SQL and TS in P0.

export const ALLOWLISTED_SUFFIXES = ['gov.ph', 'edu.ph'] as const;

// Populated alongside supabase/migrations' allowlisted_domains table in P5.
export const CURATED_FOUNDATION_DOMAINS: string[] = [];

export function isAllowlistedUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (ALLOWLISTED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return true;
  }

  return CURATED_FOUNDATION_DOMAINS.includes(host);
}
