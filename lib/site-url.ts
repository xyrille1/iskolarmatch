// Canonical site origin, used to build absolute URLs: magic-link redirects,
// sitemap/robots/OpenGraph entries, and reminder/digest email links. Was
// previously copy-pasted (`process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`)
// across 7+ files (docs/QA-CHECKLIST.md P2-08) -- one source of truth here so
// the fallback can't drift between callers.
//
// Not `server-only`: NEXT_PUBLIC_SITE_URL is a public value by convention
// (Next.js inlines NEXT_PUBLIC_* into the client bundle), so this is safe to
// import from either a server or client module.
const DEV_FALLBACK = "http://localhost:3000";

let warnedMissingInProd = false;

// Falls back to localhost only for local dev. In production, silently
// linking to localhost in an email or a magic-link redirect is a real bug, so
// warn loudly (once) rather than letting it degrade unnoticed.
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production" && !warnedMissingInProd) {
    warnedMissingInProd = true;
    console.warn(
      "[env] NEXT_PUBLIC_SITE_URL is not set in production -- falling back to http://localhost:3000. " +
        "Magic links, emails, and sitemap/robots URLs will be wrong until it's configured."
    );
  }

  return DEV_FALLBACK;
}
