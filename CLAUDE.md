# IskolarMatch — Working Notes for Claude

Portfolio-grade scholarship-finder app for Filipino students. Full product/technical/security/UX specs live in `docs/` — read them before proposing architecture or feature changes:

- `docs/PRD.md` — PRD & MVP plan
- `docs/ARCHITECTURE.md` — technical design (Next.js + Supabase + Tailwind)
- `docs/DATABASE.md` — data models / schema
- `docs/DEPLOYMENT.md` — hosting & deployment
- `docs/SECURITY.md` — security & privacy requirements (RA 10173, RLS, secrets, link-integrity)
- `docs/iskolar-ux-design.md` — UI/UX design system
- `docs/iskolar-version-control.md` — git workflow, commit hygiene, and QA gates (see below)

## Version control & QA — standing instructions

Follow `docs/iskolar-version-control.md` for every git operation in this repo, not just when asked. In particular:

- Run the pre-commit checklist (§7 of that doc) before every commit: `git status` review of what's actually staged, scan for secrets/debug code, no `.env`/credential files, message explains *why*.
- Run the pre-push checklist before every push: clean commit sequence, correct branch/remote target, migrations reviewed as a diff if any are involved.
- Treat destructive or history-rewriting commands (`reset --hard`, `push --force`, `clean -f`, `rebase -i` on pushed commits, branch force-delete) as always requiring a fresh, explicit confirmation in the moment — prior approval of one such command is never standing approval for the next.
- If a secret ever ends up staged or committed, rotate it first (Supabase/Vercel/Resend), then deal with git history — never the other way around.
- The app is scaffolded and CI is live: `.github/workflows/ci.yml` runs lint/typecheck/test/build + a gitleaks secret scan + an RLS integration job (booted local Supabase) + a Playwright e2e smoke on every push/PR. Keep it and the version-control doc in sync as the gate evolves — don't let either go stale.

## Notes

- CI enforces the four gates automatically now, but still run the QA checklist locally before committing/pushing — CI is the backstop, not an excuse to push red.
- `main` is currently the only branch (solo dev). Feature branches are optional at this size but required for anything schema/migration-related (see the version-control doc §2).
