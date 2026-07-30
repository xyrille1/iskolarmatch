# Iskolarly — Technical Requirements Document

_Requirements-and-verification view of the system: what must be true, and how each requirement is checked today. This doc does not restate what each feature does (`PRD.md`) or how it's implemented (`ARCHITECTURE.md`) — it states the bar and the check._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md` / `backend-schema.md`, `SECURITY.md`, `DEPLOYMENT.md`, `app-flow.md`
**Owner:** Xyrille · **Stack:** Next.js 16 + TypeScript + Supabase (Postgres) + Tailwind
**Status:** Reflects the app as built (FR1–FR22, all shipped)

---

## 1. Purpose & Scope

Translates `PRD.md`'s functional requirements (FR1–FR22) and non-functional goals into verifiable technical requirements, and maps each to how it's actually checked in this repo (test file, CI job, DB constraint, or manual procedure). Use this doc to answer "is X actually guaranteed, and how do I know."

## 2. Functional Requirement Traceability

| Requirement group | FR IDs | Verified by |
| --- | --- | --- |
| Anonymous matching | FR1, FR2 | `lib/matching/*.test.ts` — full operator × field coverage |
| Result/detail presentation & trust | FR3, FR4, FR11 | Manual QA; `/trust` dashboard reflects live data |
| Deadline status | FR5 | `compute-status.test.ts`; daily cron (`ARCHITECTURE.md` §6) |
| Auth & saving | FR6, FR7, FR8 | `tests/integration/rls.test.ts`; manual magic-link smoke test |
| Admin CRUD & audit | FR9 | Manual QA; every mutation writes an `audit_log` row |
| Source-watcher (existing records) | FR10 | Unit tests on pure functions + opt-in eval (`npm run eval:source-watcher`) |
| Trust/staleness/reporting | FR11, FR12, FR13 | RLS integration tests; manual anon-write-denial checks |
| Near-miss / not-eligible explainability | FR14, FR15 | `build-scholarship-matches.test.ts` |
| Comparison / browse & filter | FR16, FR17 | Manual QA — FR16 is client-side only, no new DB reads |
| Notifications (push / share / digest) | FR18, FR19, FR20 | `cron-routes.test.ts`; manual push/share/digest smoke tests |
| Application tracker | FR21 | Zod schema tests + RLS integration tests |
| Discovery crawler | FR22 | Unit tests on pure helpers (`robots`, `dedupe`, `score-candidate`, `slugify`) |

Full requirement text lives in `PRD.md` §1.6 and §4 — not duplicated here.

## 3. Non-Functional Requirements

| # | Requirement | Target | Verification |
| --- | --- | --- | --- |
| NFR1 | Match latency | p95 < 2s, profile submit → results | No external API on the read path (`ARCHITECTURE.md` §1) |
| NFR2 | Data trust | 100% of published scholarships have `official_url` + `last_verified_at` | DB CHECK `scholarships_publish_guard` |
| NFR3 | Deadline accuracy | 0 scholarships shown "open" past `closes_at` | Daily cron recompute, Asia/Manila-pinned (`ARCHITECTURE.md` §6) |
| NFR4 | Tenant isolation | 0 cross-user reads/writes on owned tables | Default-deny RLS + `auth.uid()` scoping on every owned table |
| NFR5 | Secret safety | 0 privileged secrets reach the browser bundle | Service-role/CRON/Resend/LLM keys read server-only only |
| NFR6 | Link integrity | 0 off-allowlist outbound links published | Zod + Postgres trigger + suffix-match — 3 independent layers |
| NFR7 | Injection resistance | 100% of server-action inputs Zod-validated, 0 raw SQL | `.strict()` schemas under `lib/types/`; `@supabase/supabase-js` only |
| NFR8 | Accessibility | WCAG AA contrast, mobile-first, core reading works without JS | Server Components for public pages; manual audit |
| NFR9 | Privacy (RA 10173) | 0 persisted PII for anonymous matching | No `student_profiles` table; FR20's `saved_profiles` is the sole opt-in exception |
| NFR10 | Recoverability | Clean env rebuildable from git in < 30 min | Forward-only migrations, no out-of-band schema changes |
| NFR11 | SSRF resistance | 0 requests to private/metadata IPs from crawler code | `isPrivateIp()` on every resolved IP and redirect hop, HTTPS-only, allowlist |

Full rationale and any accepted gaps: `SECURITY.md` §1, §4.

## 4. Technical Constraints

- **Runtime:** Next.js 16 (App Router), React 19, TypeScript strict mode. Node 22 pinned in CI and local dev.
- **Data layer:** PostgreSQL via Supabase; RLS is the access-control mechanism, not app-layer checks alone.
- **No client-side writes to content tables** — every content mutation goes through a service-role server action.
- **No LLM on the matching or publish path** — LLM usage is confined to FR10/FR22 extraction, both human-approved before anything goes live.
- **Free/low-cost tier only** — Supabase free, Vercel Hobby, Resend free, Groq free tier. No paid infra assumed.
- **Single deployable** — app, Server Actions, and cron Route Handlers all ship together on Vercel; no separate backend service.

## 5. Environments & Configuration

Full variable list and purpose: `DEPLOYMENT.md` §2. Summary by trust tier:

| Tier | Examples | Rule |
| --- | --- | --- |
| Public | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Safe to ship to the browser; access still bounded by RLS |
| Server-only secret | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `GROQ_API_KEY` / `LLM_API_KEY` | Read only in server actions / Route Handlers; never in a `"use client"` file |

No staging environment exists; Vercel preview deployments are the closest equivalent (`DEPLOYMENT.md` §1, §7).

## 6. Quality Gates (Definition of Done)

Enforced by `.github/workflows/ci.yml` on every push/PR — a red gate blocks the PR:

1. `lint` — ESLint clean
2. `typecheck` — `tsc --noEmit` clean
3. `test` — Vitest unit suite green
4. `build` — `next build` succeeds
5. `secret-scan` — gitleaks `--redact`, 0 findings
6. `rls` — `tests/integration/rls.test.ts` against a booted local Supabase stack
7. `e2e` — Playwright smoke (DB-independent pages only, `ARCHITECTURE.md` §9)

Manual, not yet automated (`SECURITY.md` §5) — run before any release touching RLS policies or admin gating:
- Two-user cross-tenant RLS check (user A cannot read/write user B's owned rows)
- Admin-route redirect smoke test for an unauthenticated/non-admin session

See `docs/iskolar-version-control.md` §7 for the pre-commit/pre-push checklist this backstops.

## 7. Out of Scope (reaffirmed)

No application/document submission, no AI-generated eligibility decisions, no payments, no SMS, no nationwide data completeness at MVP. Full non-goals list: `PRD.md` §1.3, §4.5.
