# IskolarMatch — Deployment

_Hosting topology, environment variables, cron scheduling, and release process for the current implementation._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Vercel + Supabase + Resend
**Status:** Reflects `vercel.json`, `.env.example`, `package.json`, and `supabase/config.toml` as committed

---

## 1. Hosting Topology

- **App:** Next.js 16, deployed on **Vercel** (frontend, Server Actions, and the cron Route Handlers all live in the same deployable — there is no separate backend service).
- **Data:** **Supabase** (managed Postgres + Auth). RLS is the access-control layer (`DATABASE.md` §5); the app never talks to Postgres directly, only through `@supabase/ssr` / `@supabase/supabase-js`.
- **Email:** **Resend**, used by the reminder-sending and weekly-digest cron handlers.
- **AI:** **Groq** (free tier), used only by the FR10 source-watcher cron for structured extraction — no other request path calls an LLM (`SECURITY.md` §3.10, `PRD.md` §2.4).
- **Scheduling:** **Vercel Cron** (not Supabase Edge Functions / `pg_cron`) triggers the four `app/api/cron/*` Route Handlers — see §3.

There is no separate staging environment defined in the repo today; Vercel preview deployments (per-PR) are the closest equivalent, but they'd need their own Supabase project or a shared dev project to be meaningful for DB-backed routes.

## 2. Environment Variables

From `.env.example` (source of truth — do not read `.env`/`.env.local` for this, they're gitignored):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, public (used by browser + server clients) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, public — safe to ship to the client; all access it grants is bounded by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS entirely — **server-only**, used in admin server actions and cron handlers, never in a client component |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for magic-link redirects; falls back to `http://localhost:3000` in dev |
| `CRON_SECRET` | Bearer token every cron Route Handler requires (`lib/security/verify-cron-secret.ts`) |
| `RESEND_API_KEY` | Resend API key for transactional reminder + digest emails |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PUBLIC_KEY` | Web Push (FR18) public key — the `NEXT_PUBLIC_` half is meant to reach the browser |
| `VAPID_PRIVATE_KEY` | Web Push private key — **server-only** (`lib/push/send-push-notification.ts`) |
| `VAPID_SUBJECT` | Web Push contact (`mailto:` or URL) sent to the push service |
| `GROQ_API_KEY` | Default provider key for the FR10 source-watcher extraction — **server-only** (`lib/groq/client.ts`); Groq's free tier suffices at MVP scale |
| `GROQ_EXTRACTION_MODEL` | Optional override for the Groq model (defaults to `openai/gpt-oss-120b`, `lib/source-watcher/config.ts`) — set this if the free-tier catalog changes |
| `LLM_BASE_URL` | Optional. Point the extraction client at any OpenAI-compatible endpoint instead of Groq. Unset ⇒ Groq (`https://api.groq.com/openai/v1`). Example (Gemini): `https://generativelanguage.googleapis.com/v1beta/openai` |
| `LLM_API_KEY` | Optional. Key for the `LLM_BASE_URL` provider — **server-only**; takes precedence over `GROQ_API_KEY` when set |
| `LLM_MODEL` | Optional. Model id for the alternate provider — takes precedence over `GROQ_EXTRACTION_MODEL` (e.g. Gemini: `gemini-flash-latest`) |

The extraction client (`lib/groq/client.ts`) speaks the OpenAI-compatible chat-completions protocol over a plain `fetch`, so any conforming provider works by setting the three `LLM_*` vars; leave them unset to stay on Groq. All three keys are **server-only** and never reach the browser.

This list is exhaustive — a repo-wide grep for `process.env.` turns up no other application secrets. If you add a new integration, add its variable here and to `.env.example` in the same change.

## 3. Cron Jobs

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-deadlines", "schedule": "0 16 * * *" },
    { "path": "/api/cron/send-reminders", "schedule": "15 16 * * *" },
    { "path": "/api/cron/send-digest", "schedule": "30 16 * * 1" },
    { "path": "/api/cron/watch-sources", "schedule": "45 16 * * 1" },
    { "path": "/api/cron/discover-sources", "schedule": "0 17 * * 1" }
  ]
}
```

All times are UTC and correspond to ~00:00 / 00:15 / 00:30 / 00:45 / 01:00 **Asia/Manila** (UTC+8) — the daily jobs match the app's `getManilaTodayIso()` deadline-correctness pinning (`ARCHITECTURE.md` §6); the three Monday jobs (`send-digest`, `watch-sources`, `discover-sources`) run weekly. Vercel calls these paths with a header Vercel itself controls; the handlers additionally require the `CRON_SECRET` bearer token, so the secret — not "is this Vercel" — is the actual authorization check. If you move off Vercel, you must replace the trigger mechanism (e.g. Supabase scheduled Edge Function or `pg_cron`) but the handlers and secret check stay the same.

**`watch-sources` (FR10 source-watcher)** is Node-runtime (`export const runtime = "nodejs"`, needs jsdom / pdf-parse / `node:dns`) with `maxDuration = 60`. It processes published scholarships in a stale-first batch (`WATCH_BATCH_SIZE`, `lib/source-watcher/config.ts`) so a single run stays within the function budget as the catalogue grows. Groq's free tier has per-minute rate limits; the deterministic change-gate means the LLM is only called for scholarships whose source page actually changed, so real call volume is far below one-per-scholarship-per-week.

**`discover-sources` (FR22 discovery crawler)** is likewise Node-runtime, `maxDuration = 60`. It processes registered index pages in a stale-first batch (`DISCOVER_INDEX_BATCH_SIZE`) with a hard per-run ceiling on new detail-page fetches (`DISCOVER_MAX_DETAIL_PAGES_PER_RUN`) and a per-domain crawl delay (`lib/source-discovery/config.ts`), so one run stays within the budget and stays polite. It honors `robots.txt` and sends a self-identifying User-Agent (see `SECURITY.md` §3.11).

**Pre-deploy check (cron count):** this brings the total to **five** crons. Vercel's Hobby plan has historically capped cron count/invocations — confirm the target plan's ceilings before relying on all five. If the plan is too limited, the discovery handler is portable: trigger it from a **GitHub Actions scheduled workflow** (`.github/workflows/`) that `curl`s the route with the `CRON_SECRET` bearer, instead of a `vercel.json` entry. Not a code blocker either way — the handler is correct regardless — but a scheduled job that never fires (or times out) fails silently.

## 4. Build, Test & Release (`package.json` scripts)

```
npm run dev        # next dev
npm run build       # next build
npm run start       # next start
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run test:watch  # vitest
npm run test:e2e    # playwright test
npm run db:reset    # supabase db reset (local)
```

**No CI is configured** — there is no `.github/workflows/` directory. Per `docs/iskolar-version-control.md`, `lint`/`typecheck`/`test`/`build` must be run manually before every push; a pipeline enforcing this does not exist yet. `.github/dependabot.yml` runs weekly `npm` and `github-actions` dependency-update checks (the latter has nothing to update today since there are no workflows, but the config exists for when CI is added).

Release flow today is a manual `git push` to the branch Vercel is watching, with Vercel building and deploying automatically. There's no separate approval/staging gate.

## 5. Database Migrations

Migrations live in `supabase/migrations/`, applied in filename order (`20260101000001_...` → `20260101000012_...`, the latest being the FR10 source-watcher tables, which include their own `grant ... to service_role` inline). `npm run db:reset` runs `supabase db reset` against a local Supabase instance (`supabase/config.toml`, Postgres 17) for local development. Per `SECURITY.md` SEC-G5 and `docs/iskolar-version-control.md`, migrations are **forward-only** — a mistake gets a new migration, not an edited/rebased one, so the schema stays reconstructable from git history alone. Adding a table or policy without a migration file (e.g. via the Supabase dashboard) breaks that guarantee and must be avoided.

`20260101000006_grant_table_privileges.sql` grants the base table privileges (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) that `anon`/`authenticated`/`service_role` need on every app table. **This is not optional and not implied by RLS policies** — in Postgres, a `create policy ... to anon` only gates access a role already has via `GRANT`; without the matching grant, every query gets `permission denied for table X` regardless of what the policy says. This was actually broken end-to-end (matching, saved list, admin CRUD, cron — every DB read/write) until this migration was added; verify with `tests/integration/rls.test.ts` (see §7) after any new table/role combination, since it's the one thing in this stack a passing `npm run build` will never catch.

## 6. Auth Email Templates & Redirect URLs (hosted-project setup, not code)

`app/auth/confirm/route.ts` expects Supabase's magic-link email to link to `{{ .SiteURL }}/auth/confirm?...&token_hash={{ .TokenHash }}&type=magiclink` — but neither piece of that is Supabase's out-of-the-box default, and **both are per-project Dashboard/config settings that migrations can't carry to the hosted project**:

1. **Email template.** Supabase's default "Magic Link" template uses `{{ .ConfirmationURL }}`, which points at the Auth server's own `/auth/v1/verify` endpoint (on the Supabase-managed host, not the app's domain) and never reaches `/auth/confirm` at all — the route handler is dead code against the default template. Local dev fixes this via `supabase/config.toml`'s `[auth.email.template.magic_link]` + `supabase/templates/magic_link.html` (a `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink` link). **The hosted project needs the equivalent template pasted into Dashboard → Authentication → Email Templates → Magic Link** before magic-link sign-in works in production.
2. **Redirect URL allow-list.** Supabase Auth validates `emailRedirectTo` (the URL `lib/actions/auth.ts` builds, `${NEXT_PUBLIC_SITE_URL}/auth/confirm?next=...`) against `site_url` + `additional_redirect_urls`. A non-matching URL doesn't error — it **silently falls back to the bare site URL**, dropping `token_hash`/`type`/`next` and leaving the visitor "signed in" at the homepage with no path back to what they were doing. Local dev's allow-list is `supabase/config.toml`'s `additional_redirect_urls`. **The hosted project needs the production origin with a wildcard subpath (e.g. `https://<domain>/**`) added under Dashboard → Authentication → URL Configuration → Redirect URLs.**

Both are easy to miss because the failure mode is silent (no error, no 500 — just a link that quietly goes to the wrong place), and neither shows up in `npm run build`/`test`/typecheck. Confirm both are set, then smoke-test one real magic-link sign-in against the deployed URL before calling auth done.

## 7. Known Gaps

- **No CI/CD pipeline.** QA is a manual pre-push checklist (`docs/iskolar-version-control.md` §7), not an enforced gate — a bad push can reach `main`/production if the checklist is skipped.
- **No separate staging environment** with its own Supabase project — preview deployments exist but DB-backed routes in them would hit whatever Supabase project is configured, which needs care.
- **Cron is Vercel-specific.** Migrating hosting providers requires re-implementing the trigger mechanism for `refresh-deadlines`/`send-reminders`/`send-digest`/`watch-sources`/`discover-sources` (the handlers themselves are portable).
- **Vercel cron/plan limits not yet confirmed for five crons.** The FR22 `discover-sources` job brings the total to five; verify the deployment plan's cron-count and function-duration limits before relying on it (see §3). If the plan is too limited, trigger `discover-sources` (and/or `watch-sources`) from a GitHub Actions scheduled workflow instead — same `CRON_SECRET` bearer. Not a code blocker — the handlers are correct regardless — but a scheduled job that never fires (or times out) fails silently.
