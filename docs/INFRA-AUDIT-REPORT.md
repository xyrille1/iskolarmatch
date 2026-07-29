# IskolarMatch — 13-Layer Infrastructure Audit Report

_The dated output of running `docs/INFRA-AUDIT-PROMPT.md`. That file is the reusable template — this
file is a point-in-time result plus the actionable checklist that came out of it. Re-run the prompt
after any structural change to auth, RLS, cron, or CI, and append a new **Run** entry below rather
than editing old findings in place._

**Companion to:** `INFRA-AUDIT-PROMPT.md` (the prompt template), `ARCHITECTURE.md`, `DEPLOYMENT.md`,
`SECURITY.md`, `DATABASE.md`, `iskolar-version-control.md`, `QA-CHECKLIST.md`
**Owner:** Xyrille

---

## Checkpoint — where we are right now

| | |
|---|---|
| **Last full run** | 2026-07-29, branch `sub-xyrille`, via 4 parallel subagents (layers 1–3, 4–6, 7–9, 10–13) |
| **Layers OK** | 6 / 13 (2, 3*, 4, 8, 9, 10) |
| **Layers DRIFT** | 4 / 13 (1, 5, 7, 13) — docs stale vs. actual repo contents |
| **Layers GAP** | 3 / 13 (6*, 11, 12, 13) |
| **Layers UNKNOWN** | 3 / 13 (3*, 5, 13) — need a live check, not more repo-reading |
| **Fixed since this run** | Nothing yet — this report documents the findings, checklist items below are still open |
| **Next action** | Work the checklist top-down (P0 first); P0-01 and P0-04 are pure doc edits doable without live access |

_\* Layers 3, 6, and 13 carry more than one status because a layer can be mostly OK with one open
sub-item — see the full table for the split._

**Not yet done, needs a human/live check (can't be closed by editing code):**
- Live magic-link smoke test against the deployed URL (P0-02)
- Vercel dashboard plan-tier check against the 5-cron ceiling (P2-01)
- GitHub Actions dashboard — confirm the `rls` job's latest run is green (P2-02)
- An actual timed `supabase db reset` + reseed drill (P2-03)

---

## Run: 2026-07-29

Audited by 4 parallel subagents against ground-truth docs + live code (not doc claims). Full method,
scope, and pass criteria per layer: see `INFRA-AUDIT-PROMPT.md`.

| # | Layer | Status | Evidence | Action needed |
|---|-------|--------|----------|----------------|
| 1 | Frontend Foundations | **DRIFT** | Rendering strategy matches ARCHITECTURE.md §3 (`app/page.tsx:24`, `app/trust/page.tsx:12` ISR 1h; `/match`, `/s/[slug]`, `/saved`, `/shared/[slug]`, all admin routes correctly `force-dynamic` with documented reasons). No client secrets leaked. A11y spot-check clean. **Drift:** ARCHITECTURE.md §9 claims client-side GWA validation exists; `match-form.tsx` has none — validation is server-only (`lib/actions/match-profile.ts:70-71`). `/contact`, `/faq`, `/terms` also missing from the §3 route table. | Fix ARCHITECTURE.md §9's wording and §3's route table. |
| 2 | APIs & Backend Logic | **OK** | Every `lib/actions/*.ts` derives `userId` from session, never a param; admin actions all call `requireAdmin()`; all `.strict()` Zod schemas present; cron secret check uses `timingSafeEqual` (`lib/security/verify-cron-secret.ts:14-18`), wired into all 5 cron routes. | None. |
| 3 | Database & Storage | **OK** (1 sub-item UNKNOWN) | RLS enabled on all 20 tables; GRANT migration `20260101000006` + later self-contained grants (0008–0014) cover every table. Migration history confirmed forward-only/additive via `git log`. | UNKNOWN: live status of CI's `rls` job (last GitHub Actions run) — check the Actions dashboard. |
| 4 | Auth & Permissions | **OK** | All 9 admin pages + every admin action call `requireAdmin()`. `proxy.ts` only refreshes session, doesn't gate. RLS confirmed as the real boundary — only SELECT policies exist for `anon`/`authenticated`; no client-writable INSERT/UPDATE/DELETE path anywhere. | None. |
| 5 | Hosting & Deployment | **DRIFT + UNKNOWN (critical)** | Env vars 1:1 with `.env.example`. **DRIFT:** DEPLOYMENT.md §4/§7 says "No CI configured" — false, `ci.yml` exists and is live. **UNKNOWN (critical):** Supabase magic-link email template + redirect-URL allowlist are Dashboard-only settings, invisible to the repo; failure mode is silent (visitor bounced to homepage). | Fix DEPLOYMENT.md's CI claim. Run a live magic-link smoke test against the deployed URL — cannot be verified from code. |
| 6 | Cloud & Compute | **OK** (1 sub-item open GAP, already documented) | All 4 LLM/DOM-touching crons set `runtime="nodejs"` + `maxDuration=60`; `vercel.json` matches the documented 5-cron schedule. | GAP (pre-existing, still unconfirmed): Vercel plan tier vs. 5-cron ceiling — check the Vercel dashboard. |
| 7 | CI/CD & Version Control | **DRIFT** | `.github/workflows/ci.yml` runs lint→typecheck→test→build, gitleaks, RLS-integration (boots local Supabase), and Playwright e2e — exactly as CLAUDE.md claims. DEPLOYMENT.md:84,105 and SECURITY.md:112 still say "No CI is configured" — both stale. `iskolar-version-control.md` is already accurate. | Update DEPLOYMENT.md §7 and SECURITY.md §4 to match reality. |
| 8 | Security & RLS | **OK** | SEC-G1–G6 individually re-verified against migrations/code (no `student_profiles` table; `auth.uid()`-scoped RLS on every user table; 3-layer URL allowlist consistent; zero client-reachable secrets; `.strict()` everywhere; CSP unchanged from documented trade-off). | None. |
| 9 | Rate Limiting | **OK** | `requestMagicLink` (5/60s), `submitProfileForm` (20/60s), `submitScholarshipReport` (5/60s) all confirmed wired. No other anon-facing write action found missing it. In-memory/per-instance limitation is the known, already-documented trade-off. | None. |
| 10 | Caching & CDN | **OK** | `/`, `/trust` ISR(1h); `/about`, `/privacy` static — matches ARCHITECTURE.md §3. No spuriously-dynamic routes. No raster images in the UI, so next/image is moot. | None (optionally add `/contact`, `/faq`, `/terms` to the doc's route table). |
| 11 | Load Balancing & Scaling | **GAP** (partially documented, partially new) | Rate limiter's in-memory state is the known documented gap. Supabase clients are per-request HTTP clients, not pooled — no connection-exhaustion risk. Cron batch sizes (`WATCH_BATCH_SIZE=10`, `DISCOVER_INDEX_BATCH_SIZE=3`) are untested against a larger catalogue — UNKNOWN whether they'll still fit the 60s budget as it grows. | No live check possible from repo; re-derive batch sizes once real per-item LLM latency is known. |
| 12 | Error Tracking & Logs | **GAP** | No APM/error-tracking SDK in `package.json` (no Sentry/Bugsnag/etc). `audit_log` is an admin-action trail only, doesn't cover exceptions. All 5 cron handlers just return a 500 JSON on failure with zero external alerting — a cron that fires and fails every day is invisible without manually checking the Vercel dashboard. | Add a minimal error-tracking SDK or at least an on-failure notification from cron handlers. |
| 13 | Availability & Recovery | **DRIFT + GAP + UNKNOWN** | **DRIFT:** DEPLOYMENT.md §5 describes migrations ending at `...012`; repo actually has 14 files through `...014_source_discovery.sql`. **GAP:** no keep-alive mitigation for Supabase free-tier auto-pause (asset A5), and no explicit "accepted risk" note either. **UNKNOWN:** no evidence a backup/restore or `db reset` timing drill was ever actually run — SEC-G5's "<30 min" is an assertion, not a measured result. SECURITY.md §6 incident-response text still references real, current files/tables. | Update DEPLOYMENT.md §5's migration range. Add an explicit accepted-risk note (or a keep-alive ping) for A5. Actually time a `supabase db reset` + reseed once. |

### Top 3 by risk (this run)

1. **Magic-link auth (Layer 5, UNKNOWN/critical)** — silent failure mode (visitor just bounces to the homepage), gates the only real auth flow in the app, unverifiable from code alone.
2. **Free-tier auto-pause with no mitigation (Layer 13, GAP)** — would silently take down the entire app; named as a risk in SECURITY.md but never mitigated or formally accepted.
3. **Cron failures are invisible (Layer 12, GAP)** — every cron handler swallows its own failure into an unwatched 500; directly affects the scholarship-deadline data students see.

---

## Checklist

Same conventions as `QA-CHECKLIST.md`: work top-down by priority, IDs are stable (reference in commits,
e.g. `fix(infra): P0-01 …`), check the box and add the closing commit SHA when done. 🔒 = touches the
security/trust boundary. Items marked **(live check)** need a human at a dashboard/URL, not more code.

**Legend:** Effort **S** ≤1h · **M** a few hours · **L** a day+

### P0 — Highest leverage / highest risk

#### [P0-01] Fix the "No CI configured" doc drift 🔒 · Effort S
- [ ] **Where:** `docs/DEPLOYMENT.md` §4/§7, `docs/SECURITY.md` §4.
- **Problem:** Both docs still assert "No CI is configured" / "No CI enforces the QA checklist." `.github/workflows/ci.yml` has existed and been live since at least `15a8186` (see `QA-CHECKLIST.md` P0-01). `iskolar-version-control.md` and `CLAUDE.md` already say CI is live — these two docs are the odd ones out.
- **Fix:** Rewrite the stale sections to describe the actual 4-job pipeline (`gates`, `secret-scan`, `rls`, `e2e`).
- **Done when:** No doc in `docs/` contradicts another on CI's existence.

#### [P0-02] Live magic-link smoke test 🔒 · Effort S (live check)
- [ ] **Where:** Supabase Dashboard (Auth → Email Templates, Auth → URL Configuration) + deployed production URL.
- **Problem:** The email template and redirect-URL allowlist are Dashboard-only settings not carried by any migration. Failure mode is silent — a visitor is bounced to the homepage with no visible error. Code side (`lib/actions/auth.ts:42`) looks correct but that's not sufficient.
- **Fix:** Sign in via magic link against the deployed URL; confirm it lands on `/auth/confirm` with `token_hash`/`type`/`next` intact.
- **Done when:** A real magic-link sign-in has been observed to work end-to-end in production, once — document the date it was last confirmed here.

#### [P0-03] Silent cron failures have no alerting 🔒 · Effort M
- [ ] **Where:** `app/api/cron/{refresh-deadlines,send-reminders,send-digest,watch-sources,discover-sources}/route.ts`.
- **Problem:** Every failure path returns a bare `NextResponse.json({error}, {status:500})`. No SDK, webhook, or email fires. A cron that fails every day is invisible without manually opening the Vercel dashboard.
- **Fix:** Add a minimal error-tracking SDK (e.g. Sentry free tier) or an on-failure notification (email/webhook) from each cron handler's catch block.
- **Done when:** A forced failure in any cron handler produces an observable signal outside the Vercel dashboard.

#### [P0-04] Supabase free-tier auto-pause has no mitigation or acceptance 🔒 · Effort S–M
- [ ] **Where:** `docs/SECURITY.md` §2 (asset A5), `docs/DEPLOYMENT.md`.
- **Problem:** Free-tier Supabase projects auto-pause on inactivity, which would silently take the whole app down. The risk is named in the asset table but never dispositioned — no keep-alive ping exists, and no doc says "accepted risk, here's why."
- **Fix:** Either add a lightweight keep-alive cron (careful: don't just add a 6th Vercel cron without re-checking P2-01's plan ceiling), or write an explicit accepted-risk note with rationale (e.g. "acceptable for a portfolio project, revisit before real traffic").
- **Done when:** A5 has either a working mitigation or a documented, deliberate acceptance — not silence.

---

### P1 — Doc drift (safe, no live access needed)

#### [P1-01] Fix ARCHITECTURE.md's client-side GWA validation claim · Effort S
- [ ] **Where:** `docs/ARCHITECTURE.md` §9.
- **Problem:** Claims client-side GWA range validation exists; `components/match/match-form.tsx` has no such validation. It's server-only, round-trip (`lib/actions/match-profile.ts:70-71`), and `tests/e2e/smoke.spec.ts:35-40` actually exercises the server-side path.
- **Fix:** Correct the wording to describe the real (server-side) validation path.
- **Done when:** §9 accurately describes what the e2e suite exercises.

#### [P1-02] Add missing routes to the ARCHITECTURE.md §3 route table · Effort S
- [ ] **Where:** `docs/ARCHITECTURE.md` §3.
- **Problem:** `/contact`, `/faq`, `/terms` exist as static pages but aren't listed.
- **Fix:** Add the three rows (all static, no revalidate).
- **Done when:** Every route under `app/` has a corresponding table entry.

#### [P1-03] Fix DEPLOYMENT.md §5's stale migration count · Effort S
- [ ] **Where:** `docs/DEPLOYMENT.md` §5.
- **Problem:** Describes migrations ending at `...012`; repo actually has 14 files through `20260101000014_source_discovery.sql`.
- **Fix:** Update the range/description to the current migration set.
- **Done when:** §5 matches `supabase/migrations/` exactly.

---

### P2 — Needs a live check, lower urgency

#### [P2-01] Confirm Vercel plan tier against the 5-cron ceiling · Effort S (live check)
- [ ] **Where:** Vercel Dashboard → Project → Settings.
- **Problem:** `vercel.json` defines 5 crons at `maxDuration=60`; whether the current plan (Hobby vs. Pro) actually supports that count/duration has never been confirmed — flagged as open in DEPLOYMENT.md §3/§7 since before this audit.
- **Fix:** Check the dashboard. If Hobby-tier caps below what's needed, move `discover-sources` (and/or `watch-sources`) to a GitHub Actions scheduled workflow per DEPLOYMENT.md's documented fallback.
- **Done when:** The plan tier is confirmed sufficient, or the fallback is implemented.

#### [P2-02] Confirm the CI `rls` job's latest run is green · Effort S (live check)
- [ ] **Where:** GitHub Actions dashboard for this repo.
- **Problem:** The `rls` job exercises the same "rebuild schema from git migrations alone" guarantee as `supabase db reset`, but its live pass/fail status isn't verifiable from the repo.
- **Fix:** Check the Actions tab.
- **Done when:** Confirmed green (or a red run is triaged).

#### [P2-03] Actually run and time a backup/restore (`db reset`) drill · Effort M (live check, needs Docker)
- [ ] **Where:** Local machine with Docker running.
- **Problem:** SEC-G5's "<30 min rebuild from migrations+seed" is an assertion about migration structure, not a measured result. No evidence in git history of it ever being timed.
- **Fix:** Run `npm run db:reset`, time it, record the result.
- **Done when:** A real timing exists and either confirms or revises the <30 min claim; record the date and duration here.

#### [P2-04] Re-derive cron batch sizes as the catalogue grows · Effort M (needs real usage data)
- [ ] **Where:** `lib/source-watcher/config.ts` (`WATCH_BATCH_SIZE`), `lib/source-discovery/config.ts` (`DISCOVER_INDEX_BATCH_SIZE`, `DISCOVER_MAX_DETAIL_PAGES_PER_RUN`).
- **Problem:** Current values (10 / 3 / 5) are untested against a catalogue meaningfully larger than today's; no evidence they still fit the 60s function budget at scale.
- **Fix:** Once real per-item fetch+LLM latency is known, re-derive safe batch sizes.
- **Done when:** Batch sizes have a documented basis (measured latency × budget), not a guess.

---

### Accepted trade-offs (no action — listed so they don't get re-flagged as new)

- Rate limiter is in-memory / per-instance / resets on cold start (`lib/security/rate-limit.ts`) — documented in `SECURITY.md` §4.
- CSP allows `unsafe-inline` for `script-src`/`style-src`, no `unsafe-eval` — documented trade-off for static prerendering without nonces (`SECURITY.md`, `next.config.ts:21-22`).
- `requireAdmin()` is per-call, not centralized in middleware — documented in `ARCHITECTURE.md` §10; RLS is the actual enforced boundary, not this check.
- URL allowlist logic exists as two independent implementations (TS + SQL) enforced at three call sites — documented single-source-of-truth gap in `SECURITY.md` §4, confirmed not to have drifted further.
