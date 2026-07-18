# IskolarMatch — Product & Technical Specification

_A Philippine scholarship discovery and matching tool. Matches a student's profile to CHED, DOST-SEI, and local scholarships, tracks deadlines and requirements, and hands users off to official application sources._

**Document set:** PRD → MVP Concept → MVP Development Plan → Technical Design Document (TDD)
**Owner:** Xyrille · **Stack:** Next.js + TypeScript + Supabase (Postgres) + Tailwind
**Status:** Draft v1 for build

---

## 0. Assumptions

These are filled in so you can build without blocking. Change any that are wrong before starting.

- `[ASSUMPTION]` This is a **portfolio-grade product**, built solo, targeting a working MVP in ~4–6 weeks of part-time work.
- `[ASSUMPTION]` **Discovery + matching + deadline tracking only.** The app never accepts scholarship applications; it links out to official portals.
- `[ASSUMPTION]` **Matching is deterministic and rule-based.** No LLM is involved in deciding eligibility.
- `[ASSUMPTION]` The MVP ships with a **hand-curated seed dataset** (10–20 real scholarships). Automated ingestion is a Phase 2 feature and is human-in-the-loop.
- `[ASSUMPTION]` **Browsing and matching require no account.** An account is only needed to save scholarships and set deadline reminders.
- `[ASSUMPTION]` Primary users are Filipino senior-high graduates and college students (many are minors, 16–18), on mobile, on slow connections.

---

# 1. Product Requirements Document (PRD)

## 1.1 Overview

Filipino students lose scholarships they qualify for because the information is scattered across regional CHED pages, DOST-SEI's portal, LGU announcements, foundation sites, and Facebook posts — and because deadlines are easy to miss. The prevailing "solution" is a personal spreadsheet. IskolarMatch replaces the spreadsheet with a single tool that (a) takes a light student profile, (b) returns only the scholarships that student is actually eligible for, ranked by deadline urgency, and (c) tracks deadlines and requirement checklists, linking out to the official application source for each one.

The product's core asset is **verified, current scholarship data**, not the matching algorithm. Every design decision below protects data trust and deadline accuracy.

## 1.2 Goals / Objectives (SMART)

- **G1 — Relevance:** A student who completes the profile sees a list where **≥90% of "Eligible" results are genuinely eligible** per each scholarship's published criteria (measured against the curated rule set).
- **G2 — Trust:** **100% of scholarship records** display a `last verified` date and a working link to the official source. No record ships without both.
- **G3 — Deadline safety:** **0 scholarships shown as "Open"** past their close date. Status is recomputed daily.
- **G4 — Speed:** Profile-to-results in **< 2 seconds** on a mid-range Android phone over 4G.
- **G5 — Adoption (portfolio proxy):** A demo user can go from landing page to a saved scholarship with a reminder set in **under 3 minutes**, no account friction until save.

## 1.3 Non-Goals

- Not an application portal. No document uploads, no submission to CHED/DOST.
- No AI-generated eligibility decisions.
- No payments, no lead-gen to schools (MVP).
- No nationwide data completeness at MVP — depth and accuracy over breadth.

## 1.4 Target Audience / Personas

- **Persona A — "Graduating Senior" (Ana, 17):** Finishing senior high, high GWA, low family income, doesn't know which government scholarships she qualifies for or when they open. On mobile. **Needs:** a filtered shortlist and deadline reminders.
- **Persona B — "Current College Student" (Marco, 19):** Already in a STEM course, looking for continuing/allowance scholarships (DOST-SEI, foundation grants). **Needs:** eligibility clarity and a requirement checklist.
- **Persona C — "The Curator" (admin/you):** Maintains the scholarship dataset, verifies records, approves ingestion suggestions. **Needs:** a fast internal tool with an approval workflow.

## 1.5 User Stories

- As a student, I can enter my profile (education level, GWA, course field, region, income bracket, special statuses) **without creating an account** and immediately see scholarships I'm eligible for.
- As a student, I can see, for each result, **why I matched**, the **deadline**, the **requirements checklist**, and a **link to apply officially**.
- As a student, I can see **near-miss** scholarships (I fail exactly one rule) so I know what to work toward.
- As a student, I can **create an account to save** scholarships and get a **reminder email** before a deadline.
- As a student, I can trust every listing shows **when it was last verified** and **where the official info lives**.
- As the curator, I can **add/edit** a scholarship, its eligibility rules, requirements, and deadline cycle, and mark it verified.
- As the curator, I can **review AI-suggested updates** (Phase 2) and approve or reject them; nothing goes live without my approval.

## 1.6 Functional Requirements

| ID   | Requirement                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR1  | Anonymous profile form capturing matching fields (see Data Models §4.4).                                                                                     |
| FR2  | Deterministic matching engine returning **Eligible**, **Near-miss (fails 1 rule)**, and **Not eligible** buckets.                                            |
| FR3  | Result cards show: title, provider, coverage, deadline (with days-left), matched-reasons, requirement count, official link, `last verified` date.            |
| FR4  | Scholarship detail page: full description, benefits, full eligibility list, requirement checklist, deadline cycle, official + application links, disclaimer. |
| FR5  | Deadline status auto-computed (`upcoming` / `open` / `closing_soon` / `closed`) from cycle dates, refreshed daily.                                           |
| FR6  | Auth (email magic link) — required only to save and set reminders.                                                                                           |
| FR7  | Save scholarship; view saved list.                                                                                                                           |
| FR8  | Set/receive email reminder N days before a saved scholarship's deadline.                                                                                     |
| FR9  | Admin CRUD for providers, scholarships, eligibility rules, requirements, deadline cycles; "mark verified" action stamps `last_verified_at` + curator id.     |
| FR10 | **(Phase 2)** Source-watcher agent detects changes on official pages and files structured **suggestions** for admin review. Never publishes automatically.   |

## 1.7 Non-Functional Requirements

- **Accuracy/Trust:** Every public scholarship record MUST have `official_url` and `last_verified_at`. Enforced at the DB and UI layer.
- **Performance:** Match query < 2s p95; pages served as Server Components; images optimized.
- **Privacy (PH Data Privacy Act):** Matching runs on an in-session profile; nothing personal is persisted unless the user creates an account. Minimal PII. Clear privacy notice. No third-party trackers on the profile flow.
- **Security:** Supabase Row-Level Security on all user-owned tables. Admin routes gated by role. Server-side input validation (Zod).
- **Reliability:** Deterministic matching → unit-testable to 100% of rule-operator combinations. No external API on the critical read path.
- **Accessibility:** Mobile-first, WCAG AA color contrast, works on slow 3G/4G, functions without JS for core reading (Server Components).

## 1.8 Success Metrics

- % of "Eligible" results that pass manual re-check (target ≥ 90%).
- % of records with valid `official_url` + `last_verified_at` (target 100%).
- Count of scholarships shown "Open" after close date (target 0).
- Median profile→results latency (target < 2s).
- Demo task completion time (target < 3 min).

## 1.9 Open Questions / Future

- Should near-miss suggestions include "how to qualify next cycle" guidance?
- LGU/barangay scholarships: how deep to go by region for MVP?
- Notifications beyond email (SMS is expensive in PH; push needs PWA)?

---

# 2. MVP Concept Description

## 2.1 Core Hypothesis

_If students can enter a light profile and instantly get a trustworthy, deadline-ranked shortlist of scholarships they actually qualify for, they will use it instead of a spreadsheet — and the value is entirely dependent on the data being verified and current._

The MVP is a test of **data trust + matching relevance**, not of clever features.

## 2.2 Target Audience (MVP subset)

Graduating senior-high students and 1st–2nd year college students in **one or two pilot regions** (e.g., Region I / Ilocos + NCR), where you can curate government + a handful of regional scholarships deeply and accurately.

## 2.3 Problem Solved (MVP focus)

"I don't know which scholarships I qualify for or when they close." Solved by verified matching + deadline tracking, with an official hand-off link.

## 2.4 Minimum Feature Set

**IN:**

- Anonymous profile form (FR1)
- Deterministic matching → Eligible / Near-miss / Not eligible (FR2)
- Result cards + scholarship detail pages (FR3, FR4)
- Daily deadline status recompute (FR5)
- Email magic-link auth (FR6)
- Save + saved list (FR7)
- Deadline reminder email (FR8)
- Admin CRUD + "mark verified" (FR9)
- **Curated seed dataset of 10–20 real scholarships** (CHED CMSP, DOST-SEI, TES/UniFAST, a few foundation + LGU)

**OUT (deferred):**

- Automated/agentic ingestion (Phase 2, FR10)
- Nationwide coverage
- Accounts required for browsing
- SMS/push notifications
- Document upload / application submission
- Any LLM in the matching path

## 2.5 Constraints

- Solo dev, Next.js + Supabase, ~4–6 weeks part-time.
- Free/low-cost tiers (Supabase free, Vercel hobby, Resend free tier for email).
- Data must be manually verified before publish.

## 2.6 Initial Success Signal

A pilot cohort (even 20–30 real students) completes profile → saves ≥1 relevant scholarship → at least one reports the reminder helped them not miss a deadline.

---

# 3. MVP Development Plan

## 3.1 Phases & Rough Timeline (part-time)

| Phase                          | Focus                                                                         | Est.     |
| ------------------------------ | ----------------------------------------------------------------------------- | -------- |
| **P0 — Foundations**           | Repo, Next.js App Router, Supabase project, schema + RLS, seed 3 scholarships | 3–4 days |
| **P1 — Matching core**         | Pure matching module + unit tests, profile form, results page                 | 5–7 days |
| **P2 — Detail & trust**        | Detail pages, requirement checklist, verified/last-verified UI, disclaimers   | 3–4 days |
| **P3 — Accounts & saving**     | Magic-link auth, save/saved list (RLS)                                        | 3–4 days |
| **P4 — Deadlines & reminders** | Daily status cron (Edge Function), reminder emails (Resend)                   | 3–4 days |
| **P5 — Admin tool**            | Curator CRUD + mark-verified + full seed of 10–20 records                     | 4–5 days |
| **P6 — Polish & QA**           | Test plan pass, accessibility, mobile, deploy                                 | 3–4 days |
| **Phase 2 (post-MVP)**         | Agentic source-watcher (suggestions only, human approval)                     | separate |

## 3.2 Testing Strategy

- **Unit:** matching module — every operator × field × pass/fail case; status computation across date boundaries.
- **Integration:** profile→results server action; save flow with RLS; reminder cron picks correct records.
- **Manual data QA:** each seed scholarship re-checked against its official source before publish.
- **Acceptance:** the 3-minute demo task; the 90% eligible-accuracy check; the 0-stale-open check.
- See TDD §5 for the concrete test matrix.

## 3.3 Deployment

- Frontend + API on **Vercel**. DB/Auth/Storage on **Supabase**. Cron via **Supabase scheduled Edge Function** (or `pg_cron`). Email via **Resend**.

## 3.4 Key Risks & Mitigations (MVP)

| Risk                             | Mitigation                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Stale/wrong deadlines            | Daily status recompute; `last_verified_at` shown; official link always present; disclaimer.                        |
| Matching says "eligible" wrongly | Deterministic rules + exhaustive unit tests; manual re-check of seed; conservative "verify on official site" copy. |
| Data curation burden             | Start with 1–2 regions, 10–20 records; admin tool makes updates fast; Phase 2 automates _detection_ only.          |
| Minor's PII                      | No account to browse/match; minimal fields; privacy notice; RLS on stored data.                                    |
| Distribution (blogs outrank you) | Out of scope for MVP build, but note SEO-friendly detail pages (SSR, metadata) as free groundwork.                 |

## 3.5 Post-MVP Decision Criteria

- If pilot users match and save relevant scholarships and value the reminders → build Phase 2 ingestion to scale data.
- If matching relevance < 90% → fix rules/data before scaling.
- If nobody returns → the value was in the data freshness; revisit curation cadence, not features.

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
Hosting:     Vercel (app) + Supabase (data)
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

## 4.4 Data Models

```
providers
  id            uuid pk
  name          text not null
  type          text check in ('government','lgu','private','university')
  website       text
  logo_url      text

scholarships
  id                uuid pk
  provider_id       uuid fk → providers
  title             text not null
  slug              text unique not null
  summary           text
  description       text
  coverage_type     text check in ('full','partial','allowance','other')
  benefit_summary   text
  official_url      text not null          -- trust requirement
  application_url   text
  is_published      boolean default false
  last_verified_at  timestamptz            -- trust requirement (must be set to publish)
  verified_by       uuid fk → auth.users
  created_at        timestamptz default now()
  updated_at        timestamptz default now()
  -- CHECK: is_published = false OR (official_url is not null AND last_verified_at is not null)

deadline_cycles
  id             uuid pk
  scholarship_id uuid fk → scholarships (on delete cascade)
  academic_year  text                       -- e.g. '2026-2027'
  opens_at       date
  closes_at      date not null
  status         text default 'upcoming'    -- computed daily: upcoming|open|closing_soon|closed
  notes          text

eligibility_rules                            -- data-driven; new scholarships need rows, not code
  id             uuid pk
  scholarship_id uuid fk → scholarships (on delete cascade)
  field          text not null              -- must match a ProfileField key (see enum)
  operator       text not null check in ('gte','lte','eq','neq','in','includes','is_true','is_false')
  value          jsonb                       -- number | string | string[] | boolean
  is_mandatory   boolean default true
  human_label    text                        -- e.g. "GWA of 90 or higher"

requirements
  id             uuid pk
  scholarship_id uuid fk → scholarships (on delete cascade)
  label          text not null               -- e.g. "Certified True Copy of Form 138"
  is_mandatory   boolean default true
  sort_order     int default 0

student_profiles                             -- RLS: owner only; optional (anon match doesn't persist)
  id               uuid pk
  user_id          uuid fk → auth.users
  education_level  text                       -- shs_graduate | college
  year_level       int
  gwa              numeric(5,2)
  course_field     text                       -- stem | health | education | business | arts | other
  region           text
  province         text
  income_bracket   text                       -- low | mid | high  (bracketed, not exact peso)
  is_pwd           boolean default false
  is_solo_parent_dependent boolean default false
  is_indigenous    boolean default false
  is_top_graduate  boolean default false
  updated_at       timestamptz default now()

saved_scholarships                           -- RLS: owner only
  id             uuid pk
  user_id        uuid fk → auth.users
  scholarship_id uuid fk → scholarships
  created_at     timestamptz default now()
  unique(user_id, scholarship_id)

reminders                                    -- RLS: owner only
  id             uuid pk
  user_id        uuid fk → auth.users
  scholarship_id uuid fk → scholarships
  remind_on      date not null               -- computed = closes_at - lead_days
  lead_days      int default 7
  sent_at        timestamptz

-- Phase 2, admin only ------------------------------------------------
source_watch
  id             uuid pk
  scholarship_id uuid fk → scholarships
  source_url     text not null
  last_hash      text
  last_checked_at timestamptz
  change_detected boolean default false

ingestion_suggestions
  id             uuid pk
  scholarship_id uuid fk → scholarships (nullable = new candidate)
  source_url     text
  raw_extract    jsonb                       -- LLM structured guess
  proposed_diff  jsonb
  status         text default 'pending' check in ('pending','approved','rejected')
  created_at     timestamptz default now()
```

**ProfileField enum (single source of truth, shared TS type):**
`education_level | year_level | gwa | course_field | region | province | income_bracket | is_pwd | is_solo_parent_dependent | is_indigenous | is_top_graduate`

Every `eligibility_rules.field` MUST be one of these keys — enforce with a Zod validator in the admin form so a rule can never reference a field the matcher can't read.

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
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `matchProfile(profile)`                | Server Action              | Validate (Zod) → load published scholarships + rules → run matcher → return buckets. No writes.   |
| `getScholarship(slug)`                 | Server (data)              | Detail page data (SSR + metadata for SEO).                                                        |
| `saveScholarship(scholarshipId)`       | Server Action (auth)       | Insert into `saved_scholarships` (RLS enforces owner).                                            |
| `setReminder(scholarshipId, leadDays)` | Server Action (auth)       | Compute `remind_on`, upsert reminder.                                                             |
| `admin.upsertScholarship(payload)`     | Server Action (admin role) | CRUD; validates every rule.field ∈ ProfileField; blocks publish unless `official_url` + verified. |
| `admin.markVerified(id)`               | Server Action (admin role) | Sets `last_verified_at = now()`, `verified_by = uid`.                                             |
| cron: `refreshDeadlineStatus()`        | Edge Function              | §4.6 job.                                                                                         |
| cron: `sendDueReminders()`             | Edge Function              | §4.6 reminders.                                                                                   |
| **Phase 2** `watchSources()`           | Edge Function              | Fetch/diff/extract → insert `ingestion_suggestions(status='pending')`. Never publishes.           |

## 4.8 Security & Privacy Enforcement

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

| Risk                                           | Mitigation                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Rule references a field the matcher can't read | Zod-enforce `field ∈ ProfileField` in admin; unit test rejects unknown fields.                           |
| Timezone off-by-one on deadlines               | Pin all date math to Asia/Manila; boundary tests at opens_at/closes_at ±1 day.                           |
| "Eligible" shown on missing data               | Matcher treats missing mandatory field as failed; conservative by construction.                          |
| Publishing an unverified record                | DB CHECK constraint blocks publish without `official_url` + `last_verified_at`.                          |
| Reminder double-send                           | `sent_at` guard; idempotent job.                                                                         |
| RLS misconfig leaks profiles                   | Default-deny; explicit owner policies; test with two users.                                              |
| Phase-2 LLM hallucination reaches users        | Suggestions land in `ingestion_suggestions(status='pending')`; only admin approval writes a live record. |

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

---

## Appendix — Why these choices (quick rationale)

- **Deterministic matcher over AI:** eligibility must be trustworthy and explainable; "you qualify" cannot be a guess.
- **Discovery-only scope:** avoids PII/document handling and quasi-official liability; official application stays on government portals.
- **Human-in-the-loop ingestion:** makes the hard data problem tractable and the AI usage defensible — a clean agentic-AI showcase with a built-in safety story.
- **Anonymous matching:** minimizes PII for a mostly-minor audience under the PH Data Privacy Act.
- **`last_verified_at` + official link everywhere:** turns "data freshness" from a hidden liability into a visible trust feature.
