# IskolarMatch — Architecture

_System architecture, matching engine, deadline job, and route/action map for the Philippine scholarship discovery and matching tool. Describes the **current implementation**, not just the original design — see §10 for where it has diverged from the initial plan._

**Companion to:** `PRD.md`, `DATABASE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Next.js 16 (App Router) + TypeScript + Supabase (Postgres) + Tailwind
**Status:** Reflects the app as built — update this doc alongside any structural code change, don't let it drift

---

## 1. Overview

A read-heavy Next.js app over a Supabase Postgres database, implementing `PRD.md` §1.6 (FR1–FR9; FR10 is Phase 2 and not built) and §4's v2 feature backlog (FR11–FR20, all built). The differentiating logic is a **deterministic matching engine** (`lib/matching/`) implemented as pure TypeScript functions — no I/O, no LLM, fully unit-tested; FR14's near-miss guidance is curator-authored copy, not model-generated, so this stays true post-v2. Scholarship data is human-curated through an admin tool; deadline status, reminder emails/push, and the opt-in digest are recomputed by three **Vercel Cron**-triggered Route Handlers (not Supabase Edge Functions, see §6). There is no external service on the critical anonymous-match read path.

## 2. Tech Stack (as installed)

```
Language:    TypeScript (strict)
Framework:   Next.js 16.2.10 (App Router, Server Components + Server Actions), React 19.2.4
Styling:     Tailwind CSS 4
Database:    PostgreSQL via Supabase
Auth:        Supabase Auth (email magic link / OTP), session refreshed via proxy.ts (Next.js 16's
             renamed middleware convention) — see SECURITY.md §3 for what it does and doesn't gate
Security:    Supabase Row-Level Security (RLS) on every table — see DATABASE.md §5
Validation:  Zod 4 (.strict() schemas), shared under lib/types/
Data access: @supabase/ssr 0.12.3 + @supabase/supabase-js 2.110.7 (server client; service-role
             client only in server actions / route handlers, never shipped to the browser)
Scheduling:  Vercel Cron → Next.js Route Handlers (app/api/cron/*), not pg_cron/Edge Functions
Email:       Resend 6.17.2 (transactional reminders + FR20 digest)
Push:        web-push 3.6.7, VAPID-based Web Push (FR18) — no third-party push service, no per-message cost
Testing:     Vitest 4 (unit) + Playwright 1.61 (e2e, DB-independent pages only — see §9)
Hosting:     Vercel (app) + Supabase (data) — see DEPLOYMENT.md
```

## 3. Route Map (`app/`)

**Public (Server Components, no auth)**
| Route | Notes |
| --- | --- |
| `/` | Landing page, static |
| `/about` | "How it works," static |
| `/privacy` | RA 10173 privacy notice, static |
| `/trust` | **(FR11)** Public data-freshness dashboard, ISR (1h) |
| `/scholarships` | **(FR17)** Browse/filter/search without a profile; `searchParams`-driven, zero-JS `<form method="get">` |
| `/match` | `force-dynamic` (reads auth cookie to decide whether to offer the FR20 digest opt-in); server wrapper around client `match-experience.tsx` (form → results); calls `submitProfileForm` |
| `/s/[slug]` | Scholarship detail, `force-dynamic` (reads auth cookie to show save/reminder state); includes the FR13 "report an issue" form and the FR21 tracker surface — application-status control + requirement checklist (persisted for signed-in users, ephemeral with a sign-in nudge for anon) |
| `/shared/[slug]` | **(FR19)** Read-only shared saved-list view, `force-dynamic`; resolves exclusively through the `get_shared_saved_list()` RPC (`DATABASE.md` §6) |

**Auth**
| Route | Notes |
| --- | --- |
| `/auth` | Sign-in page; client `auth-form.tsx` calls `requestMagicLink` |
| `/auth/confirm` (Route Handler) | Verifies Supabase OTP (`token_hash`+`type`), redirects to a sanitized same-site `next` path |

**Session-gated**
| Route | Notes |
| --- | --- |
| `/saved` | `force-dynamic`; redirects to `/auth?next=/saved` if signed out; lists saved scholarships; also surfaces FR18 push opt-in, FR19 share-link controls, FR20 digest status, and the **FR21** application tracker per row (status, requirement-progress bar, private note) |

**Admin (role-gated, `force-dynamic`)**
| Route | Notes |
| --- | --- |
| `/admin` | Scholarship dashboard + inline "mark verified" action |
| `/admin/providers` | Provider list + add-provider form |
| `/admin/scholarships/new` | New scholarship form |
| `/admin/scholarships/[id]/edit` | Edit scholarship + nested eligibility-rules (incl. FR14 guidance text) / requirements / deadline-cycles panels |
| `/admin/worklist` | **(FR12)** Staleness worklist — published records nearing/past the 60-day verified threshold |
| `/admin/reports` | **(FR13)** Moderation queue for student-submitted "report an issue" flags |
| `/admin/suggestions` | **(FR10)** Source-watcher suggestion queue — per-field proposed changes, worst-confidence first, approve/reject |

Every admin route calls `requireAdmin()` (`lib/auth/require-admin.ts`) individually at the top — **there is no centralized gate**. See §10 and `SECURITY.md` §4 for why that's a documented gap, not an oversight.

**Cron Route Handlers (`app/api/cron/`)**
| Route | Method | Purpose |
| --- | --- | --- |
| `refresh-deadlines` | GET | Recompute `deadline_cycles.status` (FR5) |
| `send-reminders` | GET | Send due reminder emails via Resend (FR8), plus best-effort Web Push (FR18) |
| `send-digest` | GET | **(FR20)** Weekly, opt-in-only "new matches for you" digest — re-runs `buildScholarshipMatches` per saved profile, idempotent via `notified_scholarship_ids` |

All three require a `CRON_SECRET` bearer token (`lib/security/verify-cron-secret.ts`); scheduled by `vercel.json` (see §6, `DEPLOYMENT.md` §3).

## 4. Server Actions (`lib/actions/`)

| File | Actions | Auth | Notes |
| --- | --- | --- | --- |
| `match-profile.ts` | `matchProfile(profile)`, `submitProfileForm(prevState, formData)` | Public | Rate-limited 20 req/60s per IP; loads published scholarships + rules via anon client; delegates to pure `buildScholarshipMatches`; writes nothing (FR1, FR2) |
| `auth.ts` | `requestMagicLink(prevState, formData)` | Public | Rate-limited 5 req/60s per IP; sanitizes `next` redirect to same-site only (FR6) |
| `saved.ts` | `saveScholarship`, `unsaveScholarship`, `setReminder`, `cancelReminder`, `setReminderFormAction` | Session required (`requireUserId`) | User-scoped via session, never a caller-supplied user ID; `setReminder` computes `remind_on` from the soonest open deadline cycle, upserts idempotently (FR7, FR8) |
| `admin.ts` | `upsertScholarship`, `markVerified`, `addEligibilityRule`/`deleteEligibilityRule` (incl. FR14 `guidance_text`), `addRequirement`/`deleteRequirement`, `addDeadlineCycle`/`deleteDeadlineCycle`, `upsertProvider`, `resolveScholarshipReport`, + FormData wrappers | `requireAdmin()` on every function | Uses the service-role client (bypasses RLS); every mutation writes an `audit_log` row via `logAudit()` (FR9, FR13) |
| `reports.ts` | `submitScholarshipReport(prevState, formData)` | Public | **(FR13)** The app's first anon-facing write. Rate-limited 5 req/60s per IP; uses the service-role client directly (no client-facing RLS insert policy exists for `scholarship_reports` — `DATABASE.md` §2, §5) |
| `push.ts` | `subscribeToPush(subscription)`, `unsubscribeFromPush(endpoint)` | Session required | **(FR18)** Owner-scoped Web Push subscription CRUD, upserted on `endpoint` |
| `share.ts` | `createSavedListShare()`, `revokeSavedListShare()` | Session required | **(FR19)** One active share slug per user; regenerating invalidates the previous one. The link's contents are read only through `get_shared_saved_list()` (`DATABASE.md` §6), never a direct table policy |
| `saved-profile.ts` | `saveProfileForDigest(profile)`, `setDigestOptIn(optIn)`, `deleteSavedProfile()` | Session required | **(FR20)** The one path that persists a signed-in user's profile, and only on explicit opt-in — re-validates with the same `profileSchema` the anonymous match path uses |
| `application-tracker.ts` | `setApplicationStatus`, `saveApplicationNotes`, `toggleRequirementCheckoff`, + FormData wrappers | Session required (`requireUserId`) | **(FR21)** Owner-scoped via session, never a caller-supplied user ID. Upserts `application_progress` (status/notes) and toggles `requirement_checkoffs` (presence = checked). Zod-validated (status enum, ≤1000-char notes, UUID ids). Authenticated-owner write, not anon-write; persists tracking state only, not the matching profile (SEC-G1 unaffected) |

## 5. Matching Engine (`lib/matching/`) — pure, deterministic, tested

**Contract** (`lib/types/profile.ts`):

```ts
type ProfileField = 'education_level' | 'year_level' | 'gwa' | 'course_field'
  | 'region' | 'province' | 'income_bracket' | 'is_pwd'
  | 'is_solo_parent_dependent' | 'is_indigenous' | 'is_top_graduate';

type Operator = 'gte'|'lte'|'eq'|'neq'|'in'|'includes'|'is_true'|'is_false';

interface Rule { field: ProfileField; operator: Operator; value: unknown; isMandatory: boolean; humanLabel: string; }
interface Profile { /* the fields above, all optional; Zod .strict() */ }
```

`ProfileField` is the single source of truth, shared by the matcher, the admin form, and mirrored by the DB's `eligibility_rules_field_check` CHECK constraint (`DATABASE.md` §3) — kept in sync manually until an admin UI generates the constraint.

**Modules:**

- `apply-operator.ts` — `applyOperator(profileValue, operator, ruleValue)`: pure switch over all 8 operators, fails closed on type mismatch (never throws), exhaustive `never` check on the operator union.
- `evaluate-scholarship.ts` — `evaluateScholarship(profile, rules, scholarshipId)`: a missing mandatory profile field is **always treated as failed** (never inferred). `eligible` = 0 mandatory fails, `near_miss` = exactly 1, else `not_eligible`.
- `rank.ts` — `rank(items)`: sorts by `closesAt` ascending, then coverage type (`full` > `partial` > `allowance` > `other`).
- `build-scholarship-matches.ts` — `buildScholarshipMatches(rows, profile)`: pure row→bucket transform; picks the soonest deadline cycle per scholarship, builds `whyChips`/`gapExplainer`/`guidance` (FR14) and `failedChips` (FR15, every failed mandatory rule's label — populated for both near-miss and not-eligible, empty for eligible), calls `rank` per bucket. This is the pure/impure boundary: the DB read lives only in `lib/actions/match-profile.ts` and (for the FR20 digest) `app/api/cron/send-digest/route.ts`.

Fully unit-tested: `apply-operator.test.ts`, `evaluate-scholarship.test.ts`, `rank.test.ts`, `build-scholarship-matches.test.ts`.

## 6. Deadline Status & Reminders (daily)

```
For each deadline_cycle:
  today := getManilaTodayIso()   -- lib/deadline/manila-date.ts, pinned to Asia/Manila
  if today < opens_at             → 'upcoming'
  elif today > closes_at          → 'closed'
  elif closes_at - today <= 7     → 'closing_soon'
  else                            → 'open'
Then: for reminders where remind_on <= today and sent_at is null
      and the scholarship's cycle is not 'closed':
        send via Resend (lib/email/send-reminder-email.ts); set sent_at.
```

Implemented as **Next.js Route Handlers**, not a Supabase Edge Function or `pg_cron` job — `app/api/cron/refresh-deadlines/route.ts` and `app/api/cron/send-reminders/route.ts`, invoked by **Vercel Cron** (`vercel.json`: `0 16 * * *` and `15 16 * * *` UTC, i.e. ~00:00/00:15 Manila). Idempotent (safe to re-run); pure status computation lives in `lib/deadline/compute-status.ts` (unit-tested in `compute-status.test.ts`). `send-reminders` also sends a best-effort Web Push notification (FR18, `lib/push/send-push-notification.ts`) alongside email for any subscribed user — a push failure never blocks the email or marking the reminder sent; an expired subscription (404/410 from the push service) is pruned from `push_subscriptions`.

A third Route Handler, `app/api/cron/send-digest/route.ts` (FR20), runs weekly (`vercel.json`: `30 16 * * 1`, ~00:30 Manila Monday) over `saved_profiles` rows with `digest_opt_in = true`, re-running `buildScholarshipMatches` against each saved profile and emailing only scholarships not already in that row's `notified_scholarship_ids` — idempotent by construction, and a failed send leaves `notified_scholarship_ids` untouched so it's retried next run.

## 7. Admin Tool

Manages: **Scholarships** (create/edit/publish/mark-verified), **Providers** (name, type, website), and per-scholarship **eligibility rules** (incl. FR14 guidance text), **requirements**, and **deadline cycles** via nested panels on the edit page, plus a **staleness worklist** (FR12, `/admin/worklist`) and a **reported-issues moderation queue** (FR13, `/admin/reports`). Every mutation is audit-logged (`audit_log` table, `DATABASE.md` §2). Gating is `requireAdmin()` called individually per page/action (§3, §10) — membership in `admin_users` is granted only via a manual service-role DB operation; no self-service admin signup (intentional for a solo-curator MVP, per FR9).

## 8. Security & Privacy Enforcement (summary)

Full detail lives in `SECURITY.md`; the architecture-relevant summary:

- RLS is the default-deny baseline for every table (`DATABASE.md` §5) — content tables have **no write policy at all**, so every mutation from the app goes through a service-role client in a server action, never a client-side Supabase call.
- Anonymous matching persists nothing — there is no `student_profiles` table (deliberately deferred, see `DATABASE.md` §2). **FR20 is a scoped, documented exception**: `saved_profiles` persists a profile only for a signed-in user who explicitly opts in (never by default, never for anonymous matching) — see `SECURITY.md` §1.
- `scholarship_reports` (FR13) is the app's first anon-facing write. It gets **no anon RLS insert policy** — submission goes through a rate-limited Server Action using the service-role client instead, keeping "no write policy exists for `anon`" literally true.
- `get_shared_saved_list()` (FR19) is the only path a share link's contents are read through — a `SECURITY DEFINER` function (mirroring `is_admin()`) returning a narrow, explicit column allowlist, never a client-facing RLS policy that could leak `user_id`/email through a future join change.
- Every server action input is validated with a Zod `.strict()` schema (`lib/types/`); unknown fields are rejected.
- Service-role key is used only in server actions / route handlers, never in a client component or shipped bundle. The Web Push VAPID private key (FR18) follows the same rule — read only in `lib/push/send-push-notification.ts`, server-side.

## 9. Testing

- **Unit (Vitest, `lib/**/*.test.ts`, `tests/**/*.test.ts`, node env):** full matching-engine coverage, deadline status transitions, URL-allowlist logic, "last verified" staleness logic, Zod schema validation, and an opt-in RLS integration test (`tests/integration/rls.test.ts`, skipped unless `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` are set — runs against a local Supabase stack).
- **E2E (Playwright, `tests/e2e/`):** `smoke.spec.ts` is deliberately scoped to **DB-independent pages only** (landing, `/match` form rendering + client-side GWA validation, `/about`, `/privacy`, security headers) — DB-backed flows (`/s/[slug]`, `/saved`, `/admin`) are explicitly out of scope today since CI/dev doesn't reliably have a linked Supabase project.
- **Not covered by any test:** the server actions themselves (only the pure functions they call are unit-tested), the four cron route handlers (incl. the FR10 source-watcher, whose pure P12/P13/P14 functions *are* unit-tested and whose extraction has an opt-in eval), admin CRUD flows end-to-end, and email/push sending. The FR19 `get_shared_saved_list()` RPC and the FR13/anon-write RLS posture were verified manually against a local Supabase stack during development (real anon REST calls, real RLS denial checks) rather than in an automated suite — worth converting into `tests/integration/rls.test.ts` cases.

## 10. Known Gaps / Divergence from the Original Plan

- **Deadline/reminder/digest jobs run on Vercel Cron + Route Handlers, not a Supabase Edge Function** — simpler to keep the whole app in one deployable, at the cost of coupling cron to Vercel specifically.
- **Admin gating is per-page/per-action, not centralized.** Next.js 16 renamed `middleware.ts` to `proxy.ts`; the `proxy()` in this repo only refreshes the Supabase session cookie, it does not gate `/admin`. A missed `requireAdmin()` call on a new admin page/action would ship unprotected — worth a lint rule or a shared layout wrapper if the admin surface grows.
- **FR10 (Phase 2 source-watcher) is built** — a weekly Vercel Cron route (`/api/cron/watch-sources`, Node runtime) drives the agentic loop in `lib/source-watcher/run-watch.ts`: fetch (SSRF-guarded) → normalize (Readability / pdf-parse) → deterministic per-section change-gate → RAG-grounded Groq extraction over only the changed sections → deterministic diff vs. the live record → rule-based confidence score → per-field suggestions into `scholarship_suggestions`. Curators approve/reject at `/admin/suggestions`; approval routes through the existing validated admin actions and never auto-publishes. Tables: `source_documents`, `source_sections`, `scholarship_suggestions` (replacing the earlier `source_watch`/`ingestion_suggestions` placeholder names). Deliberately **not** using pgvector/embeddings — the "retrieval" is the deterministic change-gate, which is stronger grounding than similarity search at this scale and keeps the stack on Groq's free tier (Groq has no embeddings endpoint). P12/P13 pure functions are unit-tested; the probabilistic extraction has a separate opt-in eval (`npm run eval:source-watcher`, not in CI).
- **`/match` is now `force-dynamic`**, not statically prerendered, so it can read the auth cookie for the FR20 digest opt-in — a small latency trade-off (still no external API on the read path) accepted for that one feature.
- **Web Push (FR18) has no delivery-retry queue** — a failed push is simply dropped for that reminder cycle (email remains the primary, retried-nowhere-either channel); only an *expired* subscription (404/410) is pruned.
- **No CI** — lint/typecheck/test/build are run manually pre-push per `docs/iskolar-version-control.md`; see `DEPLOYMENT.md` §7.

## 11. Build Sequence (for reference / future features)

1. Schema + RLS (done, see `DATABASE.md`)
2. Shared types + Zod schemas (done, `lib/types/`)
3. Matching module + unit tests (done, §5)
4. Profile form + results page (done, `/match`)
5. Scholarship detail page (done, `/s/[slug]`)
6. Auth + save/saved list (done, `/auth`, `/saved`)
7. Deadline cron + reminder emails (done, §6)
8. Admin tool (done, §7)
9. QA pass — ongoing; e2e coverage still partial (§9)
10. **(Phase 2)** Source-watcher — done: P12 ingestion (fetch/normalize/hash/change-gate + SSRF-safe fetch), P13 extraction (Groq structured output + golden-set eval), P14 confidence scoring + curator queue (`/admin/suggestions`)
11. **v2 feature backlog** (`PRD.md` §4, FR11–FR20) — done: trust dashboard + staleness worklist (FR11/12), report-an-issue moderation queue (FR13), near-miss guidance + not-eligible explainability (FR14/15), comparison view + browse/filter (FR16/17), Web Push + shareable saved list (FR18/19), opt-in digest (FR20)
