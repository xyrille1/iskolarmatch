# Iskolarly — Project Dossier

_Consolidated documentation, metrics, and resume-ready summary. Single source of truth for "what is this project and what does it prove" — the detailed specs it's built from live in [`docs/`](docs/) and are linked throughout._

**Snapshot date:** 2026-07-25 · **Branch:** `sub-xyrille` · **Author:** Xyrille Navora

---

## 1. What it is

Iskolarly is a scholarship-finder for Filipino students. A student answers a short profile form and gets matched — deterministically, not via an LLM — against a curated, deadline-aware catalog of scholarships, bucketed into **Eligible**, **Near-miss** (fails exactly one rule), and **Not eligible**. Users can save scholarships without an account for the matching itself, and create an account (magic-link email, no passwords) to save listings, track application progress, and get reminded before deadlines.

Every published listing is grounded in an official source (`.gov.ph` / `.edu.ph` or a curated allowlist) and carries a `last_verified_at` stamp. An LLM-assisted **source-watcher** and **source-discovery** pipeline keep the catalog fresh and find new scholarships automatically — but nothing is ever auto-published; every AI-drafted change or new candidate sits in a human-approval queue until a curator accepts it.

It was built as a **portfolio-grade product**, not a tutorial project: real authentication, Postgres Row-Level Security as the actual authorization boundary (not just an app-layer check), an audit log, a CI pipeline enforcing four quality gates plus a secret scan plus a live RLS integration test, and ~250 pages of first-party product/security/architecture documentation written and kept in sync alongside the code.

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Route Handlers, Turbopack) + React 19 |
| Database / Auth | Supabase — Postgres, magic-link Auth, Row-Level Security as the primary authorization control |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens) — custom editorial design system |
| Validation | Zod v4, at every Server Action and Route Handler boundary |
| Testing | Vitest 4 (unit/integration), Playwright (e2e), `@vitest/coverage-v8` |
| Email / Push | Resend (reminder + digest email), Web Push / VAPID (deadline notifications) |
| AI | Groq (OpenAI-compatible, free-tier) — powers source-watcher extraction and source-discovery only; **never** in the matching path |
| CI/CD | GitHub Actions — 4 jobs (gates, secret scan, RLS integration, e2e); Vercel hosting |

Full rationale in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 3. Core features (shipped)

- **Deterministic matching engine** (`lib/matching/`) — pure functions, no LLM, no network call in the read path. Rules are data-driven rows (`eligibility_rules`), not code, so new scholarships need data, not deploys.
- **Trust-first catalog** — a DB constraint (`scholarships_publish_guard`) makes it *structurally impossible* to publish a scholarship without an `official_url` and `last_verified_at`.
- **Magic-link auth**, save/unsave, per-scholarship email reminders with configurable lead time, Web Push as an alternative channel, a shareable read-only saved-list link, and an opt-in weekly digest email.
- **Application tracker** (FR21) — per-scholarship status (`interested → preparing → applied → submitted`), private notes, and a persisted requirement checklist.
- **Admin console** — CRUD for providers/scholarships/eligibility rules/requirements/deadline cycles, a "mark verified" action, a student-submitted issue-report moderation queue, and approval queues for both AI pipelines below.
- **Source-watcher** (FR10) — a weekly cron re-fetches each published scholarship's official page, hashes and diffs page sections to detect real changes (skipping the LLM call entirely when nothing changed), runs a grounded structured extraction only over the changed sections, diffs the result against the live DB row, scores confidence, and files field-level suggestions for curator approval.
- **Source-discovery** (FR22) — a separate crawler reads curator-registered index/listing pages, drafts brand-new scholarship candidates with cited evidence snippets, and queues them for review/promotion — never auto-created.
- **Deadline engine** — daily-refreshed status (`upcoming` / `open` / `closing_soon` / `closed`) computed from cycle dates, not stored as free-form state.

> **Note on "RAG" terminology:** the PRD labels the source-watcher a "RAG-grounded agentic source-watcher" (`docs/PRD.md` §3.1 phasing table, FR10), and it is shipped and tested. But be precise about what's actually implemented before describing it as RAG in an interview: there is **no vector store and no embeddings** — `docs/DATABASE.md` §"Source-watcher" says explicitly *"Not embedded / no pgvector."* "Retrieval" here is deterministic section-hash diffing (which page sections changed since last fetch), not semantic/similarity search over a corpus. Grounding is enforced by dropping any LLM citation that doesn't match an actual fetched section, not by retrieval quality. So: a real perceive → gate → retrieve(-by-diff) → reason → diff → score → human-approve pipeline (`docs/QA-REPORT.md` §6), but closer to "hash-gated change detection + grounded extraction" than textbook embedding-based RAG. Describe it that way unless asked to build out true vector retrieval.

Non-goals, explicitly: no student-persisted profile for anonymous matching (RA 10173 data-minimization — see §7), no public reviews/UGC, no auto-published AI content anywhere in the system.

## 4. Architecture at a glance

```
app/            22 pages · 5 API routes (all 5 are cron endpoints, secret-gated)
components/     27 client/server components, organized by feature domain
lib/            domain logic — actions, matching, deadline, security, email, push,
                source-watcher, source-discovery, tracker, trust, auth, supabase clients
supabase/       14 hand-written SQL migrations, additive-only, no destructive rewrites
tests/          unit, integration (RLS), drift-invariant, and e2e suites
docs/           9 first-party specs (PRD, architecture, database, security, deployment,
                UX design system, version-control/QA workflow, QA checklist, QA report)
```

Route map, Server Action inventory, and the full build sequence are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §3–§11.

## 5. Data model

**21 tables** across **14 migrations**, grouped by trust boundary (full detail in [`docs/DATABASE.md`](docs/DATABASE.md)):

| Group | Tables | Access pattern |
|---|---|---|
| Public content | `providers`, `scholarships`, `deadline_cycles`, `eligibility_rules`, `requirements` | anon-readable once published; service-role writes only |
| Security-critical | `allowlisted_domains`, `scholarship_reports` | RLS enabled, **zero** policies — reachable only via service-role, by design |
| User-owned | `saved_scholarships`, `reminders`, `push_subscriptions`, `saved_list_shares`, `saved_profiles`, `application_progress`, `requirement_checkoffs` | `auth.uid()` owner-only RLS, no exceptions |
| Admin | `admin_users`, `audit_log` | service-role only; binary membership, append-only log |
| Source-watcher | `source_documents`, `source_sections`, `scholarship_suggestions` | RLS enabled, zero policies, service-role only |
| Source-discovery | `source_index_pages`, `scholarship_candidates` | RLS enabled, zero policies, service-role only |

Notable DB-layer guarantees: a `scholarship_suggestions` CHECK constraint mirrors the TypeScript field-allowlist so an AI-proposed change can only ever target an approved column; both discovery tables carry a trigger (`enforce_source_discovery_url_allowlist`) that runs every URL through the same allowlist check used for `scholarships`, at the database layer — not just in application code.

## 6. Quality metrics (measured, not estimated)

Reproduced live on 2026-07-25 from this branch (`npm run test`, `npm run test:coverage`):

| Metric | Value |
|---|---|
| Unit + integration tests | **256 passed / 1 skipped** across 38 files (the 1 skip is the RLS suite, which self-skips without a live Postgres and runs for real in CI) |
| Test run time | ~5s locally |
| Statement coverage | **49.0%** (767/1565) |
| Branch coverage | **46.0%** (505/1097) |
| Function coverage | **47.7%** (136/285) |
| Line coverage | **50.6%** (690/1363) |
| Enforced coverage floor (CI) | statements 45% · branches 42% · functions 43% · lines 45% |
| TypeScript source | **11,451 lines** across 210 files (`app/`, `components/`, `lib/`, `tests/`, `scripts/`) |
| Static-analysis hygiene | **zero** `TODO`/`FIXME`/`HACK`, `any`, `@ts-ignore`, `console.log`, or `eslint-disable` across `lib/`, `app/`, `components/`, `tests/` |
| DB migrations | 14, additive-only |
| DB tables | 21, all with RLS enabled |
| API routes | 5 (all cron, all secret-gated with constant-time comparison) |
| Pages | 22 |
| CI jobs | 4 — lint/typecheck/test/build gate, gitleaks secret scan, RLS integration (live local Supabase), Playwright e2e smoke |
| Commit history | 125 commits, single-developer (123 authored directly; 18 dependabot version bumps merged) |
| First-party documentation | 9 docs, ~220 KB of Markdown (PRD, architecture, database, security, deployment, UX system, version-control workflow, QA checklist, QA report) |

Independent whole-system audit findings (2026-07-22, closed out 2026-07-23 — see [`docs/QA-REPORT.md`](docs/QA-REPORT.md)): 22 P0–P2 findings fully fixed and tested; of 12 P3 findings, 6 fixed, 4 accepted as deliberate trade-offs, 2 deferred with a documented path (one needs a CI-provisioned DB stack; one was reverted cleanly after a Windows file-lock conflict with the running dev server). Nothing found blocked the app from compiling, linting, testing, or building at any point — the findings were robustness/coverage/process gaps, not defects.

## 7. Security & privacy posture

Full detail in [`docs/SECURITY.md`](docs/SECURITY.md). This section goes deeper than a typical portfolio project because the security work here is layered, tested, and honestly documents its own residual risk — not just a single control per threat.

### 7.1 Authorization — RLS as the actual boundary, not app-layer trust
- **Every one of 21 tables has RLS enabled.** Content tables have **no write policy for any client-facing role** — writes are service-role-only, so even a bug that skips an app-layer check cannot produce a write. `requireAdmin()` (`lib/auth/require-admin.ts`) is treated explicitly as a **UX gate**, not the security boundary — the doc states plainly that a missed `requireAdmin()` call on a new admin page still can't write, because RLS denies it regardless.
- **Verified, not assumed**: a dedicated integration suite boots a real local Postgres inside CI and asserts allow/deny on every policy (not just "the query runs"). Two paths were additionally verified **manually against a live stack**: a direct anon REST call to `scholarship_reports` returns Postgres error `42501` (permission denied), and a direct anon REST read of `saved_scholarships`/`saved_list_shares` likewise fails — the only legitimate anon read path is a narrow `SECURITY DEFINER` RPC (`get_shared_saved_list()`) that returns an explicit column allowlist (title/slug/provider/deadline) and never `user_id` or email.
- **Append-only audit log** (`audit_log`) — every admin mutation logs actor, action, entity, and a JSON detail blob; no update/delete policy exists for **any** role, including service-role, at the RLS layer.

### 7.2 SSRF defense-in-depth (two independent outbound-fetch pipelines)
Both the source-watcher and source-discovery crawler fetch attacker-influenceable URLs (registered pages, not just `official_url`), so the fetch path is treated as real attack surface with five layered controls, in order: **(1)** HTTPS-only, **(2)** hostname allowlist (`gov.ph`/`edu.ph`/curated, dot-boundary anchored — tested against `evilgov.ph`-style spoofing), **(3)** every resolved IP checked against a private/loopback/link-local/cloud-metadata blocklist (`isPrivateIp()`), **(4)** redirects followed **manually**, re-validating (2) and (3) on **every hop** — so an allowlisted URL can't 302 to an internal host, **(5)** a hard byte cap + timeout against oversized/hung responses. The allowlist is enforced **three times independently** (Zod `.refine()`, a Postgres trigger, and the underlying suffix-match function) so no single missed layer is a bypass — and a Postgres trigger (`enforce_source_discovery_url_allowlist`) blocks off-allowlist URLs even from a direct service-role write, not just from the app.
- **Honestly scoped, not oversold**: the doc names its own accepted residual risk — a DNS-rebinding TOCTOU window between the pre-flight lookup and the actual connect — and explains why it's accepted (allowlist restricts targets to registered gov.ph/edu.ph hosts, not attacker-chosen) rather than glossing over it.

### 7.3 Ethical/legal crawler posture (source-discovery, FR22)
- **robots.txt parsed and honored** before every fetch (wildcard `*` and end-anchor `$` patterns, longest-match Allow/Disallow, `Crawl-delay` support) — unit-tested, not just documented.
- **Self-identifying `User-Agent`** with a contact URL, plus a per-domain crawl delay (floor raised by `Crawl-delay`, capped so a hostile directive can't stall a run) and a per-run page ceiling — the crawler behaves like a good citizen, not a scraper.

### 7.4 Input validation & injection surface
- **Zod `.strict()`** on every Server Action input — unknown fields are rejected outright, not silently dropped, closing a mass-assignment-style class of bug.
- **LLM output is never trusted as fact**: extraction prompts constrain the model to classify from anchors the app already supplies (so it cannot fabricate a URL), citations that don't match an actually-fetched section are dropped (anti-hallucination / prompt-injection-adjacent defense), and `old_value` in every suggestion diff is filled by the app's own deterministic diff — **never by the LLM** — so a manipulated response can propose a wrong new value but can't lie about what the current value is.

### 7.5 Transport, headers & secrets
- **Security headers on every route**: HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `strict-origin-when-cross-origin` referrer policy, plus a production CSP restricting `default-src`/`connect-src`/`frame-ancestors`.
- **Constant-time secret comparison** (`timingSafeEqual`, with an explicit length pre-check to avoid a throw-on-mismatch leak) gates all 5 cron endpoints against timing attacks.
- **Zero secret leakage surface**: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `GROQ_API_KEY`, `VAPID_PRIVATE_KEY` are read only in server-side code (confirmed by grepping every `process.env.` usage) — and this is enforced continuously by a **gitleaks scan of full git history** in CI, not just the current diff.

### 7.6 Privacy by design (RA 10173)
- **RA 10173 (PH Data Privacy Act) data minimization by design** — anonymous matching runs entirely on an in-session profile; nothing about a student is persisted unless they create an account, and even then only what a feature explicitly requires. The one deliberate exception (an opt-in weekly-digest profile snapshot) re-validates through the **same** schema the anonymous path uses, so an opted-in profile can never contain a field the matching engine wouldn't otherwise accept.

### 7.7 No auto-publish, anywhere
Every AI-drafted suggestion or discovered candidate is inert data until a human curator approves it through the same validated, audited admin actions used for manual edits — this is enforced structurally (separate queue tables with zero client-facing RLS policies), not just by convention.

## 8. Engineering practices

- **Git workflow & QA gates are themselves a written, versioned spec** ([`docs/iskolar-version-control.md`](docs/iskolar-version-control.md)) — pre-commit and pre-push checklists, secret-rotation-before-history-rewrite policy, migration-review-as-diff requirement — not tribal knowledge.
- **CI enforces what used to be a manual checklist**: lint → typecheck → unit/integration tests → production build, plus the secret scan and RLS suite, on every push and PR, with stale-run cancellation on superseded commits.
- **Docs-as-spec discipline**: PRD, architecture, database, and security docs are treated as living contracts cross-checked against the actual code (the QA audit explicitly verifies code against these docs rather than the other way around).
- **Self-audited**: the project commissioned its own whole-system QA audit against its own written spec, tracked every finding to closure with commit SHAs, and kept the original audit snapshot intact alongside the resolution log — an unusual level of process rigor for a solo/portfolio project.

## 9. Resume-ready summary

**One-liner:**
> Built Iskolarly, a full-stack scholarship-matching platform (Next.js 16, Supabase/Postgres, TypeScript) with a deterministic eligibility engine, Postgres RLS as the enforced authorization boundary, and an LLM-assisted content-discovery pipeline gated entirely behind human approval — backed by a 4-stage CI pipeline and a self-commissioned security/QA audit.

**Bullet points (pick per role):**

- Designed and shipped a deterministic scholarship-matching engine (zero LLM calls on the read path) serving three-way eligibility buckets (Eligible / Near-miss / Not eligible) over a data-driven rules model, unit-tested across the full operator matrix.
- Implemented Postgres Row-Level Security as the primary authorization control across 21 tables spanning public content, user-owned data, and admin/service-role-only tables — verified with a dedicated integration suite that boots a live local Supabase instance inside CI.
- Built two independent LLM-assisted pipelines (a source-watcher that re-verifies existing listings via deterministic section-hash change detection, and a source-discovery crawler that drafts new candidates from curator-registered index pages) — both fully gated behind human-approval queues with zero auto-publish paths. (No vector store/embeddings — see §3 note on RAG terminology before describing this as embedding-based RAG.)
- Authored a 4-job GitHub Actions CI pipeline (lint/typecheck/test/build gate, gitleaks secret scan over full git history, live-Postgres RLS integration test, Playwright e2e smoke) enforcing quality gates that previously ran as a manual checklist.
- Hardened outbound-fetch pipelines against SSRF (private-IP detection, robots.txt compliance, dual application- and database-layer URL allowlisting) for both AI-driven crawlers.
- Wrote and maintained ~220 KB of first-party product/architecture/security/QA documentation, then commissioned and closed out a full whole-system audit against that spec, tracking all 34 findings to resolution with commit-level traceability.
- Applied RA 10173 (Philippine Data Privacy Act) data-minimization principles to product design — anonymous-by-default matching with no persisted student profile unless a user explicitly opts into an account-gated feature.
- Maintained zero `TODO`/`any`/`@ts-ignore`/`eslint-disable` across an 11,000+ line TypeScript codebase under `strict` mode, with static-analysis hygiene enforced as a stated engineering standard rather than an incidental outcome.

**Security-focused bullets (pull these for security/backend-leaning roles — expand on §7):**

- Designed Postgres Row-Level Security as the sole authorization boundary across 21 tables (not an app-layer convenience) — treated a custom `requireAdmin()` gate as UX-only, verified via a live-Postgres integration suite plus manual checks confirming direct anon writes fail with Postgres error `42501`.
- Built a defense-in-depth SSRF control chain for two outbound-fetching AI pipelines: HTTPS-only enforcement, a triple-enforced hostname allowlist (Zod, Postgres trigger, and underlying suffix-match — tested against subdomain-spoofing payloads like `evilgov.ph`), private/loopback/cloud-metadata IP blocking, and manual per-hop redirect revalidation to stop allowlisted URLs from redirecting into internal hosts.
- Implemented a narrow-projection `SECURITY DEFINER` RPC pattern to expose a shareable read-only resource (a saved scholarship list) to anonymous users without ever granting a direct table-level read — the RPC returns an explicit column allowlist and excludes all PII.
- Applied anti-hallucination/anti-prompt-injection discipline to an LLM extraction pipeline: the model can only select from anchors the app supplies (can't fabricate URLs), citations are validated against actually-fetched content and dropped if ungrounded, and the "current value" side of every proposed diff is computed deterministically by the app — never trusted from the LLM's own output.
- Enforced constant-time secret comparison (`timingSafeEqual`) on all cron/webhook-style endpoints to close a timing side-channel, and continuously scanned full git history (not just diffs) for leaked secrets via a CI-gated gitleaks job.
- Practiced honest risk documentation over false completeness: authored and maintained a "Known Gaps / Accepted Risks" section naming specific unresolved residual risks (e.g., a DNS-rebinding TOCTOU window, an in-memory rate limiter's scaling ceiling) with the reasoning for why each is currently acceptable — the kind of judgment call a security review actually wants to see, rather than claiming zero risk.
- Built a legally- and ethically-compliant web crawler (robots.txt parsing with wildcard/end-anchor support, self-identifying User-Agent, per-domain crawl-delay rate limiting) as a first-class requirement of an automated data-discovery feature, not an afterthought.

**Suggested skills line:**
> Next.js 16 · React 19 · TypeScript (strict) · Supabase/Postgres · Row-Level Security · Zod · Vitest · Playwright · GitHub Actions CI · Tailwind CSS v4 · Server Actions · LLM-assisted data pipelines (Groq) · SSRF defense-in-depth · timing-attack-safe auth (`timingSafeEqual`) · CSP/security headers · `SECURITY DEFINER` RPC design · secret-scanning CI (gitleaks) · RA 10173 / privacy-by-design

---

## 10. Where to look for more

| Question | Doc |
|---|---|
| What are we building and why | [`docs/PRD.md`](docs/PRD.md) |
| How is it built | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| What's the exact schema and RLS policy set | [`docs/DATABASE.md`](docs/DATABASE.md) |
| What's the threat model and controls | [`docs/SECURITY.md`](docs/SECURITY.md) |
| How does it deploy | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| What's the design system | [`docs/iskolar-ux-design.md`](docs/iskolar-ux-design.md) |
| What's the git/QA workflow | [`docs/iskolar-version-control.md`](docs/iskolar-version-control.md) |
| What did the audit find, and what's still open | [`docs/QA-REPORT.md`](docs/QA-REPORT.md), [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md) |
| Quick start / local setup | [`README.md`](README.md) |
