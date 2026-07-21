# IskolarMatch — Architecture

_System architecture, matching engine, deadline job, and route/action map for the Philippine scholarship discovery and matching tool. Describes the **current implementation**, not just the original design — see §10 for where it has diverged from the initial plan._

**Companion to:** `PRD.md`, `DATABASE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Next.js 16 (App Router) + TypeScript + Supabase (Postgres) + Tailwind
**Status:** Reflects the app as built — update this doc alongside any structural code change, don't let it drift

---

## 1. Overview

A read-heavy Next.js app over a Supabase Postgres database, matching `PRD.md` §4 (FR1–FR9; FR10 is Phase 2 and not built). The differentiating logic is a **deterministic matching engine** (`lib/matching/`) implemented as pure TypeScript functions — no I/O, no LLM, fully unit-tested. Scholarship data is human-curated through an admin tool; deadline status and reminder emails are recomputed by two daily **Vercel Cron**-triggered Route Handlers (not Supabase Edge Functions, see §6). There is no external service on the critical anonymous-match read path.

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
Email:       Resend 6.17.2 (transactional reminders)
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
| `/match` | Server wrapper around client `match-experience.tsx` (form → results); calls `submitProfileForm` |
| `/s/[slug]` | Scholarship detail, `force-dynamic` (reads auth cookie to show save/reminder state) |

**Auth**
| Route | Notes |
| --- | --- |
| `/auth` | Sign-in page; client `auth-form.tsx` calls `requestMagicLink` |
| `/auth/confirm` (Route Handler) | Verifies Supabase OTP (`token_hash`+`type`), redirects to a sanitized same-site `next` path |

**Session-gated**
| Route | Notes |
| --- | --- |
| `/saved` | `force-dynamic`; redirects to `/auth?next=/saved` if signed out; lists saved scholarships |

**Admin (role-gated, `force-dynamic`)**
| Route | Notes |
| --- | --- |
| `/admin` | Scholarship dashboard + inline "mark verified" action |
| `/admin/providers` | Provider list + add-provider form |
| `/admin/scholarships/new` | New scholarship form |
| `/admin/scholarships/[id]/edit` | Edit scholarship + nested eligibility-rules / requirements / deadline-cycles panels |

Every admin route calls `requireAdmin()` (`lib/auth/require-admin.ts`) individually at the top — **there is no centralized gate**. See §10 and `SECURITY.md` §4 for why that's a documented gap, not an oversight.

**Cron Route Handlers (`app/api/cron/`)**
| Route | Method | Purpose |
| --- | --- | --- |
| `refresh-deadlines` | GET | Recompute `deadline_cycles.status` (FR5) |
| `send-reminders` | GET | Send due reminder emails via Resend (FR8) |

Both require a `CRON_SECRET` bearer token (`lib/security/verify-cron-secret.ts`); scheduled by `vercel.json` (see §6, `DEPLOYMENT.md` §3).

## 4. Server Actions (`lib/actions/`)

| File | Actions | Auth | Notes |
| --- | --- | --- | --- |
| `match-profile.ts` | `matchProfile(profile)`, `submitProfileForm(prevState, formData)` | Public | Rate-limited 20 req/60s per IP; loads published scholarships + rules via anon client; delegates to pure `buildScholarshipMatches`; writes nothing (FR1, FR2) |
| `auth.ts` | `requestMagicLink(prevState, formData)` | Public | Rate-limited 5 req/60s per IP; sanitizes `next` redirect to same-site only (FR6) |
| `saved.ts` | `saveScholarship`, `unsaveScholarship`, `setReminder`, `cancelReminder`, `setReminderFormAction` | Session required (`requireUserId`) | User-scoped via session, never a caller-supplied user ID; `setReminder` computes `remind_on` from the soonest open deadline cycle, upserts idempotently (FR7, FR8) |
| `admin.ts` | `upsertScholarship`, `markVerified`, `addEligibilityRule`/`deleteEligibilityRule`, `addRequirement`/`deleteRequirement`, `addDeadlineCycle`/`deleteDeadlineCycle`, `upsertProvider`, + FormData wrappers | `requireAdmin()` on every function | Uses the service-role client (bypasses RLS); every mutation writes an `audit_log` row via `logAudit()` (FR9) |

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
- `build-scholarship-matches.ts` — `buildScholarshipMatches(rows, profile)`: pure row→bucket transform; picks the soonest deadline cycle per scholarship, builds `whyChips`/`gapExplainer`, calls `rank` per bucket. This is the pure/impure boundary: the DB read lives only in `lib/actions/match-profile.ts`.

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

Implemented as **two Next.js Route Handlers**, not a Supabase Edge Function or `pg_cron` job — `app/api/cron/refresh-deadlines/route.ts` and `app/api/cron/send-reminders/route.ts`, invoked by **Vercel Cron** (`vercel.json`: `0 16 * * *` and `15 16 * * *` UTC, i.e. ~00:00/00:15 Manila). Idempotent (safe to re-run); pure status computation lives in `lib/deadline/compute-status.ts` (unit-tested in `compute-status.test.ts`).

## 7. Admin Tool

Manages: **Scholarships** (create/edit/publish/mark-verified), **Providers** (name, type, website), and per-scholarship **eligibility rules**, **requirements**, and **deadline cycles** via nested panels on the edit page. Every mutation is audit-logged (`audit_log` table, `DATABASE.md` §2). Gating is `requireAdmin()` called individually per page/action (§3, §10) — membership in `admin_users` is granted only via a manual service-role DB operation; no self-service admin signup (intentional for a solo-curator MVP, per FR9).

## 8. Security & Privacy Enforcement (summary)

Full detail lives in `SECURITY.md`; the architecture-relevant summary:

- RLS is the default-deny baseline for every table (`DATABASE.md` §5) — content tables have **no write policy at all**, so every mutation from the app goes through a service-role client in a server action, never a client-side Supabase call.
- Anonymous matching persists nothing — there is no `student_profiles` table (deliberately deferred, see `DATABASE.md` §2).
- Every server action input is validated with a Zod `.strict()` schema (`lib/types/`); unknown fields are rejected.
- Service-role key is used only in server actions / route handlers, never in a client component or shipped bundle.

## 9. Testing

- **Unit (Vitest, `lib/**/*.test.ts`, `tests/**/*.test.ts`, node env):** full matching-engine coverage, deadline status transitions, URL-allowlist logic, "last verified" staleness logic, Zod schema validation, and an opt-in RLS integration test (`tests/integration/rls.test.ts`, skipped unless `TEST_SUPABASE_URL`/`TEST_SUPABASE_ANON_KEY` are set — runs against a local Supabase stack).
- **E2E (Playwright, `tests/e2e/`):** `smoke.spec.ts` is deliberately scoped to **DB-independent pages only** (landing, `/match` form rendering + client-side GWA validation, `/about`, `/privacy`, security headers) — DB-backed flows (`/s/[slug]`, `/saved`, `/admin`) are explicitly out of scope today since CI/dev doesn't reliably have a linked Supabase project.
- **Not covered by any test:** the server actions themselves (only the pure functions they call are unit-tested), the two cron route handlers, admin CRUD flows end-to-end, and email sending.

## 10. Known Gaps / Divergence from the Original Plan

- **Deadline job runs on Vercel Cron + Route Handlers, not a Supabase Edge Function** — simpler to keep the whole app in one deployable, at the cost of coupling cron to Vercel specifically.
- **Admin gating is per-page/per-action, not centralized.** Next.js 16 renamed `middleware.ts` to `proxy.ts`; the `proxy()` in this repo only refreshes the Supabase session cookie, it does not gate `/admin`. A missed `requireAdmin()` call on a new admin page/action would ship unprotected — worth a lint rule or a shared layout wrapper if the admin surface grows.
- **FR10 (Phase 2 source-watcher) is not built** — no `source_watch`/`ingestion_suggestions` tables or Edge Function exist yet.
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
10. **(Phase 2)** Source-watcher — not started
