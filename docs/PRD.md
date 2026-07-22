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
| FR1  | Anonymous profile form capturing matching fields (see `DATABASE.md` §2).                                                                                     |
| FR2  | Deterministic matching engine returning **Eligible**, **Near-miss (fails 1 rule)**, and **Not eligible** buckets.                                            |
| FR3  | Result cards show: title, provider, coverage, deadline (with days-left), matched-reasons, requirement count, official link, `last verified` date.            |
| FR4  | Scholarship detail page: full description, benefits, full eligibility list, requirement checklist, deadline cycle, official + application links, disclaimer. |
| FR5  | Deadline status auto-computed (`upcoming` / `open` / `closing_soon` / `closed`) from cycle dates, refreshed daily.                                           |
| FR6  | Auth (email magic link) — required only to save and set reminders.                                                                                           |
| FR7  | Save scholarship; view saved list.                                                                                                                           |
| FR8  | Set/receive email reminder N days before a saved scholarship's deadline.                                                                                     |
| FR9  | Admin CRUD for providers, scholarships, eligibility rules, requirements, deadline cycles; "mark verified" action stamps `last_verified_at` + curator id.     |
| FR10 | **(Phase 2 — built)** RAG-grounded agentic source-watcher: a weekly cron fetches each published scholarship's official page, deterministically detects which sections changed, runs a Groq-grounded structured extraction over the changed sections, diffs against the live record, scores each proposed field change, and files per-field **suggestions** for curator approval. Never publishes automatically — approval routes through the existing validated admin actions and stamps `last_verified_at`. Tables: `source_documents`, `source_sections`, `scholarship_suggestions`; queue at `/admin/suggestions`. |

See §4 for the v2 feature backlog (FR11–FR20), scoped separately from the shipped MVP requirements above.

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

- Should near-miss suggestions include "how to qualify next cycle" guidance? **Resolved: yes, see §4.2 FR14.**
- LGU/barangay scholarships: how deep to go by region for MVP? **Still open/deferred** — out of scope for the v2 backlog in §4 (a "Reach & Inclusion" direction was considered and deliberately not prioritized this round).
- Notifications beyond email (SMS is expensive in PH; push needs PWA)? **Resolved: yes, PWA push, see §4.3 FR18. SMS remains explicitly out of scope on cost grounds.**

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

- ~~Automated/agentic ingestion (Phase 2, FR10)~~ — now built as a curator-suggestion-only source-watcher (see FR10 above). Still OUT: auto-publish, any student-facing chat/Q&A, and any LLM in the matching path.
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
| **Phase 2 (post-MVP) — built** | RAG-grounded agentic source-watcher (P12 ingestion, P13 extraction, P14 confidence + curator queue); suggestions only, human approval | separate |

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

# 4. V2 Feature Backlog (Post-MVP) — Status: Built

The MVP (FR1–FR9) proved the core loop works: verified matching + deadline tracking beats a spreadsheet. This backlog is not a random feature wishlist — every item is chosen to deepen the product's actual differentiator (**verified, current data** — see the Appendix rationale below) or to add real matching depth and return-visit value, without violating the non-goals in §1.3 or the data-minimization posture in `SECURITY.md` (SEC-G1). Three directions were prioritized for this round: **trust & data-freshness**, **matching depth & UX**, and **engagement & retention**. A fourth direction — reach & inclusion (i18n/Tagalog UI, deeper LGU/barangay coverage, admin bulk-import) — was considered and deliberately deferred; see §1.9.

**FR11–FR21 are all built** — see `ARCHITECTURE.md` §3–4 for the routes/actions, `DATABASE.md` §2 for the schema (migrations `20260101000007`–`20260101000011`, plus `20260101000013` for FR21), and `SECURITY.md` §3.9 for the new anon-write (FR13) and SEC-G1-exception (FR20) controls. The suggested phasing in §4.4 was followed in build order; every "must," "never," and security note below was honored as written, not loosened during implementation. FR21 (the application tracker) was added after the FR11–FR20 round as the natural next post-save engagement step; see §4.6.

## 4.1 Trust & Data Freshness

| ID   | Requirement |
| ---- | ----------- |
| FR11 | Public trust/data-freshness dashboard — aggregate, read-only stats (% of published records verified within the last 60 days, total published count, oldest verification age), directly surfacing PRD goal G2 as a visible product feature rather than a hidden metric. |
| FR12 | Curator staleness worklist (admin-only) — a query-only admin view listing published scholarships nearing/past the 60-day verified-staleness threshold, sorted by urgency. No new table required; a near-free companion to FR11 that reuses existing `scholarships.last_verified_at`. |
| FR13 | "Report an issue" flag on scholarship detail pages — a form (reason enum + optional email) filing into a curator moderation queue. **Not public UGC/reviews** — a moderated trust signal only. This is the app's **first anon-write endpoint** and must be treated as new attack surface, not bundled as low-risk: implement as a rate-limited Server Action using the service-role client (same shape as `submitProfileForm`/`requestMagicLink`), **never** a new `anon` RLS `insert` policy — that would break the documented invariant that no write policy exists for `anon` on any table (`DATABASE.md` §1, §5). Suggested future schema (not built in this pass): `scholarship_reports`, mirroring existing conventions — `reason` as a DB `CHECK`-constrained enum (matching the `coverage_type`/`operator` pattern, not free text), `resolved_by`/`resolved_at` mirroring `verified_by`/`last_verified_at`, and a partial index `where resolved = false` (mirrors `reminders_due_idx`). |

## 4.2 Matching Depth & UX

| ID   | Requirement |
| ---- | ----------- |
| FR14 | Near-miss "path to qualify" guidance — curator-authored (**not** AI-generated) plain-language guidance text per eligibility rule, shown for the single unmet rule in near-miss results. Resolves the §1.9 open question on near-miss guidance. Copy must read as informational ("what to work on"), never as a guaranteed-future-eligible claim — otherwise it functionally becomes a disguised AI-style eligibility decision, which §1.3 explicitly forbids. |
| FR15 | Not-eligible explainability — extend the existing `whyChips`/`gapExplainer` output (`lib/matching/build-scholarship-matches.ts`) to the not-eligible bucket: show which specific rules failed, not just near-miss's single gap. A pure UI/data-shape extension of the existing deterministic matcher output; no change to matching semantics. |
| FR16 | Scholarship comparison view — select 2–3 results from any bucket and view a side-by-side table (coverage, deadline, requirement count, mandatory rules). Purely client-side, derived from already-fetched match results; no new DB reads. |
| FR17 | Browse & filter mode independent of the profile form — a new route listing all published scholarships with filters (coverage type, provider type, region, deadline status) and keyword search, for students who want to explore before/without submitting a profile. Complements FR1/FR2 rather than replacing them. Flagged as the **heaviest single item** in this backlog (new pagination/facet/search infrastructure) — don't treat as equal-weight to FR14–FR16 when scheduling. |

## 4.3 Engagement & Retention

| ID   | Requirement |
| ---- | ----------- |
| FR18 | PWA + Web Push reminders as an alternative/addition to email — free Web Push API + VAPID keys, no per-message cost (unlike SMS). Resolves the §1.9 open question on notifications beyond email; SMS remains explicitly out of scope on cost grounds. |
| FR19 | Shareable/exportable saved list — a signed-in user generates a read-only share link (random unguessable slug, not tied to their email) or a print/PDF-friendly view of their saved shortlist, e.g. to send to a parent or guidance counselor. Must be served via a `SECURITY DEFINER` RPC or service-role-backed path returning only scholarship fields — **never** a client-facing query that could expose `user_id`/email through a future join change, mirroring the existing `is_admin()` pattern. |
| FR20 | **(SEC-G1 exception — flagged, not default)** Opt-in weekly "new matches for you" digest email. Requires persisting a signed-in user's profile answers, **only for users who explicitly opt in** — the one item in this backlog that changes the current zero-persisted-profile posture (`SECURITY.md` SEC-G1). Must ship last, with its own explicit sign-off, gated on a prior `SECURITY.md`/`DATABASE.md` amendment: a new opt-in `saved_profiles` table (RLS mirroring `reminders`' owner-CRUD via `auth.uid()`; stores the whole `Profile` as `jsonb` rather than duplicated columns; remember the `GRANT` migration `DATABASE.md` §5 warns is easy to miss). Named `saved_profiles`, deliberately **not** `student_profiles`, so `DATABASE.md`'s "Deferred / not implemented" list continues to read accurately once this ships. |
| FR21 | **Application progress tracker** — turns the saved list into the "spreadsheet replacement" the PRD positions the product as (§1.1). For **signed-in** users only: (a) a per-scholarship **application status** (`interested → preparing → applied → submitted`); (b) the requirement checklist on detail pages now **persists** (previously ephemeral `useState`, reset on reload); (c) a short private **note** per scholarship; and (d) a requirement-progress bar (`done/total`) on the saved list. Deterministic, no LLM. Two new **owner-scoped, authenticated-write** tables — `application_progress`, `requirement_checkoffs` (RLS via `auth.uid()`, mirroring `reminders`/`saved_scholarships`; `GRANT`s included per `DATABASE.md` §5). This is **not** anon-write (contrast FR13) and does **not** persist the matching profile, so the zero-persisted-profile posture (`SECURITY.md` SEC-G1, and FR20's opt-in exception) is **unchanged**. Anonymous visitors keep the ephemeral checklist — no login wall. Migration `20260101000013`; see §4.6. |

## 4.4 Suggested Phasing

Mirrors the §3.1 phase-table style; risk-ordered rather than theme-ordered, since some engagement items carry lower risk than some trust items.

| Phase | Items | Why this grouping |
| ----- | ----- | ------------------ |
| P7 | FR11, FR14, FR12, FR15 | Near-zero risk: pure read queries or data-shape extensions of already-deterministic output. No new write surface, no new privacy surface. |
| P8 | FR13 alone | First anon-write endpoint in the app — new attack surface, deserves its own rate-limiting/moderation-queue build, not bundled with "low risk" items. |
| P9 | FR17, then FR16 | Heavier discovery infra first; the comparison view is lighter client-side work that can build on it. |
| P10 | FR18, FR19 | Low-privacy-risk engagement. FR19's share link must use the SECURITY DEFINER/service-role pattern above, not a client-facing RLS policy. |
| P11 | FR20 alone | Gated on its own security review and doc amendment before build — never bundled automatically with the rest. |

## 4.5 Reaffirmed Non-Goals

Nothing in this backlog introduces application/document submission, payments, or AI-generated eligibility decisions — FR14's guidance text is curator-authored, not model-generated. No feature defaults anonymous users into a persisted profile: FR20 is opt-in, signed-in-only, and the sole exception to the zero-persisted-profile posture, called out as such rather than slipped in silently. FR21 (§4.6) persists per-scholarship *tracking* state, not the matching profile, so it does **not** touch that posture.

## 4.6 Application Tracker (FR21)

The MVP explicitly frames itself as the replacement for a student's personal tracking spreadsheet (§1.1). FR11–FR20 deepened discovery, matching, trust, and notifications, but the **post-save** experience still stopped at bookmark + reminder — the saved list did none of the things a spreadsheet does after you find a scholarship. FR21 closes that gap and is the highest **return-visit** feature in the product (a student reopens it every time they work on an application — the §4.3 engagement/retention goal).

**What it adds (signed-in only, same account gate as save/reminders — FR6/FR7):**

- **Application status** per saved scholarship: `interested → preparing → applied → submitted`, editable on the saved list.
- **Persisted requirement checklist**: the detail-page checklist (`components/detail/requirement-checklist.tsx`) was previously ephemeral `useState` and reset on every reload; it now writes each toggle to `requirement_checkoffs` for signed-in users. Anonymous visitors keep the ephemeral behavior — **no login wall, no regression**.
- **Private note** per scholarship (≤1000 chars).
- **Progress bar** (`done/total` requirements) on each saved-list row, linking to the detail checklist.

**Alignment / boundaries honored:** deterministic and LLM-free; owner-scoped RLS via `auth.uid()` mirroring `reminders`/`saved_scholarships`; server actions take `user_id` from the session, never a request param (`SECURITY.md` §3.4); **authenticated-owner write, not anon-write** (contrast FR13); `GRANT`s shipped in the same migration (`DATABASE.md` §5). It does **not** persist the matching profile (that remains FR20's opt-in-only exception), add application/document submission (§1.3 non-goal), or expand the FR19 share payload. Tables: `application_progress`, `requirement_checkoffs` (migration `20260101000013`); actions in `lib/actions/application-tracker.ts`.

---

## Appendix — Why these choices (quick rationale)

- **Deterministic matcher over AI:** eligibility must be trustworthy and explainable; "you qualify" cannot be a guess.
- **Discovery-only scope:** avoids PII/document handling and quasi-official liability; official application stays on government portals.
- **Human-in-the-loop ingestion:** makes the hard data problem tractable and the AI usage defensible — a clean agentic-AI showcase with a built-in safety story.
- **Anonymous matching:** minimizes PII for a mostly-minor audience under the PH Data Privacy Act.
- **`last_verified_at` + official link everywhere:** turns "data freshness" from a hidden liability into a visible trust feature.
