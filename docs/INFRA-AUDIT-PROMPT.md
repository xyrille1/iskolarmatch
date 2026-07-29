# IskolarMatch — 13-Layer Infrastructure Audit Prompt

_A reusable audit prompt covering frontend through availability/recovery, tailored to this repo's
actual stack (Next.js 16 + Supabase + Vercel + Resend/Groq) rather than generic cloud checklists._

**Companion to:** `ARCHITECTURE.md`, `DEPLOYMENT.md`, `SECURITY.md`, `DATABASE.md`,
`iskolar-version-control.md`, `QA-CHECKLIST.md`
**Owner:** Xyrille
**Status:** A prompt template, not a report — run it (paste into Claude Code or a subagent) to
generate a fresh audit; don't let this file itself go stale by editing it as if it were findings.
Re-run after any structural change to auth, RLS, cron, or CI.

---

## How to use this

Paste the block below as-is into an agent (this repo's Claude Code session, `/code-review`, or a
fresh subagent with repo access). It expects read access to the repo. It does **not** require the
app to be running or deployed — layers marked `UNKNOWN` in its output are the ones that need a
live check (Vercel/Supabase dashboards, a real magic-link smoke test, etc.) rather than more
repo-reading.

Known finding already surfaced once (2026-07-29): `CLAUDE.md` claims CI is live
(`.github/workflows/ci.yml`), while `DEPLOYMENT.md` §7 and `SECURITY.md` §4 still say "No CI is
configured." Layer 7 below is written to catch exactly this kind of doc/reality drift — re-check
it on every run rather than assuming it's been fixed just because it was noticed once.

---

## The prompt

```
ROLE: You are auditing IskolarMatch (Next.js 16 App Router + TypeScript + Supabase/Postgres +
Tailwind, hosted on Vercel, email via Resend, LLM via Groq/OpenAI-compatible) for production
readiness across 13 infrastructure layers. This is a solo-dev, free-tier, portfolio-grade app
serving Filipino students (audience includes minors — RA 10173 applies).

GROUND TRUTH — read these before judging anything, and treat live code/config as authoritative
over prose docs when they conflict:
  docs/ARCHITECTURE.md, docs/DATABASE.md, docs/DEPLOYMENT.md, docs/SECURITY.md,
  docs/iskolar-version-control.md, docs/QA-CHECKLIST.md, .env.example, vercel.json,
  supabase/migrations/, .github/workflows/ (if present), lib/, app/

CROSS-CUTTING RULE: If a doc claims something ("No CI configured", "RLS enabled on table X")
that current files contradict, report it as a DRIFT finding, not a pass or a silent correction.
Docs are supposed to reflect "the app as built" (their own stated policy) — a mismatch is itself
a bug.

For EACH layer below: inspect the named files, compare against the pass criteria, and classify
as OK / GAP / DRIFT / UNKNOWN (can't verify from repo alone — say what external check is needed,
e.g. "confirm in Vercel dashboard"). Cite the specific file/line or doc section as evidence.
Do not restate what the docs already say as if it were your own finding — verify it.

1. FRONTEND FOUNDATIONS
   Check: rendering strategy per route (static/ISR/force-dynamic) matches its actual data
   dependency (ARCHITECTURE.md §3); progressive enhancement (/scholarships uses <form method=get>,
   no-JS baseline); Zod client validation mirrors server schema; accessibility basics (labels,
   focus states, color contrast) in components/. Flag any route marked force-dynamic without a
   documented reason, or any client component holding a secret env var.

2. APIS AND BACKEND LOGIC
   Check: every entry in lib/actions/* (ARCHITECTURE.md §4) — auth requirement matches what it
   should be (public/session/admin), every input Zod .strict()-validated, no server action trusts
   a caller-supplied user_id where session should be the source. Check app/api/cron/* handlers
   for idempotency and CRON_SECRET enforcement (timingSafeEqual, not ==).

3. DATABASE AND STORAGE
   Check: every table in DATABASE.md §5 has RLS enabled; confirm the GRANT migration
   (20260101000006) exists and covers every table+role combo — DEPLOYMENT.md §5 flags this as
   "the one thing npm run build will never catch," so verify it by reading the migration, not by
   assuming. Confirm migrations are forward-only (no edited/rebased files in git history) and
   supabase db reset actually reconstructs schema from git alone (SEC-G5).

4. AUTH AND PERMISSIONS
   Check: requireAdmin() is called on literally every admin page/action (grep app/admin, lib/
   actions/admin.ts) — ARCHITECTURE.md §10 already admits this is per-call, not centralized; treat
   that as an open GAP unless a new admin file is found missing the call, in which case it's
   CRITICAL. Confirm proxy.ts only refreshes session and does not accidentally start gating (or
   silently fail to refresh). Confirm RLS — not requireAdmin() — is the actual enforced boundary
   (SECURITY.md §3.4).

5. HOSTING AND DEPLOYMENT
   Check: .env.example vs a repo-wide grep for process.env. — must be 1:1, no undocumented var.
   Confirm no staging environment gap is still true. CRITICAL, easy-to-miss item (DEPLOYMENT.md
   §6): Supabase magic-link email template and redirect-URL allowlist are hosted-project Dashboard
   settings that no migration carries — their failure mode is silent (visitor bounced to homepage,
   no error). Flag as UNKNOWN requiring a live smoke test of magic-link sign-in against the
   deployed URL; do not mark OK from code alone.

6. CLOUD AND COMPUTE
   Check: cron route runtimes — watch-sources/discover-sources need Node runtime (jsdom, pdf-parse,
   node:dns) with maxDuration=60; confirm export const runtime="nodejs" is actually set where
   required. Confirm Vercel plan's cron-count/duration ceilings have been checked against the
   current 5 crons (vercel.json) — DEPLOYMENT.md §3/§7 flag this as unconfirmed; if still
   unconfirmed, that's a live GAP, not a resolved item.

7. CI/CD AND VERSION CONTROL
   Check: does .github/workflows/ci.yml exist and actually run lint+typecheck+test+build+gitleaks+
   RLS-integration+Playwright, as CLAUDE.md claims? Compare that against DEPLOYMENT.md §7 and
   SECURITY.md §4, which both assert "No CI is configured." Report the discrepancy explicitly as
   DRIFT and state which side matches the actual .github/ contents. Confirm
   docs/iskolar-version-control.md's pre-commit/pre-push checklists are still accurate to what CI
   enforces vs. what's still manual-only.

8. SECURITY AND ROW-LEVEL SECURITY
   Check against SECURITY.md §1 SEC-G1–G6 status table — re-verify each "Met" claim rather than
   trusting it: no student_profiles table exists (SEC-G1), every user-owned table is auth.uid()-
   scoped (SEC-G2), the three-layer URL allowlist (Zod + Postgres trigger + isAllowlistedUrl) still
   agrees across all three implementations (documented single-source-of-truth gap, §4), no
   privileged secret reachable from a "use client" file (SEC-G4), Zod .strict() on every input
   (SEC-G6). Confirm CSP's unsafe-inline is still the accepted, documented trade-off and not a new
   unrelated regression.

9. RATE LIMITING
   Check lib/security/rate-limit.ts: confirm it's applied to every anon-facing write —
   submitProfileForm (20/60s), requestMagicLink (5/60s), submitScholarshipReport (5/60s) — and to
   any new anon-facing action added since. Flag the known in-memory/per-instance/cold-start-reset
   limitation (SECURITY.md §4) as a live GAP if traffic/scale assumptions have changed, otherwise
   note it as an accepted, documented trade-off — don't re-flag it as new.

10. CACHING AND CDN
    Check ISR/static choices: /trust (1h ISR), /, /about, /privacy (static) — confirm these still
    match actual traffic/freshness needs (ARCHITECTURE.md §3). Confirm no force-dynamic route was
    added that should be static/ISR instead (unnecessary compute + latency). Check Next.js image
    handling and Vercel's default edge caching are actually being used where applicable, not
    bypassed.

11. LOAD BALANCING AND SCALING
    This stack has no traditional LB — Vercel's serverless model auto-scales. Correct check here
    is: does anything assume single-instance state that breaks under horizontal scale? The rate
    limiter (#9) is the known instance of this. Also check Supabase connection handling (pooled
    client vs. direct) won't exhaust connections if invocation concurrency spikes, and that cron
    batch sizes (WATCH_BATCH_SIZE, DISCOVER_INDEX_BATCH_SIZE) still bound each run within the
    function time budget as the catalogue grows (DEPLOYMENT.md §3).

12. ERROR TRACKING AND LOGS
    No error-tracking service (Sentry or equivalent) appears anywhere in the docs — treat this as
    a GAP to confirm, not assume: grep for any APM/error-tracking SDK in package.json. Distinguish
    this from audit_log (DATABASE.md/SECURITY.md §3.7), which is an application-level admin-action
    audit trail, NOT error/exception monitoring — don't let one satisfy the other. Check whether
    cron-handler failures (refresh-deadlines, send-reminders, send-digest, watch-sources,
    discover-sources) are visible anywhere beyond Vercel's own cron-invocation dashboard — a
    silently-failing cron currently has no alerting path (DEPLOYMENT.md §3/§7 already flags "fails
    silently" for a misconfigured cron trigger).

13. AVAILABILITY AND RECOVERY
    Check SEC-G5 recoverability claim (<30 min rebuild from migrations+seed) is still true given
    the current migration count. Check Supabase free-tier auto-pause-on-inactivity risk (asset A5,
    SECURITY.md §2) has a mitigation (keep-alive ping, or accepted risk documented somewhere) —
    if not documented, that's a GAP. Check SECURITY.md §6 incident-response steps (secret rotation
    order, RLS-bypass investigation via audit_log) are still procedurally accurate. Confirm no
    backup/restore drill has ever actually been run (vs. just asserted as possible) — if never
    run, mark UNKNOWN, not OK.

OUTPUT FORMAT: one table, one row per layer —
| # | Layer | Status | Evidence (file:line / doc §) | Action needed |
Then a short "Top 3 by risk" list at the end, ranked by (a) silent-failure-mode gaps over loud
ones, (b) student-facing/security-impacting over cosmetic, (c) already-flagged-but-unresolved
docs gaps over newly-discovered ones. Do not pad passing layers with restated doc content — a
single "OK, matches DEPLOYMENT.md §X, verified against vercel.json" line is enough.
```
