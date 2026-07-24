# IskolarMatch

A scholarship-finder for Filipino students. Answer a short profile and IskolarMatch
matches you against a curated, deadline-aware catalog of scholarships — then lets you
save the ones you want, track each application, and get reminded before a deadline
closes. Every listing is grounded in an official source, and an LLM-assisted watcher
keeps the catalog fresh so links don't quietly rot.

Built as a portfolio-grade product: real auth, row-level security, an admin
human-approval gate for every published listing, and CI enforcing the quality bar.

## Stack

- **Next.js 16** (App Router, Server Actions, Route Handlers, Turbopack) + **React 19**
- **Supabase** — Postgres, Auth (magic link), and Row-Level Security as the primary
  authorization control
- **Tailwind CSS v4** (CSS-first `@theme` tokens — an editorial design system)
- **Zod v4** for input + row-shape validation
- **Vitest 4** (unit/integration) + **Playwright** (e2e)
- **Resend** (reminder email) + **Web Push / VAPID** (deadline notifications)
- An OpenAI-compatible LLM (Groq free-tier by default) powering the source-watcher
  and source-discovery pipelines

## Local setup

Prerequisites: Node 22, npm, and the [Supabase CLI](https://supabase.com/docs/guides/cli)
with Docker (for the local Postgres stack).

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment
cp .env.example .env.local
# Fill in the Supabase URL/keys (from `npx supabase status` for a local stack,
# or your project settings for a hosted one). CRON_SECRET, Resend, VAPID, and
# the LLM keys are only needed for the features that use them — see the inline
# comments in .env.example.

# 3. Bring up the local database + apply migrations
npx supabase start
npm run db:reset

# 4. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality gates

Four gates run locally and in CI (`.github/workflows/ci.yml`) on every push and PR.
Run them before you commit:

```bash
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest (unit + integration)
npm run build        # next build
```

Additional checks:

```bash
npm run test:coverage   # vitest with coverage thresholds
npm run test:e2e        # Playwright smoke suite
```

CI also runs a **gitleaks** secret scan and an **RLS integration** job that boots a
local Supabase, applies migrations, and asserts every row-level policy allows and
denies the right rows. See `docs/iskolar-version-control.md` for the commit/push
checklist CI enforces.

## Documentation

Full product, technical, security, and design specs live in [`docs/`](docs/):

- [`PRD.md`](docs/PRD.md) — product requirements & MVP plan
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical design
- [`DATABASE.md`](docs/DATABASE.md) — data models & schema
- [`SECURITY.md`](docs/SECURITY.md) — security & privacy (RA 10173, RLS, secrets)
- [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) — hosting & deployment
- [`iskolar-ux-design.md`](docs/iskolar-ux-design.md) — UI/UX design system
- [`iskolar-version-control.md`](docs/iskolar-version-control.md) — git workflow & QA gates
