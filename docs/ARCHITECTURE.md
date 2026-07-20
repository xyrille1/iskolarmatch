# IskolarMatch — Technical Design Document (TDD)

_System architecture, matching engine, deadline job, API surface, and build sequence for the Philippine scholarship discovery and matching tool._

**Companion to:** `PRD.md`, `DATABASE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Next.js + TypeScript + Supabase (Postgres) + Tailwind
**Status:** Draft v1 for build

---

# 4. Technical Design Document (TDD)

## 4.1 Overview

A read-heavy Next.js web app over a Supabase Postgres database. The differentiating logic is a **deterministic matching engine** implemented as pure TypeScript functions (unit-testable, no I/O), wrapped by a server action. Scholarship data is human-curated through an admin tool; deadline status is recomputed by a daily scheduled job. There is deliberately **no external service on the critical read path** and **no LLM in the eligibility path**. AI appears only in Phase 2 as a source-change _detector_ that produces admin-reviewed suggestions.

## 4.2 Tech Stack

```
Language:    TypeScript (strict)
Framework:   Next.js (App Router, Server Components + Server Actions)
Styling:     Tailwind CSS
Database:    PostgreSQL via Supabase
Auth:        Supabase Auth (email magic link)
Security:    Supabase Row-Level Security (RLS) on all user-owned tables
Validation:  Zod (shared client/server schemas)
Data access: supabase-js (server client with service role only in server context)
Scheduling:  Supabase scheduled Edge Function (or pg_cron) — daily status + reminders
Email:       Resend (transactional reminders)
Testing:     Vitest (unit/integration) + Playwright (e2e happy paths)
Hosting:     Vercel (app) + Supabase (data) — see DEPLOYMENT.md
Reason:      Matches the owner's stack; deterministic core needs no heavy infra;
             Supabase RLS gives per-user security without a custom backend.
```

## 4.3 System Architecture

```
                          ┌─────────────────────────────────────────┐
                          │              Next.js (Vercel)            │
                          │                                          │
  Student (mobile) ─────▶ │  Public routes (Server Components)       │
                          │   /            landing                   │
                          │   /match       profile form → results    │
                          │   /s/[slug]    scholarship detail (SSR)   │
                          │                                          │
                          │  Server Actions                          │
                          │   matchProfile()  ── calls ──▶ matching/ │◀── pure, tested
                          │   saveScholarship()                      │      (no I/O)
                          │   setReminder()                          │
                          │                                          │
                          │  Auth'd routes                           │
                          │   /saved       saved list                │
                          │                                          │
                          │  Admin routes (role-gated)               │
                          │   /admin/*     CRUD + mark verified      │
                          └───────────────┬──────────────────────────┘
                                          │ supabase-js
                                          ▼
                          ┌─────────────────────────────────────────┐
                          │            Supabase (Postgres)           │
                          │  public read:  providers, scholarships,  │
                          │                eligibility_rules,        │
                          │                requirements, cycles      │
                          │  RLS (owner):  student_profiles,         │
                          │                saved_scholarships,       │
                          │                reminders                 │
                          │  admin only:   ingestion_suggestions,    │
                          │                source_watch              │
                          └───────────────┬──────────────────────────┘
                                          ▲
                    daily schedule        │ writes status / queues reminders
                          ┌───────────────┴──────────────────────────┐
                          │   Scheduled Edge Function (cron, daily)   │
                          │   1) recompute scholarship deadline status│
                          │   2) find saved+due reminders → Resend    │
                          └───────────────────────────────────────────┘

   ── Phase 2 (post-MVP), isolated from the read path ──
                          ┌───────────────────────────────────────────┐
                          │   Source-Watcher Edge Function (weekly)    │
                          │   fetch official_url → hash/diff →         │
                          │   LLM extract candidate fields →           │
                          │   INSERT ingestion_suggestions(status=     │
                          │   'pending')  ── NEVER publishes ──        │
                          └──────────────┬────────────────────────────┘
                                         ▼  admin reviews in /admin
                                   approve → writes verified record
```

**Data flow (match):** student fills form → `matchProfile(profile)` server action → loads active scholarships + their eligibility rules → pure `evaluate()` buckets each into eligible/near-miss/not-eligible with matched-reasons → returns ranked-by-deadline result → rendered server-side. No personal data written unless the student later signs in and saves.

## 4.5 Matching Engine (the core — deterministic, pure, tested)

**Contract:**

```
type ProfileField = 'education_level' | 'year_level' | 'gwa' | 'course_field'
  | 'region' | 'province' | 'income_bracket' | 'is_pwd'
  | 'is_solo_parent_dependent' | 'is_indigenous' | 'is_top_graduate';

type Operator = 'gte'|'lte'|'eq'|'neq'|'in'|'includes'|'is_true'|'is_false';

interface Rule { field: ProfileField; operator: Operator; value: unknown; isMandatory: boolean; humanLabel: string; }
interface Profile { /* the fields above, all optional */ }

interface RuleResult { rule: Rule; passed: boolean; }
interface MatchResult {
  scholarshipId: string;
  bucket: 'eligible' | 'near_miss' | 'not_eligible';
  passedReasons: string[];   // humanLabel of passed mandatory rules
  failedReasons: string[];   // humanLabel of failed mandatory rules
}
```

**Rules of evaluation (pure function `evaluateScholarship(profile, rules): MatchResult`):**

1. Evaluate every rule with `applyOperator(profileValue, operator, ruleValue)`.
2. If a **mandatory** field is **missing** from the profile → treat that rule as **failed** (conservative: never claim eligible on unknown data).
3. `eligible` = all mandatory rules pass. `near_miss` = exactly one mandatory rule fails. else `not_eligible`.
4. Ranking of eligible results: by `closes_at` ascending (soonest deadline first), then `coverage_type` (full > partial > allowance).
5. **Never** infer or soften: no fuzzy matching, no LLM. A missing rule field is a data bug to fix in the admin tool, surfaced by tests.

`applyOperator` truth table is the primary unit-test target (see §5).

**Why pure functions:** zero I/O means the whole matcher is testable without a database, runs in <1ms per scholarship, and its correctness is provable by enumerating operator/value cases. The server action only does I/O (load rules) and delegates the decision to the pure core.

## 4.6 Deadline Status Job (daily)

```
For each deadline_cycle:
  today := current date (Asia/Manila)
  if today < opens_at             → 'upcoming'
  elif today > closes_at          → 'closed'
  elif closes_at - today <= 7     → 'closing_soon'
  else                            → 'open'
Then: for reminders where remind_on <= today and sent_at is null
      and the saved scholarship's cycle is not 'closed':
        send email via Resend; set sent_at.
```

Idempotent (safe to re-run). Timezone pinned to **Asia/Manila** to avoid off-by-one on deadlines — a real correctness trap; test the date boundaries explicitly.

## 4.7 API / Interface Surface

| Interface                              | Type                       | Purpose                                                                                           |
| --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `matchProfile(profile)`                | Server Action              | Validate (Zod) → load published scholarships + rules → run matcher → return buckets. No writes.   |
| `getScholarship(slug)`                 | Server (data)              | Detail page data (SSR + metadata for SEO).                                                        |
| `saveScholarship(scholarshipId)`       | Server Action (auth)       | Insert into `saved_scholarships` (RLS enforces owner).                                            |
| `setReminder(scholarshipId, leadDays)` | Server Action (auth)       | Compute `remind_on`, upsert reminder.                                                             |
| `admin.upsertScholarship(payload)`     | Server Action (admin role) | CRUD; validates every rule.field ∈ ProfileField; blocks publish unless `official_url` + verified. |
| `admin.markVerified(id)`               | Server Action (admin role) | Sets `last_verified_at = now()`, `verified_by = uid`.                                             |
| cron: `refreshDeadlineStatus()`        | Edge Function              | §4.6 job.                                                                                          |
| cron: `sendDueReminders()`             | Edge Function              | §4.6 reminders.                                                                                    |
| **Phase 2** `watchSources()`           | Edge Function              | Fetch/diff/extract → insert `ingestion_suggestions(status='pending')`. Never publishes.           |

## 4.8 Security & Privacy Enforcement

See `SECURITY.md` for the full threat model; this is the implementation-level summary.

- **RLS ON** for `student_profiles`, `saved_scholarships`, `reminders`: policy `user_id = auth.uid()` for select/insert/update/delete.
- Public tables (`scholarships`, `providers`, `eligibility_rules`, `requirements`, `deadline_cycles`): read-only anon policy `is_published = true`; writes only via admin role / service context.
- Admin routes gated by a `role` claim; never trust client — check server-side in every admin action.
- **Anonymous matching persists nothing.** The profile lives in the request/session only. Persisting a `student_profile` is an explicit, opt-in, authenticated action.
- Zod validation on every server action input; reject unknown fields.
- Service-role key used **only** in server context (Edge Functions / server actions), never shipped to the client.

## 4.9 Implementation Order (build sequence — dependencies noted)

1. **Schema + RLS + seed 3 scholarships** — everything depends on this. Add the `is_published`/`last_verified_at` CHECK constraint now.
2. **Shared types + Zod schemas** (`ProfileField`, `Rule`, `Profile`) — single source of truth for app + admin.
3. **Matching module** (`lib/matching/`) — pure functions + full unit tests. _Build and test before any UI._
4. **Profile form + results page** — calls `matchProfile()`; render buckets + matched-reasons.
5. **Scholarship detail page** (SSR, metadata) — requirements checklist, deadline, verified date, official link, disclaimer.
6. **Auth (magic link) + save/saved list** — first RLS-protected feature.
7. **Deadline status cron + reminder emails** — Edge Function + Resend; test date boundaries.
8. **Admin tool** — CRUD + mark-verified; validate rule.field ∈ ProfileField; complete the 10–20 seed dataset.
9. **QA pass** — test matrix §5, accessibility, mobile, deploy.
10. **(Phase 2)** Source-watcher — isolated, suggestions only.

## 4.10 Risks & Mitigations (technical)

| Risk                                            | Mitigation                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Rule references a field the matcher can't read  | Zod-enforce `field ∈ ProfileField` in admin; unit test rejects unknown fields.                            |
| Timezone off-by-one on deadlines                | Pin all date math to Asia/Manila; boundary tests at opens_at/closes_at ±1 day.                             |
| "Eligible" shown on missing data                | Matcher treats missing mandatory field as failed; conservative by construction.                            |
| Publishing an unverified record                 | DB CHECK constraint blocks publish without `official_url` + `last_verified_at`.                            |
| Reminder double-send                            | `sent_at` guard; idempotent job.                                                                            |
| RLS misconfig leaks profiles                    | Default-deny; explicit owner policies; test with two users.                                                |
| Phase-2 LLM hallucination reaches users         | Suggestions land in `ingestion_suggestions(status='pending')`; only admin approval writes a live record.   |

## 4.11 Handoff to Programmer

Build in the order in §4.9. Start with the **schema + RLS (step 1)** and the **pure matching module with its unit tests (step 3)** — the matcher must be green before any UI is wired. Conventions: TypeScript strict; all server-action inputs validated with Zod; `ProfileField` is the single source of truth shared by app, admin, and matcher; no LLM anywhere in the matching or publish path; every published scholarship must carry `official_url` + `last_verified_at` (enforced by DB CHECK). Pin all date logic to Asia/Manila. Ask for clarification only on: the exact seed scholarship list and their per-scholarship eligibility rules (these are data, and must be transcribed from official sources, not invented).

---

# 5. Test Matrix (core)

| Area                  | Cases                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyOperator`       | For each operator (gte/lte/eq/neq/in/includes/is_true/is_false): pass case, fail case, boundary case (e.g. gwa exactly == threshold), wrong-type value, null profile value. |
| `evaluateScholarship` | all-pass → eligible; exactly-one-fail → near_miss; two-fail → not_eligible; missing mandatory field → treated as fail; non-mandatory fail → still eligible.                 |
| Ranking               | two eligible with different `closes_at` → sooner first; tie on date → full coverage before partial.                                                                         |
| Deadline status       | today < opens_at → upcoming; today == closes_at → open/closing_soon (define inclusive); today == closes_at+1 → closed; TZ = Asia/Manila.                                    |
| Reminders             | remind_on today & unsent & not closed → sends + sets sent_at; already sent → skip; scholarship closed → skip.                                                               |
| RLS                   | user A cannot read/write user B's profile, saved, reminders.                                                                                                                |
| Publish guard         | publishing without official_url or last_verified_at → rejected.                                                                                                             |
| Admin rule validation | rule.field not in ProfileField → rejected.                                                                                                                                  |
| E2E happy path        | landing → profile → results → detail → sign in → save → set reminder, under 3 min.                                                                                          |
