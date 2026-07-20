import path from "node:path";
import type { NextConfig } from "next";

// Security headers per docs/SECURITY.md SR-R2. A nonce-based
// script-src was tried first (see git history) but reverted: several routes
// here (/, /match, /about, /privacy) are deliberately statically prerendered
// for speed/SEO (a P1 decision), and a per-request nonce can never be
// embedded into HTML that's generated once at build time -- Next.js's own
// inline hydration scripts were silently blocked as a result, breaking
// hydration app-wide. 'unsafe-inline' is the realistic, documented trade-off
// for a Next.js app that mixes static and dynamic rendering without wiring
// per-page nonces; the rest of the app's defenses (no dangerouslySetInnerHTML
// with unsanitized input, Zod .strict() everywhere, RLS) carry the load CSP
// script-src would otherwise provide.
function buildContentSecurityPolicy(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSrc = ["'self'", "https://*.supabase.co", supabaseUrl].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly: a stray lockfile at C:\Users\User\package-lock.json
  // (outside this repo) otherwise makes Next.js guess the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ];

    // CSP is production-only: Turbopack's dev server relies on eval'd HMR
    // chunks and a websocket connection that a strict CSP would block.
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: buildContentSecurityPolicy() });
    }

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
