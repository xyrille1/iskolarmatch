# IskolarMatch — Working Notes for Claude

Portfolio-grade scholarship-finder app for Filipino students. Full product/technical/security/UX specs live in `Context/` — read them before proposing architecture or feature changes:

- `Context/scholarship-finder-spec.md` — PRD, MVP plan, technical design (Next.js + Supabase + Tailwind)
- `Context/iskolar-security.md` — security & privacy requirements (RA 10173, RLS, secrets, link-integrity)
- `Context/iskolar-ux-design.md` — UI/UX design system
- `Context/iskolar-version-control.md` — git workflow, commit hygiene, and QA gates (see below)

## Version control & QA — standing instructions

Follow `Context/iskolar-version-control.md` for every git operation in this repo, not just when asked. In particular:

- Run the pre-commit checklist (§7 of that doc) before every commit: `git status` review of what's actually staged, scan for secrets/debug code, no `.env`/credential files, message explains *why*.
- Run the pre-push checklist before every push: clean commit sequence, correct branch/remote target, migrations reviewed as a diff if any are involved.
- Treat destructive or history-rewriting commands (`reset --hard`, `push --force`, `clean -f`, `rebase -i` on pushed commits, branch force-delete) as always requiring a fresh, explicit confirmation in the moment — prior approval of one such command is never standing approval for the next.
- If a secret ever ends up staged or committed, rotate it first (Supabase/Vercel/Resend), then deal with git history — never the other way around.
- No code exists yet at this repo stage (specs only). Once the app is scaffolded, add lint/typecheck/test/build to the pre-push gate and update the version-control doc to reflect it — don't let the doc go stale.

## Notes

- No CI is configured yet. Until it is, the QA checklist above is manual — run it yourself before committing/pushing rather than assuming a pipeline will catch issues.
- `main` is currently the only branch (solo dev). Feature branches are optional at this size but required for anything schema/migration-related (see the version-control doc §2).
