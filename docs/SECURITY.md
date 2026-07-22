# IskolarMatch — Security & Privacy

_Threat model, security objectives, and the concrete controls actually implemented for IskolarMatch — a Philippine scholarship discovery and matching tool whose audience includes minors._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `iskolar-ux-design.md`
**Owner:** Xyrille · **Stack:** Next.js + TypeScript + Supabase (Postgres) + Tailwind · **Hosting:** Vercel + Supabase + Resend
**Status:** Reflects the app as built — §3 is the ground truth; §4 tracks known gaps honestly rather than pretending they don't exist

---

## 0. Scope & Assumptions

- `[ASSUMPTION]` This is a **portfolio-grade, solo build on free tiers** (Supabase free, Vercel hobby, Resend free). Controls are chosen to be _strong but proportionate_ — no paid WAF, no SOC tooling. Every control here is achievable by one developer and is, in fact, already implemented (§3).
- `[ASSUMPTION]` The audience **includes minors (16–18)**; the **Philippine Data Privacy Act of 2012 (RA 10173)** applies. This raises the bar on personal-data handling even though the app stores very little — see `PRD.md` §1.7 NFR "Privacy".
- `[ASSUMPTION]` The design goal is **radical data minimization**: browsing and matching are anonymous and persist nothing (there is no `student_profiles` table — `DATABASE.md` §2); an account exists only to save scholarships and set reminders. **One scoped, documented exception (FR20, `PRD.md` §4.3):** a signed-in user may explicitly opt in to a weekly digest, which persists their profile answers in `saved_profiles` — opt-in only, deletable anytime, and it does not change anonymous browsing/matching, which remains exactly as before.
- `[ASSUMPTION]` The app **never** accepts documents or scholarship applications; it links out to official portals. This keeps the highest-risk data (IDs, financial docs) off the system entirely (`PRD.md` §1.3 Non-Goals).

## 1. Security Objectives (SMART) — status against the real implementation

| Goal | Target | Status |
| --- | --- | --- |
| **SEC-G1 — Data minimization** | 0 sensitive personal fields (disability, indigenous status, income) ever persisted server-side **for anonymous matching** | **Met, with one scoped exception.** No `student_profiles` table exists; anonymous matching runs on an in-session `Profile` object only (`lib/actions/match-profile.ts`). FR20 adds `saved_profiles`, which persists a profile **only** for a signed-in user who explicitly opts in (never by default, never for anonymous matching) — see §0 and §3.9. |
| **SEC-G2 — Tenant isolation** | 100% of user-owned tables protected by default-deny RLS, proven by a two-user test | **Met, partially proven.** `saved_scholarships`/`reminders`/`push_subscriptions`/`saved_list_shares`/`saved_profiles` have owner-only RLS policies (`DATABASE.md` §5); `tests/integration/rls.test.ts` exists but is skipped unless `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` are set — it is not run by default (no CI, `DEPLOYMENT.md` §7). The FR19 share-link RPC and FR13's anon-write posture were verified manually against a local stack during development (real anon REST calls) — see §5. |
| **SEC-G3 — Link/data integrity** | 0 off-allowlist outbound "apply" links reach students | **Met, defense-in-depth.** Enforced independently at three layers: Zod refinement (`lib/types/admin.ts`), a Postgres trigger (`enforce_scholarship_url_allowlist`, `DATABASE.md` §6), and the underlying `is_allowlisted_url()`/`isAllowlistedUrl()` logic. Gap: the two implementations share no source of truth (§4). |
| **SEC-G4 — Secret safety** | 0 privileged secrets in any client-shipped file | **Met.** `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `GROQ_API_KEY` / `LLM_API_KEY` are read only in server actions / Route Handlers (`DEPLOYMENT.md` §2); nothing under `components/` or a `"use client"` file touches them. |
| **SEC-G5 — Recoverability** | Clean environment rebuildable from git migrations + seed in <30 min | **Met by construction.** Forward-only migrations in `supabase/migrations/`, no schema changes outside them (`docs/iskolar-version-control.md`). |
| **SEC-G6 — Injection resistance** | 100% of server-action inputs pass a Zod schema rejecting unknown fields; 0 raw string-interpolated SQL | **Met.** All server actions validate via `.strict()` Zod schemas under `lib/types/`; all DB access goes through `@supabase/supabase-js`, no raw SQL string building anywhere in the app. |

## 2. Assets & Trust Boundaries

| # | Asset | Why it matters | Primary threat |
| --- | --- | --- | --- |
| A1 | **Curated scholarship data** (records, deadlines, official/apply URLs) | The product's entire value, and a safety surface — a bad link can phish a minor or cause a missed deadline | Tampering, integrity loss, deletion |
| A2 | **Users' minimal PII** (email; saved lists; reminders) | Belongs to students, many minors; regulated under RA 10173 | Unauthorized read (RLS bypass), breach |
| A3 | **Admin/curator account** | Can publish, edit links, approve future ingestion — the keys to A1 | Account takeover, privilege escalation |
| A4 | **Service-role key & provider secrets** (Supabase, Resend, CRON_SECRET, GROQ_API_KEY / LLM_API_KEY) | Bypasses RLS entirely; sends mail as the brand; authorizes cron writes; bills the extraction provider account | Secret leakage |
| A6 | **Source-watcher outbound fetch** (FR10) | Pulls arbitrary registered URLs from a server function — an SSRF lever if unbounded | SSRF to internal/metadata endpoints, oversized-response DoS |
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
`app/api/cron/refresh-deadlines`, `send-reminders`, and `send-digest` (FR20) all require a `CRON_SECRET` bearer token, checked with `timingSafeEqual` (`lib/security/verify-cron-secret.ts`) — constant-time comparison, with an explicit length check first to avoid the function throwing on mismatched lengths. All three return `401` on failure.

### 3.6 Data access & RLS
Every table has RLS enabled; content tables have no write policy for any client-facing role (service-role only); user-owned tables (`saved_scholarships`, `reminders`, `push_subscriptions`, `saved_list_shares`, `saved_profiles`) are strictly `auth.uid()`-scoped; `admin_users` allows only a self-read; `audit_log` is admin-read-only via a `SECURITY DEFINER` function, with no write policy for any role. Full policy list in `DATABASE.md` §5 — this doc intentionally doesn't duplicate it.

### 3.7 Audit trail
Every admin mutation (`lib/actions/admin.ts`) writes an `audit_log` row via `logAudit()` — actor, action, entity type/id, a jsonb detail blob. Append-only: no update/delete policy exists for any role.

### 3.8 Secrets
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `GROQ_API_KEY` are read only in server-side code (`DEPLOYMENT.md` §2); `.env.example` documents the full, exhaustive set — confirmed by grepping the codebase for `process.env.` usage. `VAPID_PRIVATE_KEY` (FR18, Web Push) follows the same rule — read only in `lib/push/send-push-notification.ts`; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is, by design, the one half of the pair meant to reach the browser (it's a public key, not a secret). `GROQ_API_KEY` (FR10, source-watcher) — and the optional alternate-provider `LLM_API_KEY` that supersedes it — are read only in `lib/groq/client.ts` (guarded by `import 'server-only'`).

### 3.9 New anon-write and read paths added by the v2 backlog (`PRD.md` §4)
- **FR13 "report an issue"** (`lib/actions/reports.ts`) is the app's **first anon-facing write**. It is explicitly NOT given its own `anon` RLS insert policy — `scholarship_reports` has RLS enabled with zero policies (`DATABASE.md` §5), matching `allowlisted_domains`. Submission goes through a rate-limited (5 req/60s per IP) Server Action using the service-role client, so "no write policy exists for `anon` on any table" (§0) stays literally true. Verified manually: a direct anon REST call to `scholarship_reports` returns `permission denied` (`42501`).
- **FR19 shareable saved list** (`lib/actions/share.ts`, `lib/data/get-shared-saved-list.ts`) never exposes `saved_scholarships`/`saved_list_shares` to `anon` directly. The only read path is `get_shared_saved_list()`, a `SECURITY DEFINER` RPC (`DATABASE.md` §6) returning a narrow, explicit column allowlist (scholarship title/slug/provider/deadline only — never `user_id` or email). Verified manually against a local stack: the real anon REST RPC call returns only those columns; direct anon REST reads of both underlying tables return `permission denied`.
- **FR18 Web Push** (`lib/push/send-push-notification.ts`, `public/sw.js`) subscriptions (`push_subscriptions`) are owner-scoped like `reminders`; an expired subscription (404/410 from the push service) is pruned automatically. A push failure never blocks the primary email reminder from sending or being marked sent.
- **FR20 opt-in digest** (`lib/actions/saved-profile.ts`) is the sole exception to the zero-persisted-profile posture — see §0 and SEC-G1. It re-validates with the same `profileSchema` the anonymous match path uses (so a saved profile can never contain a field the matching engine wouldn't accept), is fully owner-CRUD (view/toggle/delete anytime), and the near-miss guidance text it surfaces (FR14) is curator-authored, never model-generated.

### 3.10 Source-watcher fetch & write posture (FR10, Phase 2)
The source-watcher pulls arbitrary registered URLs from a server function (asset A6), so its outbound fetch (`lib/source-watcher/fetch-source.ts`) is treated as real SSRF attack surface with layered defenses, in order: (1) HTTPS only; (2) hostname must pass `isAllowlistedUrl()` — the same gov.ph/edu.ph/curated allowlist as the apply-link integrity control (SEC-G3), not merely trusted because it equals `official_url`; (3) every resolved IP is checked against `isPrivateIp()` (`lib/security/is-private-ip.ts`) to block private/loopback/link-local/cloud-metadata targets; (4) redirects are followed **manually**, re-running (2) and (3) on every hop so an allowlisted URL cannot 302 to an internal host; (5) the body is read under a hard byte cap and an overall timeout (oversized-response / hung-connection defense). The pure IP-range logic is unit-tested (`is-private-ip.test.ts`) and the fetch guards have a mocked-fetch test (`fetch-source.test.ts`).
- **Accepted residual risk:** a small DNS-rebinding TOCTOU window remains between the pre-flight `dns.lookup` and the actual connect. Accepted because the allowlist already restricts targets to registered gov.ph/edu.ph hosts (not attacker-chosen); pinning the validated IP via a custom `undici` agent is a future hardening step, not a blocker.
- **Write posture:** the watcher writes only to `source_documents`/`source_sections`/`scholarship_suggestions` via the service-role client (RLS-enabled, zero policies — same as `scholarship_reports`). It **never** writes to `scholarships` or any content table. No suggestion auto-publishes: `last_verified_at`/`verified_by` are stamped only by an explicit curator approval (`lib/actions/suggestions.ts`), which routes each field through the existing validated admin actions (Zod + URL allowlist + publish guard) and audit-logs. The watcher reads only public official pages and touches no student profile data, so it has no bearing on SEC-G1.

## 4. Known Gaps / Accepted Risks

Documented honestly rather than glossed over — revisit if the app's risk profile changes (more traffic, more admins, real user data at scale):

- **CSP allows `'unsafe-inline'`** for scripts and styles, because static prerendering is incompatible with per-request nonces as currently built. Mitigated by: no `dangerouslySetInnerHTML` with unsanitized input anywhere in the codebase, strict Zod validation everywhere, and RLS as the actual data-access boundary (CSP is defense-in-depth here, not the primary control).
- **Rate limiter is in-memory and per-instance** — resets on cold start, and a multi-instance deployment gives each instance its own counter (effectively raising the real limit). Acceptable at current traffic; would need a durable store (e.g. Upstash Redis) to hold under real abuse or horizontal scaling.
- **URL allowlist has no single source of truth** — the Postgres function and the TypeScript module enforce the same rule independently. A future change to one without the other is a silent drift risk. Consider generating one from the other, or moving the check to a single RPC call the app invokes instead of duplicating logic.
- **`CURATED_FOUNDATION_DOMAINS` / `allowlisted_domains` are empty** — only `*.gov.ph`/`*.edu.ph` are enforced today; foundation-domain curation is a planned but unbuilt feature.
- **No CI enforces the QA checklist.** `lint`/`typecheck`/`test`/`build` are run manually pre-push (`docs/iskolar-version-control.md` §7); a bad push can reach production if a step is skipped. The RLS integration test (`tests/integration/rls.test.ts`) additionally requires manual opt-in env vars and is not run by default.
- **Admin gating is not centralized** — a new admin route or action that forgets to call `requireAdmin()` would be reachable by any authenticated user (though still blocked from writing by RLS, §3.4). Worth a shared layout/wrapper if the admin surface grows past a few pages.
- **`updated_at` on `scholarships` is not auto-refreshed** by a trigger — stale-timestamp risk if application code ever forgets to set it explicitly on an update path (`DATABASE.md` §7).
- **`scholarship_reports` rate limit (5/60s/IP, §3.3) is the same in-memory, per-instance limiter** as the rest of the app (§4 above) — the first anon-write path inherits that limiter's known scaling gap rather than getting a stronger one.
- **Web Push has no delivery-retry queue** — a failed push for a given reminder cycle is simply dropped (email remains the primary, also-not-retried channel); only an *expired* subscription is pruned. Acceptable since push is explicitly "alternative/addition to," not a replacement for, email (`PRD.md` §4.3 FR18).

## 5. Security Test Checklist

- [x] `lib/security/url-allowlist.test.ts` — gov.ph/edu.ph acceptance, rejection of non-matching hosts, malformed URLs, subdomain-spoofing attempts (`gov.ph.attacker.net`, `notgov.ph.evil.com`).
- [x] `lib/matching/*.test.ts` — matcher never claims eligible on missing/unknown data (conservative-by-construction, SEC-related since a false "eligible" is a trust failure).
- [x] `lib/deadline/compute-status.test.ts` — date-boundary correctness (Asia/Manila pinning), relevant to SEC-G3 (0 stale-open scholarships).
- [ ] `tests/integration/rls.test.ts` — exists, covers anon read-published/no-write/no-`allowlisted_domains`-read, but **is not run by default** (requires `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` against a local Supabase stack). Run it manually before any RLS policy change; consider wiring into CI once CI exists. **Not yet extended** to cover `scholarship_reports`/`push_subscriptions`/`saved_list_shares`/`saved_profiles` (verified manually instead, see below) — worth adding as real test cases.
- [ ] Two-user manual test that user A cannot read/write user B's `saved_scholarships`/`reminders` via the anon/authenticated client — not automated; do this manually before a release if RLS policies change.
- [ ] Admin-route smoke test that an unauthenticated/non-admin session is redirected — not currently in the Playwright suite (which deliberately skips DB-backed routes, `ARCHITECTURE.md` §9).
- [x] **(FR13/FR19, verified manually during v2 development)** Against a local Supabase stack: direct anon REST reads of `scholarship_reports`, `push_subscriptions`, and `saved_list_shares` all return `42501 permission denied`; the real anon REST RPC call to `get_shared_saved_list()` returns only scholarship-facing fields (no `user_id`/email) for a valid slug, and an empty result for an invalid one. Not yet captured as an automated `tests/integration/rls.test.ts` case.
- [x] **(FR20, verified manually)** A saved-profile digest run against a live local stack correctly leaves `notified_scholarship_ids` untouched when the email send fails (placeholder Resend key), confirming a failed send is retried on the next cron run rather than silently marked done.

## 6. Incident Response

- **Secret leak (any of `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `GROQ_API_KEY` / `LLM_API_KEY`):** rotate in the relevant provider dashboard (Supabase/Vercel env vars/Resend/Groq or the configured `LLM_BASE_URL` provider, e.g. Google AI Studio) **first**, then deal with git history if it was ever committed — never the reverse order (`CLAUDE.md` standing instruction).
- **Suspected RLS bypass or data leak:** check `audit_log` for unexpected `service_role`-path writes; the append-only, admin-read-only design means the log itself can't be tampered with from a compromised `authenticated` session.
- **Bad/phishing link published:** the DB trigger should have rejected it at insert/update time; if one somehow got through (e.g. inserted before the trigger existed, or via a since-fixed allowlist bug), unpublish the scholarship (`is_published = false`) via the admin tool immediately, then fix the allowlist gap that let it through.
