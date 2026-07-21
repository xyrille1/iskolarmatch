# IskolarMatch — Security & Privacy

_Threat model, security objectives, and the concrete controls actually implemented for IskolarMatch — a Philippine scholarship discovery and matching tool whose audience includes minors._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `iskolar-ux-design.md`
**Owner:** Xyrille · **Stack:** Next.js + TypeScript + Supabase (Postgres) + Tailwind · **Hosting:** Vercel + Supabase + Resend
**Status:** Reflects the app as built — §3 is the ground truth; §4 tracks known gaps honestly rather than pretending they don't exist

---

## 0. Scope & Assumptions

- `[ASSUMPTION]` This is a **portfolio-grade, solo build on free tiers** (Supabase free, Vercel hobby, Resend free). Controls are chosen to be _strong but proportionate_ — no paid WAF, no SOC tooling. Every control here is achievable by one developer and is, in fact, already implemented (§3).
- `[ASSUMPTION]` The audience **includes minors (16–18)**; the **Philippine Data Privacy Act of 2012 (RA 10173)** applies. This raises the bar on personal-data handling even though the app stores very little — see `PRD.md` §1.7 NFR "Privacy".
- `[ASSUMPTION]` The design goal is **radical data minimization**: browsing and matching are anonymous and persist nothing (there is no `student_profiles` table — `DATABASE.md` §2); an account exists only to save scholarships and set reminders.
- `[ASSUMPTION]` The app **never** accepts documents or scholarship applications; it links out to official portals. This keeps the highest-risk data (IDs, financial docs) off the system entirely (`PRD.md` §1.3 Non-Goals).

## 1. Security Objectives (SMART) — status against the real implementation

| Goal | Target | Status |
| --- | --- | --- |
| **SEC-G1 — Data minimization** | 0 sensitive personal fields (disability, indigenous status, income) ever persisted server-side | **Met.** No `student_profiles` table exists; matching runs on an in-session `Profile` object only (`lib/actions/match-profile.ts`). |
| **SEC-G2 — Tenant isolation** | 100% of user-owned tables protected by default-deny RLS, proven by a two-user test | **Met, partially proven.** `saved_scholarships`/`reminders` have owner-only RLS policies (`DATABASE.md` §5); `tests/integration/rls.test.ts` exists but is skipped unless `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` are set — it is not run by default (no CI, `DEPLOYMENT.md` §7). |
| **SEC-G3 — Link/data integrity** | 0 off-allowlist outbound "apply" links reach students | **Met, defense-in-depth.** Enforced independently at three layers: Zod refinement (`lib/types/admin.ts`), a Postgres trigger (`enforce_scholarship_url_allowlist`, `DATABASE.md` §6), and the underlying `is_allowlisted_url()`/`isAllowlistedUrl()` logic. Gap: the two implementations share no source of truth (§4). |
| **SEC-G4 — Secret safety** | 0 privileged secrets in any client-shipped file | **Met.** `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY` are read only in server actions / Route Handlers (`DEPLOYMENT.md` §2); nothing under `components/` or a `"use client"` file touches them. |
| **SEC-G5 — Recoverability** | Clean environment rebuildable from git migrations + seed in <30 min | **Met by construction.** Forward-only migrations in `supabase/migrations/`, no schema changes outside them (`docs/iskolar-version-control.md`). |
| **SEC-G6 — Injection resistance** | 100% of server-action inputs pass a Zod schema rejecting unknown fields; 0 raw string-interpolated SQL | **Met.** All server actions validate via `.strict()` Zod schemas under `lib/types/`; all DB access goes through `@supabase/supabase-js`, no raw SQL string building anywhere in the app. |

## 2. Assets & Trust Boundaries

| # | Asset | Why it matters | Primary threat |
| --- | --- | --- | --- |
| A1 | **Curated scholarship data** (records, deadlines, official/apply URLs) | The product's entire value, and a safety surface — a bad link can phish a minor or cause a missed deadline | Tampering, integrity loss, deletion |
| A2 | **Users' minimal PII** (email; saved lists; reminders) | Belongs to students, many minors; regulated under RA 10173 | Unauthorized read (RLS bypass), breach |
| A3 | **Admin/curator account** | Can publish, edit links, approve future ingestion — the keys to A1 | Account takeover, privilege escalation |
| A4 | **Service-role key & provider secrets** (Supabase, Resend, CRON_SECRET) | Bypasses RLS entirely; sends mail as the brand; authorizes cron writes | Secret leakage |
| A5 | **Availability of the read path** | Students rely on it near deadlines | DoS, free-tier pausing, data loss |

```
 UNTRUSTED                         SEMI-TRUSTED                        TRUSTED
 ─────────                         ────────────                        ───────
 Browser (anon or                  Next.js server (Vercel):            Supabase Postgres:
 authenticated session)   ──────▶  Server Components,                  RLS-enforced for anon/
   - anon key only                 Server Actions, Route               authenticated roles;
   - RLS-scoped reads              Handlers. Holds the                 service-role bypasses
                                   service-role key and                RLS entirely (only
                                   CRON_SECRET server-side              reachable from the
                                   only.                                trusted server tier)
```

## 3. Implemented Controls (ground truth — see file paths)

### 3.1 Network / transport
- **Security headers** on every route (`next.config.ts`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **CSP** (production only): `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co <NEXT_PUBLIC_SUPABASE_URL>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. **Not nonce-based** — a nonce approach was tried and reverted because `/`, `/match`, `/about`, `/privacy` are deliberately statically prerendered for speed/SEO, and a per-request nonce can't be embedded in HTML generated once at build time. `'unsafe-inline'` on `script-src`/`style-src` is a documented, accepted trade-off (see §4); CSP is skipped entirely in dev since Turbopack HMR needs eval/websockets.

### 3.2 Application input handling
- **Zod `.strict()`** schemas on every server-action input (`lib/types/`), rejecting unknown fields (SEC-G6). `.safeParse()` for user-facing forms (surfaces field errors); `.parse()` (throwing) inside admin functions that only run after `requireAdmin()` has already gated access.
- **URL allowlist**, defense-in-depth across three layers: Zod `.refine()` in `lib/types/admin.ts` → Postgres trigger `enforce_scholarship_url_allowlist` → underlying suffix-match logic (`gov.ph`/`edu.ph`, dot-boundary anchored so `evilgov.ph` does not match) plus a curated-domains table/list (both currently empty — a P5 feature stub, not a bug). Tested against subdomain-spoofing attacks in `lib/security/url-allowlist.test.ts`.

### 3.3 Rate limiting
`lib/security/rate-limit.ts` — an in-memory **fixed-window counter** (not a true token bucket, despite the internal naming), keyed by `x-forwarded-for`:
- `submitProfileForm` (public match form): 20 requests / 60s per IP.
- `requestMagicLink` (auth): 5 requests / 60s per IP.
Documented, accepted gap: resets on cold start and is per-instance in a serverless deployment (§4) — this is a known trade-off, not an oversight.

### 3.4 Authentication & admin authorization
- Supabase Auth email magic link (OTP); session refreshed on every request by `proxy.ts` (Next.js 16's renamed `middleware.ts` convention) — **this only refreshes the session cookie, it does not gate `/admin`.**
- Admin gating is `requireAdmin()` (`lib/auth/require-admin.ts`), called individually at the top of every admin page and every mutating function in `lib/actions/admin.ts`. It checks for a row in `admin_users` keyed to the authenticated user server-side — never a client-supplied claim. Granting admin is a manual, service-role-only DB write; there is no self-service admin signup (intentional for a solo-curator MVP).
- **The real security boundary is RLS, not `requireAdmin()`.** Even if a `requireAdmin()` call were missed on a new admin surface, an `authenticated`-role Supabase client still cannot write to `scholarships`/`providers`/etc. — no RLS policy permits it (`DATABASE.md` §5). `requireAdmin()` is a UX gate on top of that.

### 3.5 Cron endpoint authorization
`app/api/cron/refresh-deadlines` and `app/api/cron/send-reminders` require a `CRON_SECRET` bearer token, checked with `timingSafeEqual` (`lib/security/verify-cron-secret.ts`) — constant-time comparison, with an explicit length check first to avoid the function throwing on mismatched lengths. Both return `401` on failure.

### 3.6 Data access & RLS
Every table has RLS enabled; content tables have no write policy for any client-facing role (service-role only); user-owned tables (`saved_scholarships`, `reminders`) are strictly `auth.uid()`-scoped; `admin_users` allows only a self-read; `audit_log` is admin-read-only via a `SECURITY DEFINER` function, with no write policy for any role. Full policy list in `DATABASE.md` §5 — this doc intentionally doesn't duplicate it.

### 3.7 Audit trail
Every admin mutation (`lib/actions/admin.ts`) writes an `audit_log` row via `logAudit()` — actor, action, entity type/id, a jsonb detail blob. Append-only: no update/delete policy exists for any role.

### 3.8 Secrets
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY` are read only in server-side code (`DEPLOYMENT.md` §2); `.env.example` documents the full, exhaustive set — confirmed by grepping the codebase for `process.env.` usage.

## 4. Known Gaps / Accepted Risks

Documented honestly rather than glossed over — revisit if the app's risk profile changes (more traffic, more admins, real user data at scale):

- **CSP allows `'unsafe-inline'`** for scripts and styles, because static prerendering is incompatible with per-request nonces as currently built. Mitigated by: no `dangerouslySetInnerHTML` with unsanitized input anywhere in the codebase, strict Zod validation everywhere, and RLS as the actual data-access boundary (CSP is defense-in-depth here, not the primary control).
- **Rate limiter is in-memory and per-instance** — resets on cold start, and a multi-instance deployment gives each instance its own counter (effectively raising the real limit). Acceptable at current traffic; would need a durable store (e.g. Upstash Redis) to hold under real abuse or horizontal scaling.
- **URL allowlist has no single source of truth** — the Postgres function and the TypeScript module enforce the same rule independently. A future change to one without the other is a silent drift risk. Consider generating one from the other, or moving the check to a single RPC call the app invokes instead of duplicating logic.
- **`CURATED_FOUNDATION_DOMAINS` / `allowlisted_domains` are empty** — only `*.gov.ph`/`*.edu.ph` are enforced today; foundation-domain curation is a planned but unbuilt feature.
- **No CI enforces the QA checklist.** `lint`/`typecheck`/`test`/`build` are run manually pre-push (`docs/iskolar-version-control.md` §7); a bad push can reach production if a step is skipped. The RLS integration test (`tests/integration/rls.test.ts`) additionally requires manual opt-in env vars and is not run by default.
- **Admin gating is not centralized** — a new admin route or action that forgets to call `requireAdmin()` would be reachable by any authenticated user (though still blocked from writing by RLS, §3.4). Worth a shared layout/wrapper if the admin surface grows past a few pages.
- **`updated_at` on `scholarships` is not auto-refreshed** by a trigger — stale-timestamp risk if application code ever forgets to set it explicitly on an update path (`DATABASE.md` §7).

## 5. Security Test Checklist

- [x] `lib/security/url-allowlist.test.ts` — gov.ph/edu.ph acceptance, rejection of non-matching hosts, malformed URLs, subdomain-spoofing attempts (`gov.ph.attacker.net`, `notgov.ph.evil.com`).
- [x] `lib/matching/*.test.ts` — matcher never claims eligible on missing/unknown data (conservative-by-construction, SEC-related since a false "eligible" is a trust failure).
- [x] `lib/deadline/compute-status.test.ts` — date-boundary correctness (Asia/Manila pinning), relevant to SEC-G3 (0 stale-open scholarships).
- [ ] `tests/integration/rls.test.ts` — exists, covers anon read-published/no-write/no-`allowlisted_domains`-read, but **is not run by default** (requires `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` against a local Supabase stack). Run it manually before any RLS policy change; consider wiring into CI once CI exists.
- [ ] Two-user manual test that user A cannot read/write user B's `saved_scholarships`/`reminders` via the anon/authenticated client — not automated; do this manually before a release if RLS policies change.
- [ ] Admin-route smoke test that an unauthenticated/non-admin session is redirected — not currently in the Playwright suite (which deliberately skips DB-backed routes, `ARCHITECTURE.md` §9).

## 6. Incident Response

- **Secret leak (any of `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`):** rotate in the relevant provider dashboard (Supabase/Vercel env vars/Resend) **first**, then deal with git history if it was ever committed — never the reverse order (`CLAUDE.md` standing instruction).
- **Suspected RLS bypass or data leak:** check `audit_log` for unexpected `service_role`-path writes; the append-only, admin-read-only design means the log itself can't be tampered with from a compromised `authenticated` session.
- **Bad/phishing link published:** the DB trigger should have rejected it at insert/update time; if one somehow got through (e.g. inserted before the trigger existed, or via a since-fixed allowlist bug), unpublish the scholarship (`is_published = false`) via the admin tool immediately, then fix the allowlist gap that let it through.
