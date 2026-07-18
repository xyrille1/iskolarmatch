# IskolarMatch — Security & Safety PRD / MVP

_A dedicated security and data-protection specification for IskolarMatch, the Philippine scholarship discovery and matching tool. Covers threat model, data classification, security requirements, an MVP-realistic hardening scope, a security test checklist, and incident response._

**Companion to:** `scholarship-finder-spec.md` (PRD → MVP → TDD)
**Owner:** Xyrille · **Stack:** Next.js + TypeScript + Supabase (Postgres) + Tailwind · **Hosting:** Vercel + Supabase + Resend
**Status:** Draft v1 for build

---

## 0. Scope & Assumptions

These make the document buildable without blocking. Correct any that are wrong before starting.

- `[ASSUMPTION]` This is a **portfolio-grade, solo build on free tiers** (Supabase free, Vercel hobby, Resend free). Security measures are chosen to be _strong but proportionate_ — no paid WAF, no SOC tooling, no dedicated security staff. Every control here is achievable by one developer.
- `[ASSUMPTION]` The audience **includes minors (16–18)**, and the **Philippine Data Privacy Act of 2012 (RA 10173)** applies. This raises the bar on personal-data handling even though the app stores very little.
- `[ASSUMPTION]` The design goal is **radical data minimization**: browsing and matching are anonymous and persist nothing; an account exists only to save scholarships and set reminders.
- `[ASSUMPTION]` The app **never** accepts documents or scholarship applications. It links out to official portals. This deliberately keeps the highest-risk data (IDs, financial docs) off the system entirely.
- `[ASSUMPTION]` Security is treated as **part of the MVP**, not a later phase — but Phase 2 (agentic ingestion) carries its own threats handled in §10.

---

## 1. Security Objectives (SMART)

- **SEC-G1 — Data minimization:** No sensitive personal information (disability, indigenous status, income) is ever **persisted** server-side in the MVP. Target: **0** such fields in any stored row.
- **SEC-G2 — Tenant isolation:** No authenticated user can read or write another user's saved list, reminders, or profile. Target: **100%** of user-owned tables protected by default-deny Row-Level Security, proven by a two-user test.
- **SEC-G3 — Link/data integrity:** Every published `official_url` / `application_url` resolves to an **allowlisted government, education, or verified-foundation domain**. Target: **0** off-allowlist outbound "apply" links reaching students.
- **SEC-G4 — Secret safety:** The Supabase **service-role key and all provider secrets never reach the client bundle**. Target: **0** privileged secrets in any client-shipped file (verified by build-time scan).
- **SEC-G5 — Recoverability:** The core asset (the curated dataset) is **fully reproducible from version control**. Target: a clean environment can be rebuilt from git migrations + seed in **under 30 minutes**, with **0** dependence on a single live database.
- **SEC-G6 — Injection resistance:** **100%** of server-action inputs pass through a Zod schema that rejects unknown fields; **0** raw string-interpolated SQL anywhere in the codebase.

---

## 2. Assets & Trust Boundaries

**What we protect, ranked by impact if compromised:**

| #   | Asset                                                                  | Why it matters                                                                                                | Primary threat                         |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A1  | **Curated scholarship data** (records, deadlines, official/apply URLs) | The product's entire value; also a _safety_ surface — a bad link can phish a minor or cause a missed deadline | Tampering, integrity loss, deletion    |
| A2  | **Users' minimal PII** (email; saved lists; reminders)                 | Belongs to students, many of them minors; regulated under RA 10173                                            | Unauthorized read (RLS bypass), breach |
| A3  | **Admin / curator account**                                            | Can publish, edit links, and (Phase 2) approve ingestion — the keys to A1                                     | Account takeover, privilege escalation |
| A4  | **Service-role key & provider secrets** (Supabase, Resend)             | Bypasses RLS entirely; sends mail as the brand                                                                | Secret leakage                         |
| A5  | **Availability of the read path**                                      | Students rely on it near deadlines                                                                            | DoS, free-tier pausing, data loss      |

**Trust boundaries:**

```
 UNTRUSTED                     SEMI-TRUSTED                  TRUSTED
 ─────────                     ────────────                  ───────
 Anonymous student   ──▶  Next.js Server Actions   ──▶  Supabase (RLS)
 (browser, public)        (validate + authorize)         Postgres + Auth
                                                          │
 Scraped web pages   ──▶  Phase-2 watcher (LLM)   ──▶  ingestion_suggestions
 (Phase 2, hostile)       (extract only, no publish)     (admin-gated)
                                                          │
 Curator (browser)   ──▶  Admin Server Actions     ──▶  publish path
                          (role check server-side)       (audit-logged)
```

Every arrow crossing left-to-right is a place where input is **validated, authorized, and — for the LLM boundary — treated as hostile**. The service-role key lives only inside the rightmost boundary.

---

## 3. Threat Actors

- **TA1 — Opportunistic attacker / bot:** scans for exposed keys, tries injection payloads, brute-forces auth, scrapes. Most likely; automated.
- **TA2 — Malicious authenticated user:** signs up, then probes to read _other users'_ data (IDOR/RLS gaps) or abuse rate limits.
- **TA3 — Data-integrity attacker:** aims to alter a published record — swap an `application_url` for a phishing page, or push a deadline — to harm students or embarrass the project. High _safety_ impact given the minor audience.
- **TA4 — Compromised admin session:** phished or session-hijacked curator; inherits publish rights.
- **TA5 — Hostile web content (Phase 2):** a scraped scholarship page carrying a prompt-injection payload aimed at the extraction LLM.
- **TA6 — Accidental self-inflicted loss:** the solo dev fat-fingers a migration, a free-tier project pauses/expires, or a dependency breaks. Statistically the _most probable_ cause of real damage on a solo project — treated as a first-class threat.

---

## 4. Data Classification & Privacy (RA 10173)

**Classify before you protect.** The single most important privacy decision is that the sensitive fields never become persistent records.

| Class                                         | Fields                                                                      | Handling rule                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Sensitive Personal Information** (RA 10173) | `is_pwd` (health/disability), `is_indigenous` (ethnicity), `income_bracket` | **Session-only. Never written to a persisted row in the MVP.** Used transiently inside the anonymous match request, then discarded. |
| **Personal Information**                      | email address, `region`/`province`, GWA, course field                       | Email is stored (needed for auth + reminders). Others stay session-only in the anonymous flow.                                      |
| **Public data**                               | scholarships, providers, rules, requirements, deadline cycles               | Readable by anyone; integrity-critical (A1). Writes are admin-only.                                                                 |
| **Operational secrets**                       | service-role key, Resend key, cron secret                                   | Server-only; see §7.                                                                                                                |

**Privacy requirements (PR):**

- **PR1 — No persisted profile in MVP.** The `student_profiles` table (spec §4.4) is **deferred out of the MVP**. Matching runs entirely in-session and writes nothing. This removes the hardest RA-10173 problem — storing _sensitive information about minors_ — instead of trying to secure it. If a persisted profile is added later, it must exclude the sensitive class above or gate them behind explicit, revocable consent.
- **PR2 — Lawful basis + notice.** A clear privacy notice states what is collected (essentially: an email, and the scholarships you chose to save), the purpose (matching + reminders), retention, and the right to delete. Written in plain language a 16-year-old understands.
- **PR3 — Minor-aware framing.** Because many users are minors, the notice avoids collecting anything not strictly needed, and the account flow asks for _nothing_ beyond an email.
- **PR4 — Right to erasure.** A signed-in user can delete their account, which cascades to saved lists and reminders. One documented, tested path.
- **PR5 — Data-retention limit.** Reminders and saved rows for closed cycles can be pruned on a schedule; email retained only while the account exists.
- **PR6 — No third-party trackers on the match/profile flow** (already a spec NFR) — no analytics that ship PII to third parties on the sensitive path.

---

## 5. Security Requirements — Authentication & Authorization

| ID    | Requirement                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-A1 | **Auth via Supabase magic link only.** No passwords to leak. Rely on Supabase-managed token issuance and expiry.                                                                                                                                                          |
| SR-A2 | **Short link/OTP lifetime** and single-use tokens (Supabase defaults; confirm expiry is set conservatively, e.g. ≤ 1 hour).                                                                                                                                               |
| SR-A3 | **Row-Level Security is default-deny** and enabled on every user-owned table (`saved_scholarships`, `reminders`, and `student_profiles` if ever added). Policy: `user_id = auth.uid()` for select/insert/update/delete. RLS is the authorization backbone — not app code. |
| SR-A4 | **Public tables are read-only to anon**, gated by `is_published = true`. Writes to `scholarships`, `providers`, `eligibility_rules`, `requirements`, `deadline_cycles` occur only via admin/service context.                                                              |
| SR-A5 | **Admin authorization is checked server-side on every admin action**, from a trusted source (a `role` claim or an `admin_users` table keyed by `auth.uid()`) — **never** from a client-supplied value, header, or hidden form field.                                      |
| SR-A6 | **No IDOR by construction.** Server actions derive `user_id` from the session (`auth.uid()`), never from request parameters. A user cannot act "as" another by passing an id.                                                                                             |
| SR-A7 | **Auth-endpoint rate limiting** to blunt magic-link spamming / email enumeration (see SR-R1). Login responses do not reveal whether an email exists.                                                                                                                      |
| SR-A8 | **Session hygiene:** sign-out revokes the session; sensitive admin actions re-verify the session server-side.                                                                                                                                                             |

---

## 6. Security Requirements — Input Validation & Injection Prevention

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-I1 | **Zod on every server-action input**, with `.strict()` semantics — unknown fields are rejected, types coerced/validated, ranges bounded (e.g. GWA within a sane numeric range, enums restricted to `ProfileField` values).                                                                                                                                                                                                                                      |
| SR-I2 | **No raw SQL string interpolation.** All DB access via `supabase-js` parameterized queries. If any `rpc`/SQL function is used, it takes typed parameters — never concatenated user input.                                                                                                                                                                                                                                                                       |
| SR-I3 | **SQL injection**: mitigated by SR-I2; additionally, the matcher receives only Zod-validated, enum-constrained values, so free-form strings never reach a query builder unchecked.                                                                                                                                                                                                                                                                              |
| SR-I4 | **XSS**: scholarship `description`/`summary` are admin-authored but still untrusted output. Render as **plain text or sanitized Markdown**; **never** `dangerouslySetInnerHTML` with unsanitized content. React's default escaping is relied upon and never bypassed for user- or admin-supplied strings.                                                                                                                                                       |
| SR-I5 | **Outbound-link safety (A1/A3 — high priority):** `official_url` and `application_url` are validated against a **domain allowlist** (`*.gov.ph`, `*.edu.ph`, and an explicitly curated set of foundation domains). A URL outside the allowlist **cannot be published** — enforced in the admin Zod schema _and_ a DB CHECK/trigger. Links render with `rel="noopener noreferrer"` and display their destination domain so a student can see where "Apply" goes. |
| SR-I6 | **Open-redirect prevention:** the app never redirects to a URL taken from a query parameter or request body without allowlist validation.                                                                                                                                                                                                                                                                                                                       |
| SR-I7 | **Admin rule validation:** every `eligibility_rules.field` must be a member of the `ProfileField` enum (spec §4.4) — Zod-enforced so a rule can never reference a field the matcher can't read (also an integrity control).                                                                                                                                                                                                                                     |

---

## 7. Security Requirements — Secrets, Keys & Configuration

| ID    | Requirement                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-S1 | **Service-role key is server-only.** Used exclusively inside Server Actions / Edge Functions. It is never imported into a client component, never prefixed `NEXT_PUBLIC_`, never logged. |
| SR-S2 | **Only the anon key ships to the client** — which is safe _because_ RLS (SR-A3/A4) is correctly configured. RLS is what makes the public anon key harmless.                              |
| SR-S3 | **Secrets live in Vercel/Supabase environment variables**, never in the repo. `.env*` files are git-ignored; an `.env.example` documents names only.                                     |
| SR-S4 | **Build-time secret scan:** a check (e.g. gitleaks in CI, or a grep gate) fails the build if a privileged key pattern appears in a client-bundled file or in a commit.                   |
| SR-S5 | **Cron/Edge endpoints are authenticated** with a `CRON_SECRET` bearer (if invoked over HTTP). A random attacker cannot trigger the reminder/status jobs.                                 |
| SR-S6 | **Key rotation is documented** (see §12): steps to rotate Supabase keys, the Resend key, and the cron secret, and to revoke sessions, in one runbook.                                    |

---

## 8. Security Requirements — Data Integrity, Trust & the "Phishing-Link" Safety Case

This is where security and _student safety_ overlap. A wrong link or deadline in A1 can send a minor to a scam page or cause a missed scholarship. Treat published records as safety-critical.

| ID    | Requirement                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-D1 | **Publish guard (DB-enforced):** a record cannot be `is_published = true` without both `official_url` and `last_verified_at` set — a DB CHECK, not just app logic (already in spec §4.4; reaffirmed as a security control).                                                     |
| SR-D2 | **Domain allowlist on outbound links** (SR-I5) — enforced at the database layer so even a compromised admin session or a bad migration cannot publish a phishing "Apply" URL to `example-scam.tld`.                                                                             |
| SR-D3 | **Audit trail for privileged writes:** every publish, edit of a URL/deadline, and `mark_verified` records _who_ (`auth.uid()`), _what changed_, and _when_. An append-only `audit_log` table, written by the same server actions. This makes TA3/TA4 detectable and reversible. |
| SR-D4 | **Verified-then-published workflow:** editing a live record's URL or deadline re-stamps `last_verified_at` and shows the change in the audit log; large edits are reviewable.                                                                                                   |
| SR-D5 | **Deadline correctness** (a safety property): daily status recompute pinned to **Asia/Manila**; boundary-tested. A stale "Open" past close is treated as a defect, not cosmetics (spec §4.6).                                                                                   |
| SR-D6 | **Phase-2 suggestions never write live records** (see §10).                                                                                                                                                                                                                     |

---

## 9. Security Requirements — Availability, Backup & Data-Loss Prevention

Given TA6 (self-inflicted loss + free-tier quirks) is the most probable damage source, this section is deliberately concrete.

| ID    | Requirement                                                                                                                                                                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-B1 | **The dataset is reproducible from git.** Schema lives in versioned migrations; the full seed (10–20 curated scholarships + rules + requirements + cycles) lives as a committed seed script. A total DB loss is recoverable by re-running migrations + seed — the core asset does not live _only_ in a live database (satisfies SEC-G5). |
| SR-B2 | **Periodic exported snapshot:** a scheduled (or manual, documented) `pg_dump`/CSV export of the curated tables, stored outside Supabase (e.g. committed to a private repo or object storage). Guards against free-tier pausing/expiry and accidental deletes.                                                                            |
| SR-B3 | **Migrations are forward-only and reviewed before running against the live DB.** No ad-hoc destructive SQL in the production console; destructive changes go through a migration file that can be diffed and reverted.                                                                                                                   |
| SR-B4 | **Idempotent, guarded jobs:** the daily status/reminder job is safe to re-run (`sent_at` guard prevents double-send); a job crash mid-run cannot corrupt state or spam students.                                                                                                                                                         |
| SR-B5 | **Free-tier keep-alive awareness:** documented that the Supabase free project can pause on inactivity; the recovery path (SR-B1) means a pause is an inconvenience, not data loss.                                                                                                                                                       |
| SR-B6 | **Graceful degradation:** the public read path has **no external API dependency** (spec design), so an outage of Resend or the Phase-2 watcher never takes down discovery/matching.                                                                                                                                                      |

---

## 10. Security Requirements — Abuse Prevention & Edge Hardening

| ID    | Requirement                                                                                                                                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-R1 | **Rate limiting** on (a) the magic-link/auth endpoint and (b) the `matchProfile` action, to blunt brute force, email spam, and dataset scraping/DoS. On free tiers this can be a lightweight token-bucket (in-memory per-instance, or Upstash free) keyed by IP — imperfect but meaningful.         |
| SR-R2 | **Security headers** via Next.js config/middleware: a **Content-Security-Policy** (restrict script/style/connect to self + Supabase + Resend origins), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options`/`frame-ancestors 'none'`, and HSTS. |
| SR-R3 | **CSRF posture:** Server Actions are same-origin and session-bound; no state-changing GET endpoints; any custom mutating route validates origin.                                                                                                                                                    |
| SR-R4 | **Scraping tolerance:** since scholarship data is public and links to public sources, scraping is a low-severity concern; rate limiting (SR-R1) is sufficient — no aggressive blocking that would hurt real low-bandwidth users.                                                                    |
| SR-R5 | **Dependency hygiene:** Dependabot/`npm audit` in CI; pinned lockfile; review before major bumps. Supply-chain risk is a real vector for a Next.js app.                                                                                                                                             |
| SR-R6 | **Error handling never leaks internals:** user-facing errors are generic; stack traces, SQL errors, and env values are never returned to the client.                                                                                                                                                |

---

## 11. Phase-2 Agentic Ingestion — Security (deferred, but designed now)

The source-watcher LLM reads **hostile, attacker-controllable web content**. Its safety story is the human-in-the-loop gate.

| ID    | Requirement                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-P1 | **Suggestions only, never publish.** The watcher writes `ingestion_suggestions(status='pending')`; only an explicit admin approval writes a live record. No code path lets the LLM publish (already in spec §4.10).                         |
| SR-P2 | **Treat scraped text as untrusted data, not instructions.** The extraction prompt is structured so page content cannot redirect the model's task (prompt-injection resistance); extracted fields are schema-validated (Zod) before storage. |
| SR-P3 | **Allowlist + integrity on ingested URLs** (SR-I5/D2) applies doubly to LLM-proposed links — a suggestion proposing an off-allowlist "Apply" URL is flagged and cannot be approved without an override.                                     |
| SR-P4 | **Isolation:** the watcher runs off the critical read path with its own least-privilege context; a failure or malicious page cannot affect live discovery.                                                                                  |
| SR-P5 | **Admin diff review:** the approver sees the proposed diff against the current record before it goes live (TA3/TA5 defense).                                                                                                                |

---

## 12. MVP Security Scope (what actually ships)

**IN (MVP — non-negotiable):**

- Default-deny **RLS** on all user tables, verified by a two-user test (SR-A3, SEC-G2)
- **Server-side admin authorization** on every admin action (SR-A5)
- **Zod `.strict()` validation** on all server actions (SR-I1, SEC-G6)
- **Service-role key server-only** + build-time secret scan (SR-S1, SR-S4, SEC-G4)
- **Domain allowlist** on published links, DB-enforced (SR-I5, SR-D2, SEC-G3)
- **Publish guard** CHECK constraint (SR-D1)
- **Audit log** for privileged writes (SR-D3)
- **No persisted sensitive fields** — profile is session-only (PR1, SEC-G1)
- **Reproducible dataset** from migrations + seed, plus one exported snapshot (SR-B1/B2, SEC-G5)
- **Security headers + CSP** (SR-R2)
- **Basic rate limiting** on auth + match (SR-R1)
- **Privacy notice + account deletion path** (PR2, PR4)

**OUT / DEFERRED (with rationale):**

- Persisted `student_profiles` table — deferred to remove the minor-SPI storage problem (PR1)
- Phase-2 agentic ingestion and its controls (§11) — post-MVP
- Paid WAF, SIEM, PITR backups, penetration test — disproportionate for a portfolio MVP
- SMS/2FA — magic-link-only is acceptable for this data sensitivity at MVP

---

## 13. Security Test Checklist (extends spec §5)

| Area                     | Cases                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS isolation**        | User A cannot read/write user B's `saved_scholarships` or `reminders` (select/insert/update/delete). Anonymous cannot read any user-owned row. Default-deny confirmed by disabling every explicit policy and seeing access fail. |
| **Admin authz**          | A non-admin session calling an admin action is rejected server-side. A client-forged `role` value is ignored.                                                                                                                    |
| **IDOR**                 | Passing another user's `scholarship_id`/row id to a save/reminder/delete action cannot affect their data (id derived from session).                                                                                              |
| **Injection**            | Zod rejects unknown/extra fields and out-of-range values. No query executes on unvalidated input. XSS payload in a scholarship description renders inert (escaped), not executed.                                                |
| **Link allowlist**       | Attempting to publish `official_url`/`application_url` outside the allowlist is rejected at both app and DB layer.                                                                                                               |
| **Publish guard**        | Publishing without `official_url` or `last_verified_at` is rejected by the DB CHECK.                                                                                                                                             |
| **Secrets**              | Build/CI fails if a service-role/privileged key appears in a client bundle or commit. `NEXT_PUBLIC_` never contains a privileged key.                                                                                            |
| **Cron auth**            | Hitting the reminder/status endpoint without the `CRON_SECRET` is rejected.                                                                                                                                                      |
| **Rate limit**           | Rapid repeated auth requests / match calls from one source are throttled; legitimate single use is unaffected.                                                                                                                   |
| **Headers**              | Response carries CSP, nosniff, frame-ancestors, HSTS, referrer-policy (verify with a headers scan).                                                                                                                              |
| **Backup/recovery**      | From a clean environment, migrations + seed rebuild the full dataset; a restore drill completes under the SEC-G5 target.                                                                                                         |
| **Privacy**              | Account deletion cascades to saved + reminders; no sensitive field is found in any persisted row (schema review).                                                                                                                |
| **Phase 2 (when built)** | A prompt-injection string in a scraped page does not alter extraction behavior; a suggestion cannot become a live record without admin approval; off-allowlist proposed URL is blocked.                                          |

---

## 14. Incident Response Runbook (minimal, solo-dev)

A short, practiced runbook beats a long unread policy.

1. **Contain.** Rotate the affected secret immediately (service-role key, Resend key, or cron secret) in Supabase/Vercel; revoke active sessions if account compromise is suspected.
2. **Assess scope.** Use the `audit_log` (SR-D3) and Supabase logs to determine what was read/changed and whether any personal data (emails) was exposed.
3. **Restore integrity.** If A1 records were tampered, revert from the audit trail / last good snapshot (SR-B2).
4. **Notify (RA 10173).** If a breach involves sensitive personal information or is likely to cause real harm — especially to minors — Philippine law requires notifying the **National Privacy Commission and affected individuals within 72 hours** of knowledge of the breach. Keep a short breach record even for near-misses.
5. **Post-incident.** Write a one-paragraph post-mortem; add a regression test so the same class of issue fails the build next time.

_Key rotation steps and env-var names are kept in a private `SECURITY-RUNBOOK.md`, not in this public-facing spec._

---

## 15. Compliance Checklist — RA 10173 (Data Privacy Act)

- [ ] Privacy notice published, plain-language, minor-appropriate (PR2/PR3)
- [ ] Lawful basis identified (consent for reminders; legitimate use for anonymous matching that stores nothing)
- [ ] Data minimization enforced in schema — no persisted sensitive personal information (PR1, SEC-G1)
- [ ] Right to erasure implemented and tested (PR4)
- [ ] Retention limits defined for reminders/saved rows (PR5)
- [ ] Breach-notification process documented — NPC + affected users within 72h (§14)
- [ ] No third-party trackers on the profile/match flow (PR6)
- [ ] (Assess) whether processing scale triggers NPC registration / a Data Protection Officer obligation — revisit if the pilot grows beyond a small cohort

---

## 16. Security Risks & Mitigations (summary)

| Risk                                        | Actor   | Mitigation                                                           | Requirement         |
| ------------------------------------------- | ------- | -------------------------------------------------------------------- | ------------------- |
| RLS misconfig leaks student data            | TA2     | Default-deny + owner policies + two-user test                        | SR-A3, SEC-G2       |
| Service-role key leaks to client            | TA1     | Server-only usage + build-time scan                                  | SR-S1, SR-S4        |
| Phishing "Apply" link reaches a minor       | TA3/TA4 | Domain allowlist enforced in DB; visible destination; audit log      | SR-I5, SR-D2/D3     |
| Admin account takeover                      | TA4     | Server-side role check, audit log, session hygiene, key rotation     | SR-A5, SR-D3, SR-S6 |
| SQL/XSS injection                           | TA1     | Zod `.strict()`, parameterized queries, no `dangerouslySetInnerHTML` | SR-I1–I4            |
| IDOR across users                           | TA2     | `user_id` from session only                                          | SR-A6               |
| Data loss (fat-finger, free-tier pause)     | TA6     | Reproducible from git + external snapshot + forward-only migrations  | SR-B1–B3, SEC-G5    |
| Reminder double-send / job corruption       | TA6     | Idempotent guarded jobs                                              | SR-B4               |
| Auth spam / scraping / DoS                  | TA1     | Rate limiting + security headers                                     | SR-R1, SR-R2        |
| Prompt injection via scraped page (Phase 2) | TA5     | Untrusted-content prompt, schema-validated extraction, HITL approval | SR-P1–P5            |
| Persisting minors' sensitive info           | —       | Session-only sensitive fields; no persisted profile in MVP           | PR1, SEC-G1         |

---

## Appendix — Security Design Rationale

- **Minimize before you secure.** The strongest control here isn't a firewall — it's _not storing_ sensitive information about minors. Dropping the persisted profile removes an entire class of breach and compliance risk.
- **RLS is the authorization model, not app code.** Enforcing ownership at the database means a bug in a server action can't silently leak data; the row simply won't return.
- **Integrity is a safety feature.** For an audience of minors, a tampered "Apply" link is more dangerous than a data read. The domain allowlist + audit log treat link integrity as safety-critical, not cosmetic.
- **Recoverability over uptime.** On a solo free-tier build, the realistic disaster is self-inflicted data loss, so the dataset is designed to be rebuildable from version control — the DB is disposable, the git history is the source of truth.
- **The AI is fenced, not trusted.** Phase-2 extraction is treated as reading hostile input, with a human gate as the only path to publish — a clean, defensible agentic-AI safety story.
