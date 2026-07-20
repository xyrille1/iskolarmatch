# IskolarMatch — Deployment

_Hosting topology, environment variables, cron scheduling, and release process for the current implementation._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Vercel + Supabase + Resend
**Status:** Reflects `vercel.json`, `.env.example`, `package.json`, and `supabase/config.toml` as committed

---

## 1. Hosting Topology

- **App:** Next.js 16, deployed on **Vercel** (frontend, Server Actions, and the two cron Route Handlers all live in the same deployable — there is no separate backend service).
- **Data:** **Supabase** (managed Postgres + Auth). RLS is the access-control layer (`DATABASE.md` §5); the app never talks to Postgres directly, only through `@supabase/ssr` / `@supabase/supabase-js`.
- **Email:** **Resend**, used only by the reminder-sending cron handler.
- **Scheduling:** **Vercel Cron** (not Supabase Edge Functions / `pg_cron`) triggers the two `app/api/cron/*` Route Handlers — see §3.

There is no separate staging environment defined in the repo today; Vercel preview deployments (per-PR) are the closest equivalent, but they'd need their own Supabase project or a shared dev project to be meaningful for DB-backed routes.

## 2. Environment Variables

From `.env.example` (source of truth — do not read `.env`/`.env.local` for this, they're gitignored):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, public (used by browser + server clients) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, public — safe to ship to the client; all access it grants is bounded by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS entirely — **server-only**, used in admin server actions and cron handlers, never in a client component |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for magic-link redirects; falls back to `http://localhost:3000` in dev |
| `CRON_SECRET` | Bearer token the two cron Route Handlers require (`lib/security/verify-cron-secret.ts`) |
| `RESEND_API_KEY` | Resend API key for transactional reminder emails |

This list is exhaustive — a repo-wide grep for `process.env.` turns up no other application secrets (no analytics keys, no other third-party APIs). If you add a new integration, add its variable here and to `.env.example` in the same change.

## 3. Cron Jobs

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-deadlines", "schedule": "0 16 * * *" },
    { "path": "/api/cron/send-reminders", "schedule": "15 16 * * *" }
  ]
}
```

Both times are UTC and correspond to ~00:00 / 00:15 **Asia/Manila** (UTC+8) — matching the app's `getManilaTodayIso()` deadline-correctness pinning (`ARCHITECTURE.md` §6). Vercel calls these paths with a header Vercel itself controls; the handlers additionally require the `CRON_SECRET` bearer token, so the secret — not "is this Vercel" — is the actual authorization check. If you move off Vercel, you must replace the trigger mechanism (e.g. Supabase scheduled Edge Function or `pg_cron`) but the handlers and secret check stay the same.

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

Migrations live in `supabase/migrations/`, applied in filename order (`20260101000001_...` → `20260101000005_...`). `npm run db:reset` runs `supabase db reset` against a local Supabase instance (`supabase/config.toml`, Postgres 17) for local development. Per `SECURITY.md` SEC-G5 and `docs/iskolar-version-control.md`, migrations are **forward-only** — a mistake gets a new migration, not an edited/rebased one, so the schema stays reconstructable from git history alone. Adding a table or policy without a migration file (e.g. via the Supabase dashboard) breaks that guarantee and must be avoided.

## 6. Known Gaps

- **No CI/CD pipeline.** QA is a manual pre-push checklist (`docs/iskolar-version-control.md` §7), not an enforced gate — a bad push can reach `main`/production if the checklist is skipped.
- **No separate staging environment** with its own Supabase project — preview deployments exist but DB-backed routes in them would hit whatever Supabase project is configured, which needs care.
- **Cron is Vercel-specific.** Migrating hosting providers requires re-implementing the trigger mechanism for `refresh-deadlines`/`send-reminders` (the handlers themselves are portable).
