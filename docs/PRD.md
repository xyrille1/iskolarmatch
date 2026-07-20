# IskolarMatch — Product Requirements Document

_A Philippine scholarship discovery and matching tool. Matches a student's profile to CHED, DOST-SEI, and local scholarships, tracks deadlines and requirements, and hands users off to official application sources._

**Document set:** PRD → MVP Concept → MVP Development Plan
**Companion to:** `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `SECURITY.md`
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
| FR1  | Anonymous profile form capturing matching fields (see `DATABASE.md` §4.4).                                                                                   |
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
- See `ARCHITECTURE.md` §5 for the concrete test matrix.

## 3.4 Key Risks & Mitigations (MVP)

| Risk                              | Mitigation                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Stale/wrong deadlines             | Daily status recompute; `last_verified_at` shown; official link always present; disclaimer.                        |
| Matching says "eligible" wrongly  | Deterministic rules + exhaustive unit tests; manual re-check of seed; conservative "verify on official site" copy. |
| Data curation burden              | Start with 1–2 regions, 10–20 records; admin tool makes updates fast; Phase 2 automates _detection_ only.          |
| Minor's PII                       | No account to browse/match; minimal fields; privacy notice; RLS on stored data.                                    |
| Distribution (blogs outrank you)  | Out of scope for MVP build, but note SEO-friendly detail pages (SSR, metadata) as free groundwork.                 |

## 3.5 Post-MVP Decision Criteria

- If pilot users match and save relevant scholarships and value the reminders → build Phase 2 ingestion to scale data.
- If matching relevance < 90% → fix rules/data before scaling.
- If nobody returns → the value was in the data freshness; revisit curation cadence, not features.

---

## Appendix — Why these choices (quick rationale)

- **Deterministic matcher over AI:** eligibility must be trustworthy and explainable; "you qualify" cannot be a guess.
- **Discovery-only scope:** avoids PII/document handling and quasi-official liability; official application stays on government portals.
- **Human-in-the-loop ingestion:** makes the hard data problem tractable and the AI usage defensible — a clean agentic-AI showcase with a built-in safety story.
- **Anonymous matching:** minimizes PII for a mostly-minor audience under the PH Data Privacy Act.
- **`last_verified_at` + official link everywhere:** turns "data freshness" from a hidden liability into a visible trust feature.
