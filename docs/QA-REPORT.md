# IskolarMatch — Whole-System QA Report

_A full-stack quality assessment: frontend, backend, data pipelines, database, security, tests, and deploy/CI config. Companion to `QA-CHECKLIST.md` (the actionable, prioritized fix list a dev agent can execute against)._

**Repo:** iskolarmatch · **Branch audited:** `sub-xyrille` · **Audit date:** 2026-07-22
**Stack:** Next.js 16.2.10 (App Router, Turbopack) · React 19.2.4 · Supabase (SSR + service-role) · Tailwind v4 (CSS-first) · Zod v4 · TypeScript strict · Vitest 4 · Playwright

---

## Resolution status — 2026-07-23 ✅

This report is a **snapshot of the 2026-07-22 audit** and is kept intact as the record of what was found. Every item has since been worked through against `QA-CHECKLIST.md`; per-item closing commit SHAs live there.

- **All three risk concentrations from §1 are closed.** CI now exists and enforces the gates (`.github/workflows/ci.yml`); the human-approval trust boundary and RLS policies have automated tests that actually run (in CI); the I/O-layer robustness gaps (audit-log error, unbounded crons, input-validation consistency, error-swallowing) are fixed.
- **P0–P2 (22 items): fully implemented and tested.** **P3 (12 items): 6 implemented, 4 accepted trade-offs left unchanged by design (P3-03/04/08/09), 2 deferred with a documented path forward** — P3-02 (DB-backed e2e) needs a CI-provisioned stack; P3-06 (route-group layout) was attempted and cleanly reverted because the running editor/dev-server held Windows file locks on `app/auth`, `app/s`, `app/shared`.
- **Gates after close-out (2026-07-23):** typecheck ✅, lint ✅, **test ✅ 256 passed / 1 skipped (RLS, CI-only)**, build ✅, and `npm run test:coverage` ✅ passes its floors (statements 45 / branches 42 / functions 43 / lines 45).

The section-by-section findings below are preserved as originally written (verdicts reflect the audit-time state, not the post-fix state).

---

## 0. How to read this report

- This is a **snapshot audit**, not a spec. Where it names a file/line, verify it still exists before acting — the tree moves.
- Findings are cross-referenced to `QA-CHECKLIST.md` by ID (e.g. **[P1-04]**). Severity there is **priority/risk**, not "the build is broken." **Nothing in this report blocks the app from compiling, linting, testing, or building today** — every automated gate is green (§3). The issues are robustness, coverage, consistency, and process gaps that matter for a portfolio-grade app.
- Verdicts use: **✅ Strong / verified** · **⚠️ Concern** · **🔴 Priority gap**.

---

## 1. Executive summary

IskolarMatch is a disciplined, security-conscious codebase. The pure domain core (matching, deadline, trust, security predicates) is fail-closed and well-tested; every database table has RLS enabled; all five cron endpoints authenticate with a constant-time secret compare; the outbound-fetch pipeline layers real SSRF defenses; and there is **no auto-publish anywhere** — every write to real scholarship data passes a human reviewer and the same validated admin actions. Static-analysis hygiene is excellent: **zero** `TODO`/`FIXME`/`HACK`, `any`, `@ts-ignore`, `console.log`, or `eslint-disable` across `lib/`, `app/`, `components/`, and `tests/`.

The risk is concentrated in three places:

1. **Process** — there is **no CI**. Every quality gate is manual (§3, §10).
2. **Verification of the trust boundary** — the security-critical human-approval gates (suggestion approval, candidate promotion, admin auth) and the RLS policies have **no automated test that actually runs** (§9).
3. **I/O-layer robustness** — a genuinely swallowed audit-log error, inconsistent input validation, unbounded cron loops, and error-swallowing that hurts observability (§5, §6).

None are runtime-breaking today; all are worth closing before this is presented as production-grade.

### Automated gate results (this audit)

| Gate | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | ✅ **Pass** — no errors |
| Lint | `npm run lint` | ✅ **Pass** — no errors/warnings |
| Unit tests | `npm run test` | ✅ **Pass** — 162 passed, **1 skipped** (RLS integration), 22 files |
| Build | `npm run build` | ✅ **Pass** — compiled 35.8s, 19/19 static pages, no errors |
| E2E | `npm run test:e2e` | ⚠️ **Not run in this audit** — 4-page static smoke only (`tests/e2e/smoke.spec.ts`) |

---

## 2. Methodology

- **Static review** of every subsystem: all route segments under `app/`, all `components/`, the full `lib/` domain + I/O layers, all 14 SQL migrations + `seed.sql`, all cron routes, and the two crawler pipelines.
- **Automated gates** executed locally on the audited branch: typecheck, lint, unit tests, production build (results in §3).
- **Spec cross-check** against `docs/SECURITY.md`, `docs/DATABASE.md`, and `docs/iskolar-version-control.md` (the standing QA gate).
- **Not covered** (out of scope / needs a live environment): runtime penetration testing, real LLM-extraction quality (the `eval:source-watcher` harness is opt-in and makes real API calls), load/perf testing, and the RLS integration test (requires a local Docker Supabase stack).

---

## 3. Automated quality gates

| Gate | Detail |
| --- | --- |
| **Typecheck** | `tsc --noEmit` under `strict: true`. Clean. No `any`/`@ts-ignore` escape hatches anywhere. |
| **Lint** | Flat `eslint.config.mjs` extending `eslint-config-next` (core-web-vitals + TS). Clean. No custom/security rules configured (see **[P3-05]**). |
| **Unit tests** | Vitest, node env, `server-only` stubbed. **162 passed / 1 skipped / 22 files.** The skip is `tests/integration/rls.test.ts`, which self-skips without `TEST_SUPABASE_URL` + a local stack — see §9 / **[P0-03]**. Duration ~5.4s. **No coverage threshold configured** despite `@vitest/coverage-v8` being installed (**[P3-05]**). |
| **Build** | `next build` (Turbopack) compiles cleanly and prerenders 19/19 static pages. The route table **confirms** the rendering finding in §4: `/` and `/trust` are `○ Static (revalidate 1h)`, but `/scholarships` is `ƒ Dynamic` despite declaring `revalidate = 3600` — the ISR directive is inert (**[P2-01]**). |

**Verdict:** ✅ The app is green on all four core gates. The gap is not gate *failures*, it's that nothing runs these gates automatically (§10).

---

## 4. Frontend / UI  ⚠️

**Strong ✅**

- Accessibility is a genuine strength: skip-to-content link, `<main id="main-content">` on every page, semantic `<fieldset>/<legend>`, `<dl>`, `<nav aria-label>`; `role="status"`+`aria-busy` on all loading states, `role="alert"` on form errors, `aria-pressed`/`aria-live` where appropriate; status is **never color-alone** (always paired with a word or ✓/✕ glyph); a blanket `prefers-reduced-motion` kill-switch; consistent 44px touch targets. No `<img>` anywhere → no alt-text debt.
- Route-level loading skeletons (`app/*/loading.tsx`) mirror each page's rhythm and are correctly `aria-hidden` with the container owning status.
- Server/client component split is deliberate and correct; only one `dangerouslySetInnerHTML` exists (the boot splash, a static internal string).
- Clean: no `console.log`, no `any`, no `TODO`/`FIXME` in `app/` or `components/`.

**Concerns ⚠️**

| # | Finding | Location | Ref |
| --- | --- | --- | --- |
| 1 | **ISR directive inert.** `revalidate = 3600` is set but `await searchParams` forces per-request dynamic rendering — confirmed `ƒ Dynamic` in the build output. Intent ("regenerated hourly") ≠ behavior. | `app/scholarships/page.tsx` | **[P2-01]** |
| 2 | **Two divergent design systems.** Public UI uses editorial tokens (`--ink`/`--paper`/`--line`/`--status-*`); every admin page/panel uses raw default-Tailwind (`text-red-700`, `bg-amber-100`, `border-black/20`) with no shared tokens and no header/footer chrome. | `app/admin/**`, `components/admin/**` | **[P2-02]** |
| 3 | **No segment-level error/loading boundaries.** Only root `error.tsx`/`loading.tsx` exist; on an admin route they render the **public** `SiteHeader`/`SiteFooter` that admin pages otherwise never use. `/match`, `/saved`, `/s/[slug]`, `/shared/[slug]` also lack segment error boundaries. | `app/` | **[P2-03]** |
| 4 | **Errors not programmatically tied to fields.** `role="alert"` paragraphs surface errors, but inputs lack `aria-invalid`/`aria-describedby`. Some inputs use `focus:outline-none` with only a 1px border-color change; admin inputs define no custom focus ring at all. Borderline WCAG 2.4.7. | `components/match/match-form.tsx`, `components/auth/auth-form.tsx`, `components/saved/*`, admin panels | **[P2-06]** |
| 5 | **PWA color mismatch.** `viewport.themeColor = "#ffffff"` vs manifest `theme_color = "#0a0a0a"`. | `app/layout.tsx`, `app/manifest.ts` | **[P2-07]** |
| 6 | **Duplicated/aging constants.** `"http://localhost:3000"` site-URL fallback is copy-pasted across 5 files; hardcoded `© 2026` / `est. 2026` will silently go stale. | `layout.tsx`, `saved/page.tsx`, `sitemap.ts`, `robots.ts`, `manifest.ts`, `site-footer.tsx`, `page.tsx` | **[P2-08]** |
| 7 | **No dark mode** despite a token architecture that could support it; `colorScheme` is hard-pinned to light. | `app/globals.css`, `app/layout.tsx` | **[P3-04]** |
| 8 | **Repeated per-page chrome** instead of a route-group layout — every public page + `loading.tsx` re-imports `<SiteHeader>/<SiteFooter>` (drift risk). | `app/**` | **[P3-06]** |
| 9 | **Read-heavy public detail pages are `force-dynamic`** (`/s/[slug]`, `/shared/[slug]`) — every hit does Supabase reads with no caching; a perf/cost concern at scale. | `app/s/[slug]/page.tsx`, `app/shared/[slug]/page.tsx` | **[P3-07]** |

---

## 5. Backend / server & domain logic  ⚠️

**Strong ✅**

- **Matching engine** (`lib/matching/*`) is pure, I/O-free, and **fully unit-tested**: fails closed (a missing profile field = failed rule, never inferred), buckets by mandatory-fail count, stable deadline-then-coverage ranking, exhaustive `never` checks. This is the best-tested area.
- Every server/service-role module is guarded by `import "server-only"`. Secrets are read from `process.env` at call time — none hardcoded. The service-role client explicitly refuses a `NEXT_PUBLIC_` key.
- Most server actions validate with Zod `.strict()` and derive `user_id` from the session (never a parameter); admin writes all pass `requireAdmin()` + `logAudit` + `revalidatePath`.

**Concerns ⚠️**

| # | Finding | Location | Ref |
| --- | --- | --- | --- |
| 1 | **Genuinely swallowed audit-log error.** The `audit_log` insert is `await`ed but its `{ error }` is never checked — a compliance-path write (SECURITY §3.7) can fail silently while the privileged mutation succeeds. | `lib/actions/log-audit.ts` (~line 15) | **[P1-01]** |
| 2 | **`requireAdmin` correctness lives in SQL, not TS.** `from("admin_users").select("user_id").maybeSingle()` has no explicit `.eq("user_id", user.id)`; it is safe **only** because the authenticated client's RLS scopes to `auth.uid()`. An RLS regression or a refactor to a service-role client would let any admin row pass. | `lib/auth/require-admin.ts:23` | **[P1-02]** |
| 3 | **Inconsistent input validation.** `subscribeToPush` inserts `endpoint`/`keys.p256dh`/`keys.auth` with **no Zod schema** (the only action without one). `saved.ts` takes `scholarshipId` as a raw string while `application-tracker.ts` validates the same value with `.uuid()`. RLS/FK constraints mitigate, but validation should be uniform. | `lib/actions/push.ts`, `lib/actions/saved.ts` | **[P1-04]**, **[P2-05]** |
| 4 | **Service-role getters rely on caller-side auth.** Seven `get-admin-*`/suggestion/provider data functions use the service-role client and only *comment-assert* they run after `requireAdmin()` — no in-function guard. Correct at every current call site; no defense-in-depth if one is imported into an ungated page. | `lib/data/get-admin-*.ts`, `get-staleness-worklist.ts`, `get-scholarship-reports.ts`, `get-providers.ts`, `get-suggestions-queue.ts` | **[P2-04]** |
| 5 | **Silent sub-query degradation.** Reminder/progress/checkoff sub-queries drop their `error` (only the main query throws) — a partial DB failure renders as "no reminder / no progress," indistinguishable from real absence. | `lib/data/get-saved-scholarships.ts` | **[P2-03b]** |
| 6 | **Runtime-unchecked casts.** `as unknown as Row[]` is pervasive on Supabase joins across `lib/data/*` and the DB-reading match/digest paths. Not `any`, but a query/schema drift surfaces as an undefined-access at render, not a caught error. | `lib/data/*`, `lib/actions/match-profile.ts`, `app/api/cron/send-digest/route.ts` | **[P2-08b]** |

---

## 6. Data pipelines (source-watcher · source-discovery · crons)  ⚠️

**Strong ✅**

- **All 5 cron routes** share one hardened shape: `verifyCronSecret` (constant-time Bearer compare, fail-closed if the secret is unset) → `401` → service-role client → JSON summary.
- **All 5 crons are idempotent**: `refresh-deadlines` only updates rows whose status actually changed; `send-reminders` is `sent_at`-guarded; `send-digest` is `notified_scholarship_ids`-guarded; `watch`/`discover` use content-hash change-gates + DB dedupe indexes.
- **Source-watcher (FR10)** is a clean perceive→gate→retrieve→reason→diff→score→file→human-approve loop. Unchanged pages skip the LLM entirely (cost control). The LLM step drops ungrounded citations and fail-safes to `[]`.
- **Source-discovery (FR22)** is robots.txt-compliant (self-identifying UA), grounds LLM link-selection by returning indexes into a pre-filtered anchor list, and **never auto-publishes** — promotion creates a `is_published=false` draft from curator-reviewed form fields via the validated `upsertScholarship`.
- SSRF defense in `fetch-source.ts` is layered and real: HTTPS-only → allowlist → resolved-IP public check → per-hop redirect re-validation → byte cap + timeout.

**Concerns ⚠️**

| # | Finding | Location | Ref |
| --- | --- | --- | --- |
| 1 | **Unbounded cron loops.** `send-reminders` and `send-digest` process **all** due rows with external calls (Resend, Web Push, `auth.admin.getUserById`) and declare **no `maxDuration`/batch cap** — unlike `watch`/`discover`, which do. Timeout/partial-completion risk as users grow. | `app/api/cron/send-reminders/route.ts`, `send-digest/route.ts` | **[P1-05]** |
| 2 | **Error-swallowing hurts observability.** `upsert-suggestions.ts` drops insert/update errors (only increments on success); `run-discovery.ts` counts *every* insert failure as `duplicatesSkipped`, masking real constraint/allowlist failures as benign dupes. | `lib/source-watcher/upsert-suggestions.ts`, `lib/source-discovery/run-discovery.ts` | **[P2-09]** |
| 3 | **Orchestrators & the LLM boundary are untested.** `run-watch.ts`, `run-discovery.ts`, `run-extraction.ts`, `extract-candidate.ts`, `select-listing.ts`, `groq/client.ts`, and both normalizers have no unit tests; the eval harness is opt-in and excluded from any gate, so extraction quality is unmeasured automatically. | `lib/source-watcher/*`, `lib/source-discovery/*`, `lib/groq/client.ts` | **[P1-06]** |
| 4 | **Uneven cron runtime budgets.** `refresh`/`reminders`/`digest` declare no `runtime`/`maxDuration`; the two crawlers pin `runtime="nodejs"`, `maxDuration=60`. Intentional, but worth making explicit alongside #1. | `app/api/cron/*` | **[P1-05]** |

---

## 7. Database & RLS  ✅ (with one test gap)

**Strong ✅**

- **Every table has RLS enabled — none is missing it.** Two deliberate postures: owner-scoped (`user_id = auth.uid()`) for user data, and zero-policy service-role-only for admin/pipeline/moderation tables. No anon write policy exists anywhere; public writes go through rate-limited service-role Server Actions.
- Migrations are forward-only and legible; `0006_grant_table_privileges` correctly separates GRANTs from RLS (a real bug this fixed). `audit_log` reads via a `security definer is_admin()` to avoid a circular RLS dependency. `saved_list_shares` exposes anon data only through a narrow `security definer` RPC that returns scholarship fields, no PII.
- Indexes match hot queries, including partial indexes (due reminders, unresolved reports, pending suggestions/candidates) and pending-dedupe unique indexes.
- `seed.sql` deliberately includes an unpublished draft to prove RLS filters it.

**Concerns ⚠️**

| # | Finding | Ref |
| --- | --- | --- |
| 1 | **The only DB-security test never runs automatically.** `tests/integration/rls.test.ts` self-skips without a local Docker Supabase stack + env vars; with no CI it is effectively dormant. It also **omits** the FR22 discovery tables and ~8 owner-scoped tables (reminders, saved_scholarships, push_subscriptions, saved_profiles, saved_list_shares, admin_users, audit_log, scholarship_reports). | **[P0-03]** |
| 2 | **Hand-synced invariants with no drift test.** The DB `eligibility_rules` field CHECK mirrors `lib/types/profile.ts`; the `scholarship_suggestions` field-allowlist CHECK mirrors `ALLOWED_FIELDS_BY_TABLE`. Comments say "kept in sync manually" — a parity test would prevent silent drift. | **[P2-10]** |

---

## 8. Security  ✅

**Strong ✅** — This is a highlight of the codebase.

- Constant-time cron-secret compare (`timingSafeEqual`, length pre-check, fail-closed).
- Layered SSRF defense + DB-level URL-allowlist triggers + `is-private-ip` (rejects loopback/link-local/CGNAT/cloud-metadata/IPv6 ULA, fails closed on unrecognized input) — both are unit-tested.
- Open-redirect guard on the magic-link `next` param; admin role checked against a trusted table, never a client claim; no auto-publish path to real data.
- Security headers set in `next.config.ts` (nosniff, Referrer-Policy, X-Frame-Options DENY, HSTS).

**Concerns / accepted trade-offs ⚠️**

| # | Finding | Ref |
| --- | --- | --- |
| 1 | **In-memory rate limiter** resets on cold start / is per-instance in serverless. Documented, acceptable at MVP scale; revisit with Upstash if abuse appears. | **[P3-08]** |
| 2 | **CSP uses `script-src 'unsafe-inline'`** and is production-only. A documented, deliberate trade-off (nonce approach was reverted for static prerender) — flagged so it stays on the radar, not as a defect. | **[P3-03]** |
| 3 | **Documented DNS-rebinding TOCTOU** window in `fetch-source.ts` — accepted risk, mitigated by the allowlist. | **[P3-09]** |
| 4 | **No central env validation** — 15 secrets/config vars are read ad hoc with inconsistent fallbacks (cron/groq fail closed; `proxy.ts`/email degrade *silently* — a missing Supabase var makes session refresh a silent no-op). | **[P1-03]** |

---

## 9. Testing & coverage  🔴

**Covered well ✅** — pure logic: all of `lib/matching`, `lib/deadline/compute-status`, `lib/trust/*`, `lib/browse/filter`, `lib/tracker/progress`, `lib/types/*`, `lib/security/url-allowlist` + `is-private-ip`, and the pure `source-watcher`/`source-discovery` helpers (section-hash, change-gate, fetch-source, diff, score, dedupe, robots, slugify). 162 passing assertions.

**Untested — the material gaps 🔴**

| Area | What's untested | Ref |
| --- | --- | --- |
| **Trust-boundary actions** | `lib/actions/suggestions.ts` (approve → writes real scholarship data), `lib/actions/discoveries.ts` (promote → creates scholarships), `lib/auth/require-admin.ts`. The optimistic-concurrency guard, field-allowlist enforcement, and draft-only-promotion invariants are **unverified by any automated test**. | **[P0-02]** |
| **All server actions** | admin, match-profile, auth, saved, reports, push, share, saved-profile, application-tracker, source-pages, log-audit. | **[P1-07]** |
| **All cron routes** | zero route-level tests for any of the 5. | **[P1-07]** |
| **Pipeline orchestrators + LLM** | `run-watch`, `run-discovery`, `run-extraction`, `extract-candidate`, `select-listing`, `groq/client`, normalizers. | **[P1-06]** |
| **RLS** | integration test dormant + incomplete table coverage (see §7). | **[P0-03]** |
| **E2E** | `smoke.spec.ts` is 4 static pages + header assertions only — no DB-backed flow, matching result, or admin-approval journey. | **[P3-02]** |
| **Coverage** | `@vitest/coverage-v8` installed but no `coverage` block, script, or threshold. | **[P3-05]** |

---

## 10. Config / build / deploy / CI  🔴

**Strong ✅**

- `tsconfig` strict + `@/*` alias; security headers wired in `next.config.ts`; Turbopack root pinned to avoid a stray-lockfile mis-root; `.env.example` documents all 15 vars; `.gitignore` covers `.env*`/`.next`/`node_modules`; Dependabot configured (npm + actions, weekly).

**Concerns 🔴**

| # | Finding | Ref |
| --- | --- | --- |
| 1 | **No CI.** `.github/` contains only `dependabot.yml` — **no `workflows/` directory**. Lint, typecheck, unit tests, build, and Playwright are entirely manual (the version-control doc's pre-push gate is a human checklist). `playwright.config.ts` even branches on a `CI` env var that is never set. This is the single highest-leverage gap: every guarantee in this report depends on a person remembering to run the gates. | **[P0-01]** |
| 2 | **No central env validation / fail-fast** at startup (see §8). | **[P1-03]** |
| 3 | **Bleeding-edge toolchain** — `typescript@^7`, `eslint@^10`, `@types/node@^26`, `vitest@4`. Green today, but a floating-major toolchain raises breakage risk and is another reason to pin a CI matrix. | **[P3-01]** |
| 4 | **README is still create-next-app boilerplate** — no project description, setup, env, or run instructions for a portfolio-grade repo. | **[P3-10]** |

---

## 11. Accessibility (summary)

Covered inline in §4. **Verdict: ✅ Strong**, with two concrete gaps to close: (a) tie form errors to their inputs via `aria-invalid`/`aria-describedby` (**[P2-06]**), and (b) give every interactive input a visible, WCAG-2.4.7-compliant focus ring — especially the admin panels, which currently rely on UA defaults. No image alt-text debt; reduced-motion respected; color never used alone.

---

## 12. Overall verdict & risk posture

| Layer | Verdict |
| --- | --- |
| Frontend / UI | ✅ Strong · ⚠️ consistency (admin vs public tokens), ISR-inert route, a11y error-binding |
| Backend / domain | ✅ Strong core · ⚠️ swallowed audit error, uneven validation, implicit-RLS authz |
| Pipelines / crons | ✅ Strong design · ⚠️ unbounded loops, error-swallowing, untested orchestrators |
| Database / RLS | ✅ Strong · 🔴 security test dormant |
| Security | ✅ Strong · ⚠️ no central env validation, documented CSP/rate-limit trade-offs |
| Testing | 🔴 Trust-boundary + I/O layers untested |
| Config / CI | 🔴 No CI |

**Bottom line:** The engineering is above the bar for a portfolio project — fail-closed logic, real security thinking, clean static hygiene, all gates green. The work remaining is not bug-fixing but **hardening and proof**: stand up CI so the gates run automatically, write tests for the human-approval trust boundary and RLS, and close the handful of I/O-layer robustness gaps (audit-log error, cron caps, input-validation consistency). Execute `QA-CHECKLIST.md` in priority order and the app moves from "works and is well-built" to "demonstrably verified."

---

_Generated as a static + automated-gate audit on branch `sub-xyrille`. Re-run the four gates (`typecheck`, `lint`, `test`, `build`) after any fix; keep this report and the checklist in sync with the code as issues are closed._
