# IskolarMatch — Safe Version Control & Repository QA

_A practical, error-avoidant git workflow for a solo-dev, portfolio-grade repository. Covers branching, commit hygiene, secrets safety, destructive-command discipline, pre-commit/pre-push QA gates, and recovery procedures._

**Companion to:** `scholarship-finder-spec.md`, `iskolar-security.md`, `iskolar-ux-design.md`
**Owner:** Xyrille · **Repo:** github.com/xyrille1/iskolarmatch
**Status:** Draft v1 for build

---

## 0. Scope & Assumptions

- `[ASSUMPTION]` **Solo dev today, possible collaborators later.** Rules are written to be safe for one person working directly on `main`, but forward-compatible with a PR-review workflow once others join (§10).
- `[ASSUMPTION]` **No CI/CD configured yet.** The checklist in §7 is manual until lint/test/build scripts and a CI pipeline exist (post P0/P1 of the MVP plan). Update this doc when CI lands — don't let it go stale.
- `[ASSUMPTION]` **`main` is the only long-lived branch today.** Feature branches are optional at this repo size but recommended once concurrent work streams appear (e.g., admin tool + reminders in parallel).
- `[ASSUMPTION]` Secrets (Supabase service-role key, Resend key, cron secret) will exist once the app is scaffolded. This doc's secrets guidance (§5) is written pre-emptively so the first `.env` never touches git history.

---

## 1. Why This Matters Here

Two things make version-control discipline higher-stakes than usual for this project, even though it's "just a portfolio app":

1. **Security doc alignment.** `iskolar-security.md` (SR-S3, SR-S4, SR-B1–B3) already commits to secrets never entering the repo and migrations being forward-only and reviewed. Git hygiene is how those requirements actually get enforced day to day — a security spec is only as good as the git habits behind it.
2. **The dataset is the product.** Per the security doc's SEC-G5, the curated scholarship dataset must be fully reproducible from git. That only holds if commits are clean, migrations aren't rewritten after the fact, and nothing destructive happens to history without a documented reason.

---

## 2. Branching Strategy

| Situation                                                    | Approach                                                                                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo, low-risk change (docs, config, small fix)              | Commit directly to `main`. No ceremony needed at this repo size.                                                                                                  |
| Solo, multi-step feature (e.g., matching engine, admin CRUD) | Short-lived feature branch (`feat/matching-engine`, `fix/deadline-status-tz`), merged to `main` when working end-to-end. Keeps `main` always in a demoable state. |
| Anything touching schema/migrations                          | Always a branch, even solo — makes the diff reviewable before it hits a real database (SR-B3).                                                                    |
| Once a second contributor joins                              | All work goes through branches + PRs (§10); direct pushes to `main` stop.                                                                                         |

**Naming convention:** `type/short-description` — `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`. Matches the commit-type vocabulary in §3.

**Branch lifetime:** delete feature branches after merge (locally and on remote). A long-lived, forgotten branch is a common source of "which version is real" confusion.

---

## 3. Commit Hygiene

- **Atomic commits.** One logical change per commit. A commit that mixes a schema change with an unrelated UI tweak is hard to revert cleanly if one half breaks.
- **Message format** (Conventional Commits, lightweight):

  ```
  <type>: <imperative summary, under 70 chars>

  <optional body: why, not what — the diff already shows what>
  ```

  Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `security`.

- **Write the "why," not the "what."** Code and diffs show what changed; the message should carry the reasoning a diff can't (e.g., "fix: pin deadline recompute to Asia/Manila — UTC was flipping status a day early").
- **Never commit half-finished, broken states to `main`.** A feature branch can have messy WIP commits; squash or clean up before merging so `main`'s history stays legible (SR-B3's spirit: reviewable, revertible history).
- **No `--amend` on anything already pushed**, unless explicitly agreed — amending shared history rewrites commit hashes and breaks anyone else's checkout.

---

## 4. What Never Gets Committed

Enforced by `.gitignore` **and** the pre-commit check in §7 — belt and suspenders, because a `.gitignore` only protects files that were never staged in the first place.

| Category                | Examples                                                                    | Where it lives instead                                                     |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Secrets / credentials   | `.env`, `.env.local`, service-role key, Resend API key, `CRON_SECRET`       | Vercel/Supabase environment variables (SR-S3)                              |
| Dependency artifacts    | `node_modules/`, `.next/`, `dist/`, `build/`                                | Reinstalled/rebuilt from `package.json` + lockfile                         |
| Local tooling state     | `.vscode/` (unless team-shared settings), `*.log`, `.DS_Store`, `Thumbs.db` | Local machine only                                                         |
| Generated/derived files | Supabase generated types (if regenerated by a script), coverage reports     | Regenerated on demand, or explicitly decided to commit if genuinely useful |
| Personal exports        | Local DB dumps, personal test data                                          | Scratch space outside the repo                                             |

**Minimum `.gitignore` once the app is scaffolded** (Next.js + Supabase + Vercel):

```
node_modules/
.next/
.env
.env.local
.env*.local
.vercel
*.log
.DS_Store
Thumbs.db
supabase/.temp/
```

**`.env.example`** is the one env-shaped file that _should_ be committed — names only, no values (already required by SR-S3).

---

## 5. Secrets Safety — Prevention & Recovery

**Prevention:**

- Before every commit that touches config, ask: _does this file contain a real key, token, or credential?_ Grep for `SUPABASE_SERVICE_ROLE`, `RESEND_API_KEY`, `CRON_SECRET`, or any `sk_`/`re_`-style token pattern before staging.
- Once the project has a `package.json`, add a lightweight secret scan (e.g., `gitleaks` as a pre-commit hook or CI step, per SR-S4) rather than relying on memory alone.
- Never paste real keys into commit messages, PR descriptions, or comments "temporarily."

**If a secret is committed anyway:**

1. **Rotate first, clean up second.** Rotating the key in Supabase/Vercel/Resend instantly invalidates the leaked value — this matters more than any git surgery, because the secret may already be scraped from GitHub's history/cache.
2. Remove the file from the _current_ tree and commit that removal.
3. If the secret must be scrubbed from history (e.g., before a public release), use `git filter-repo` (preferred over the deprecated `filter-branch`) — **coordinate with the user first**; this rewrites history and requires a force-push, which is a destructive, shared-impact operation (§6).
4. Log the incident per `iskolar-security.md` §14 (Incident Response Runbook) — a leaked key is a security incident, not just a git mistake.

---

## 6. Safe vs. Destructive Commands

The core discipline: **read-only and additive commands are always fine to run freely; anything that can discard work, rewrite history, or affect the remote requires a `git status` check first and explicit confirmation before running.**

| Always safe (no confirmation needed)                           | Requires `git status` first + explicit go-ahead                                  | Never without direct, scoped user request         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `git status`, `git diff`, `git log`, `git show`                | `git checkout <branch>` (uncommitted changes can be silently carried or blocked) | `git push --force` to `main`                      |
| `git branch` (list), `git fetch`                               | `git stash` / `git stash pop`                                                    | `git reset --hard`                                |
| `git add` (staging, reversible via `git restore --staged`)     | `git merge`, `git rebase` (non-interactive, own branch)                          | `git clean -fd`                                   |
| `git commit` (new commit, reversible via `git revert`/`reset`) | `git branch -D` (force-delete)                                                   | `git rebase -i` on pushed commits                 |
| `git push` (normal, fast-forward, own branch)                  | `git checkout -- <file>` / `git restore <file>` (discards local edits)           | `filter-branch` / `filter-repo` on shared history |
| `git tag`, `git remote -v`                                     | `git pull` when local has uncommitted changes (can trigger a merge/conflict)     | Force-push to any branch others may have pulled   |

**Rule of thumb:** if a command's failure mode is "I lose uncommitted work" or "I rewrite history someone else has," treat it as destructive regardless of which column a similar-looking command sits in. `git checkout <file>` looks harmless but silently discards edits — always `git status` immediately before it.

**Force-push specifically:** never force-push to `main` under any circumstance without the user explicitly asking for it in that moment (standing project instructions don't count as blanket authorization — see `CLAUDE.md`). Prefer `--force-with-lease` over bare `--force` when a force-push is genuinely agreed on, since it fails safely if the remote moved since the last fetch.

---

## 7. Pre-Commit / Pre-Push QA Checklist

Run this before **every** commit and again before every push — not just at milestones. This is the "always QA" gate for the repo.

**Before `git add`:**

1. `git status` — does the untracked/modified file list match what you actually intended to change? Anything unfamiliar (a file you didn't create, a stray build folder) gets investigated before it gets staged, never blindly added.
2. `git diff` (or review each new file) — scan for secrets, debug `console.log`/`print` statements left in, commented-out code, and accidental unrelated changes.
3. Confirm no ignored-category file (§4) is about to be staged: `git status` should show it as ignored, not untracked.

**Before commit:** 4. Stage specific files by name — avoid `git add -A`/`git add .` on anything touching config or env-shaped files; it's how secrets sneak in. 5. Commit message follows §3's format and explains _why_.

**Before push:** 6. `git log` — does the commit sequence about to be pushed read cleanly? No "wip," "fix typo," "actually fix" chains that should've been squashed on a feature branch. 7. Once build/lint/test scripts exist (post-scaffold): they pass locally. Don't push red. 8. Confirm target branch and remote (`git branch -vv`, `git remote -v`) — especially important once feature branches exist, to avoid pushing a feature branch's work directly onto `main`. 9. For anything schema/migration-related: has it been reviewed as a diff (SR-B3), not run ad hoc against a live database?

**After push:** 10. `git status` clean, `git log` matches what you expect on the remote (spot-check with `git log origin/main` if anything felt uncertain).

---

## 8. Handling Mistakes — Recovery Playbook

Git rarely loses data permanently as long as nothing has been garbage-collected — know these before panicking:

| Situation                                            | Recovery                                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed to the wrong branch                        | `git log` to find the commit hash → `git cherry-pick <hash>` onto the right branch → `git reset --hard HEAD~1` (only on the wrong branch, only if unpushed) or `git revert` if already pushed. |
| Want to undo the last commit but keep the changes    | `git reset --soft HEAD~1` — uncommits, keeps everything staged.                                                                                                                                |
| Want to undo the last commit and discard the changes | `git reset --hard HEAD~1` — **only if unpushed and confirmed with the user**; this is the destructive path.                                                                                    |
| Already pushed a bad commit                          | `git revert <hash>` — adds a new commit undoing it, safe for shared history. Never `reset --hard` + force-push as the default fix.                                                             |
| Deleted a branch by mistake                          | `git reflog` to find its last commit hash → `git branch <name> <hash>` to resurrect it. Reflog entries expire (default ~90 days) but cover virtually every realistic accident.                 |
| Lost uncommitted work after a `checkout`/`reset`     | `git fsck --lost-found` may recover dangling blobs; success isn't guaranteed, which is exactly why §6 gates these commands behind a status check.                                              |
| Merge conflict mid-merge/rebase and want out         | `git merge --abort` / `git rebase --abort` — returns to the pre-operation state cleanly.                                                                                                       |

**General principle:** prefer `revert` (adds history) over `reset`/`force-push` (rewrites history) for anything already pushed. Reserve history rewriting for pre-push, local-only mistakes.

---

## 9. Merge & PR Practices (once collaborators exist)

Not active today (solo dev, direct-to-`main`), but decided in advance so the transition is friction-free:

- All changes land via PR, reviewed before merge — no direct pushes to `main`.
- `main` is protected: require passing checks (once CI exists) before merge.
- **Squash-merge** feature branches into `main` by default — keeps `main`'s history one-commit-per-feature and legible; the messy in-progress commits stay on the (deleted) feature branch.
- Migrations and admin/security-relevant changes get an explicit second look, even on a small team — matches the "reviewed before running against the live DB" requirement in SR-B3.

---

## 10. Tags & Releases

Not needed pre-MVP. Once there's a deployed, demo-able milestone worth pointing back to (e.g., "pilot launch"), tag it: `git tag -a v0.1.0 -m "Pilot: matching + saved list + reminders"`. Lightweight — this is a portfolio project, not a versioned library; tags exist so "what was live during the pilot" is answerable later, not for semver discipline.

---

## 11. Repository-Level Incident Response

Extends `iskolar-security.md` §14 for git-specific incidents:

1. **Secret leaked in history** → rotate immediately (§5), then decide with the user whether history rewriting is warranted (public repo visibility, how long it was exposed).
2. **Bad force-push overwrote real work** → check `git reflog` on the machine that had the good state before it was overwritten; if another clone has the old history, that clone is the recovery source.
3. **Corrupted/broken local repo** → don't `rm -rf` and re-clone without confirming the remote has everything — `git fsck` first to see what's actually damaged.
4. **Accidental data/migration loss** → recoverable by design per SEC-G5 (schema in migrations + seed script in git); this is the scenario the whole reproducibility requirement exists for.

---

## 12. Ongoing QA Practice for This Project

This is the standing operating rule, not a one-time checklist:

- **Every commit** goes through §7's pre-commit steps — no exceptions for "it's just a small change."
- **Every push** goes through §7's pre-push steps.
- **Every destructive-leaning command** (§6, middle/right columns) gets a `git status` check and explicit confirmation first, every time — past approval of one such command is not standing approval for the next one.
- **Every schema or security-relevant change** gets reviewed as a diff against the relevant spec (`iskolar-security.md`, this doc) before it's committed, not after.
- When this doc and actual practice drift (new tooling, CI added, branching model changes), **update this file in the same PR/commit** that introduces the change — a stale process doc is worse than none, because it's trusted by default.
