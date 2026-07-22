# IskolarMatch — Database & Row-Level Security

_Authoritative schema reference, generated from the actual migrations in `supabase/migrations/`, not from the original pre-code design. RLS gets its own top-level section (§5) because it is the primary access-control mechanism for this app — see `PRD.md` NFR "Security" and `SECURITY.md` SEC-G2._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** PostgreSQL via Supabase
**Status:** Reflects migrations `20260101000001`–`20260101000011` (through the v2 feature backlog, `PRD.md` §4) — update this doc in the same PR as any new migration

---

## 1. Roles & Trust Model

| Role | What it can do |
| --- | --- |
| `anon` | Read-only, and only rows explicitly exposed by an RLS `select` policy (published scholarships and their children). No write policy exists for this role on any table. |
| `authenticated` | Same public reads as `anon`, plus owner-scoped reads/writes on `saved_scholarships` and `reminders`, plus a self-check read on `admin_users`. |
| `service_role` | Bypasses RLS entirely. Used **only** server-side, in server actions (`lib/actions/admin.ts`) and cron Route Handlers — never sent to the browser. This is the only role that can write to `providers`, `scholarships`, `eligibility_rules`, `requirements`, `deadline_cycles`, `allowlisted_domains`, `admin_users`, or `audit_log`. |

**Design principle:** every table has RLS **enabled**. There is no table relying on "we just never gave the client that query" — access is enforced at the database layer regardless of what the app code does.

## 2. Schema

### Public content (anon-readable when published; service-role writes only)

```
providers
  id            uuid pk default gen_random_uuid()
  name          text not null
  type          text not null check (type in ('government','lgu','private','university'))
  website       text
  logo_url      text
  -- no created_at/updated_at, no FKs

scholarships
  id                uuid pk default gen_random_uuid()
  provider_id       uuid references providers(id)                 -- no ON DELETE action (RESTRICT)
  title             text not null
  slug              text not null unique
  summary           text
  description       text
  coverage_type     text check (coverage_type in ('full','partial','allowance','other'))
  benefit_summary   text
  official_url      text not null                                  -- trust requirement; allowlist-enforced, see §6
  application_url   text                                           -- allowlist-enforced when present
  is_published      boolean not null default false
  last_verified_at  timestamptz                                    -- trust requirement (must be set to publish)
  verified_by       uuid references auth.users(id)                 -- no ON DELETE action
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()             -- NOT auto-refreshed, see §7
  constraint scholarships_publish_guard
    check (is_published = false or (official_url is not null and last_verified_at is not null))

deadline_cycles
  id             uuid pk default gen_random_uuid()
  scholarship_id uuid not null references scholarships(id) on delete cascade
  academic_year  text                        -- e.g. '2026-2027'
  opens_at       date
  closes_at      date not null
  status         text not null default 'upcoming'   -- convention only, NOT DB-constrained, see §7
  notes          text

eligibility_rules                             -- data-driven; new scholarships need rows, not code
  id             uuid pk default gen_random_uuid()
  scholarship_id uuid not null references scholarships(id) on delete cascade
  field          text not null
  operator       text not null check (operator in ('gte','lte','eq','neq','in','includes','is_true','is_false'))
  value          jsonb                        -- number | string | string[] | boolean
  is_mandatory   boolean not null default true
  human_label    text                         -- e.g. "GWA of 90 or higher"
  guidance_text  text                         -- FR14 (PRD.md §4.2): curator-authored "how to qualify
                                               -- next cycle" copy, shown on a failed mandatory rule.
                                               -- Nullable; never AI-generated. Added 20260101000007.
  constraint eligibility_rules_field_check check (field in (
    'education_level','year_level','gwa','course_field','region','province',
    'income_bracket','is_pwd','is_solo_parent_dependent','is_indigenous','is_top_graduate'
  ))                                           -- DB-enforced mirror of the TS ProfileField enum

requirements
  id             uuid pk default gen_random_uuid()
  scholarship_id uuid not null references scholarships(id) on delete cascade
  label          text not null                -- e.g. "Certified True Copy of Form 138"
  is_mandatory   boolean not null default true
  sort_order     int not null default 0
```

### Security (service-role only — see §5)

```
allowlisted_domains                           -- curated foundation domains beyond *.gov.ph / *.edu.ph
  domain     text pk
  note       text
  added_at   timestamptz not null default now()
  -- currently empty; the app-side CURATED_FOUNDATION_DOMAINS list (lib/security/url-allowlist.ts)
  -- is likewise empty today — only gov.ph/edu.ph suffixes are enforced in practice.

scholarship_reports                           -- FR13 (PRD.md §4.1): curator moderation queue for
                                               -- student-submitted "report an issue" flags. NOT public
                                               -- UGC/reviews. Added 20260101000008.
  id             uuid pk default gen_random_uuid()
  scholarship_id uuid not null references scholarships(id) on delete cascade
  reason         text not null check (reason in ('stale_info','broken_link','wrong_deadline','other'))
  detail         text
  reporter_email text                         -- optional, not required to submit
  resolved       boolean not null default false
  resolved_by    uuid references auth.users(id)
  resolved_at    timestamptz
  created_at     timestamptz not null default now()
  -- Zero RLS policies, same as allowlisted_domains: this is the app's first
  -- anon-facing write, and it deliberately gets NO anon insert policy.
  -- Submission goes through a rate-limited Server Action using the
  -- service-role client instead (lib/actions/reports.ts) — see §5.
```

### User-owned (RLS: owner-only via `auth.uid()`)

```
saved_scholarships
  id             uuid pk default gen_random_uuid()
  user_id        uuid not null references auth.users(id) on delete cascade
  scholarship_id uuid not null references scholarships(id) on delete cascade
  created_at     timestamptz not null default now()
  unique(user_id, scholarship_id)              -- no update policy: rows are save/unsave, never edited

reminders
  id             uuid pk default gen_random_uuid()
  user_id        uuid not null references auth.users(id) on delete cascade
  scholarship_id uuid not null references scholarships(id) on delete cascade
  remind_on      date not null                 -- app-computed = soonest closes_at - lead_days, NOT a DB trigger
  lead_days      int not null default 7
  sent_at        timestamptz
  unique(user_id, scholarship_id)               -- one active reminder per (user, scholarship); makes setReminder() idempotent

push_subscriptions                             -- FR18 (PRD.md §4.3): Web Push, alternative/addition to
                                                -- email reminders. Added 20260101000009.
  id         uuid pk default gen_random_uuid()
  user_id    uuid not null references auth.users(id) on delete cascade
  endpoint   text not null unique
  p256dh     text not null
  auth       text not null
  created_at timestamptz not null default now()
  -- No update policy -- a subscription is created or removed, never edited.

saved_list_shares                              -- FR19 (PRD.md §4.3): one active read-only share link
                                                -- per user. Added 20260101000010.
  id         uuid pk default gen_random_uuid()
  user_id    uuid not null unique references auth.users(id) on delete cascade
  slug       text not null unique              -- app-generated (crypto.randomBytes, base64url), unguessable
  created_at timestamptz not null default now()
  -- Regenerating replaces the row (upsert on user_id), invalidating the
  -- previous slug. The table itself has NO anon-facing read policy -- a
  -- share's contents are only ever readable through get_shared_saved_list()
  -- (§6), never a direct SELECT against this table or saved_scholarships.

saved_profiles                                 -- FR20 (PRD.md §4.3): opt-in weekly digest. Added
                                                -- 20260101000011. THE scoped exception to the
                                                -- zero-persisted-profile posture (SECURITY.md §1,
                                                -- SEC-G1) -- signed-in AND explicitly opted-in only.
                                                -- Do not confuse with student_profiles below.
  id                       uuid pk default gen_random_uuid()
  user_id                  uuid not null unique references auth.users(id) on delete cascade
  profile                  jsonb not null       -- whole Profile object, not duplicated columns
  digest_opt_in            boolean not null default true
  notified_scholarship_ids jsonb not null default '[]'::jsonb  -- dedupe so the digest only reports NEW matches
  last_digest_sent_at      timestamptz
  created_at               timestamptz not null default now()
  updated_at               timestamptz not null default now()
```

### Admin (service-role only, `authenticated` gets read-only self-checks)

```
admin_users                                    -- binary membership, no role levels
  user_id    uuid pk references auth.users(id) on delete cascade
  created_at timestamptz not null default now()

audit_log                                      -- append-only; nothing auto-populates it, app code writes explicitly
  id          uuid pk default gen_random_uuid()
  actor_id    uuid references auth.users(id)    -- nullable: allows system/service actions with no human actor
  action      text not null                      -- free text, e.g. "publish", "update" — not DB-constrained
  entity_type text not null                      -- free text, e.g. "scholarship" — not DB-constrained
  entity_id   uuid                               -- nullable, no FK (polymorphic across entity types)
  detail      jsonb
  created_at  timestamptz not null default now()
```

### Source-watcher (FR10, Phase 2) — `source_documents`, `source_sections`, `scholarship_suggestions`

Migration `20260101000012_source_watcher.sql`. All three follow the `scholarship_reports` / `allowlisted_domains` convention exactly: **RLS enabled, zero policies** (default-deny for anon/authenticated), reachable only via the service-role client, with the `grant ... to service_role` in the same migration.

- **`source_documents`** — one row per fetch attempt (history retained; the change-gate diffs against the previous document's sections). `scholarship_id`, `source_url`, `source_kind` (`html`/`pdf`, CHECK), `http_status`, `content_hash`, `raw_byte_size`, `fetch_error`, `fetched_at`. A `source_documents_success_shape` CHECK enforces that a success row has a hash + byte size and no error, and a failure row has an error and no hash. Index on `(scholarship_id, fetched_at desc)`.
- **`source_sections`** — heading-delimited sections of a fetched document, each hashed independently: `section_index`, `heading_label`, `section_hash`, `section_text`, `char_count`, `unique (source_document_id, section_index)`. **Not embedded / no pgvector** — the change-gate compares `section_hash` values to find exactly which sections changed; the changed text is fed verbatim into the extraction prompt and shown to curators as citation context.
- **`scholarship_suggestions`** — the field-level curator-approval queue. One row = one proposed change to one field of one row of one table: `scholarship_id`, `source_document_id`, `target_table` (CHECK: one of the four content tables), `target_row_id` (polymorphic, **no FK** — same pattern as `audit_log.entity_id`; equals the scholarship's own id when `target_table='scholarships'`), `target_field`, `change_kind` (`update_field`/`add_row`/`remove_row`, CHECK), `old_value`/`new_value` (jsonb — `old_value` is filled by the app's deterministic diff, never the LLM), `citing_section_ids` (uuid[]), `confidence` (`high`/`medium`/`low`, CHECK), `confidence_detail` (jsonb), `status` (`pending`/`approved`/`rejected`), `reviewed_by`/`reviewed_at`, `rejection_reason`. CHECKs enforce the row-id shape per `change_kind`, scholarships-are-update-only, and a **field allowlist** mirroring `ALLOWED_FIELDS_BY_TABLE` in `lib/types/source-watcher.ts` (kept in sync manually, same pattern as `eligibility_rules_field_check`). Indexes: `scholarship_suggestions_pending_idx on (created_at) where status='pending'` (mirrors `scholarship_reports_unresolved_idx`), a `scholarship_idx`, and a **partial unique dedupe index** `on (scholarship_id, target_table, coalesce(target_row_id, sentinel), target_field) where status='pending'` so weekly re-runs update the existing pending suggestion instead of duplicating it.

Writes: the cron (`/api/cron/watch-sources`) writes documents/sections/suggestions via the service-role client; curator approval (`lib/actions/suggestions.ts`) routes each approved field through the existing validated admin update actions (never a raw write to `scholarships`), stamps `last_verified_at`/`verified_by` via `markVerified`, and audit-logs. No anon/authenticated write path exists to any of the three tables.

### Deferred / not implemented — do not assume these exist

- **`student_profiles`** — intentionally **not created**. Anonymous matching still runs on an in-session profile only; nothing about a student is persisted for the default, no-account flow. This is a deliberate RA 10173 data-minimization choice for a mostly-minor audience (`SECURITY.md` §1, SEC-G1), not an oversight. **`saved_profiles` (above) is a separate, narrower concept** — a signed-in user's profile, persisted only when they explicitly opt into the FR20 digest — and does not reopen this decision for anonymous browsing/matching, which remains exactly as before.
- ~~**`source_watch`**, **`ingestion_suggestions`**~~ — the FR10 source-watcher **is now built** under different names: `source_documents`, `source_sections`, `scholarship_suggestions` (see the Source-watcher subsection below). The old placeholder names do not exist.

**ProfileField enum (single source of truth):** `education_level | year_level | gwa | course_field | region | province | income_bracket | is_pwd | is_solo_parent_dependent | is_indigenous | is_top_graduate`. Enforced in three independent places today — the TS type (`lib/types/profile.ts`), the Zod schema, and `eligibility_rules_field_check` above — kept in sync manually.

## 3. Constraints & Data Integrity — gaps worth knowing

| Item | Status |
| --- | --- |
| `scholarships_publish_guard` | DB CHECK, real: can't publish without `official_url` + `last_verified_at`. |
| `eligibility_rules_field_check` | DB CHECK, real: rule fields are restricted to the ProfileField list at the database layer, not just in the admin form. |
| `deadline_cycles.status` values | **Not DB-constrained.** `upcoming/open/closing_soon/closed` is an application convention (`lib/deadline/compute-status.ts`); any text currently passes the CHECK-free column. A stray write from a future script could put it in a state the UI doesn't handle — add a CHECK if this becomes a real risk. |
| `reminders.remind_on` computation | **Not DB-enforced.** Computed by `setReminder()` in `lib/actions/saved.ts`, not a generated column or trigger. |
| `scholarships.updated_at` | Has `default now()` but **no `BEFORE UPDATE` trigger** refreshes it — it will go stale unless application code sets it explicitly on every update. |
| `scholarships.provider_id` / `verified_by` FKs | No `ON DELETE` action (default `RESTRICT`) — deleting a provider or an admin user referenced by an existing scholarship will fail rather than cascade or null out. Everything under a scholarship (`deadline_cycles`, `eligibility_rules`, `requirements`) and everything under a user (`saved_scholarships`, `reminders`, `admin_users`) does cascade. |

## 4. Indexes

```
scholarships_provider_id_idx          on scholarships(provider_id)
scholarships_is_published_idx         on scholarships(is_published) where is_published = true   -- partial
eligibility_rules_scholarship_id_idx  on eligibility_rules(scholarship_id)
requirements_scholarship_id_idx       on requirements(scholarship_id)
deadline_cycles_scholarship_id_idx    on deadline_cycles(scholarship_id)
saved_scholarships_user_id_idx        on saved_scholarships(user_id)
reminders_user_id_idx                 on reminders(user_id)
reminders_due_idx                     on reminders(remind_on) where sent_at is null              -- partial
scholarship_reports_scholarship_id_idx on scholarship_reports(scholarship_id)
scholarship_reports_unresolved_idx    on scholarship_reports(created_at) where resolved = false  -- partial
push_subscriptions_user_id_idx        on push_subscriptions(user_id)
saved_list_shares_slug_idx            on saved_list_shares(slug)
saved_profiles_digest_opt_in_idx      on saved_profiles(user_id) where digest_opt_in = true       -- partial
```

The two partial indexes exist specifically to match the exact query shapes RLS policies and the reminder cron use — not general-purpose.

## 5. Row-Level Security — the primary access control

**Every table has RLS enabled.** There is no write policy anywhere for `providers`, `scholarships`, `eligibility_rules`, `requirements`, `deadline_cycles`, `allowlisted_domains`, or `scholarship_reports` — **all writes to those tables require the service-role key**, which only server actions and cron handlers hold. This is the "default-deny baseline": if a policy doesn't explicitly allow it, it's denied.

### Public content — anon + authenticated may `select` published rows only

```sql
create policy "anon read published scholarships"
  on scholarships for select to anon, authenticated
  using (is_published = true);

create policy "anon read providers of published scholarships"
  on providers for select to anon, authenticated
  using (exists (select 1 from scholarships s where s.provider_id = providers.id and s.is_published = true));

-- eligibility_rules, requirements, deadline_cycles: same shape —
-- select allowed only when the parent scholarship is published.
```

An unpublished scholarship (and everything under it — its rules, requirements, cycles) is invisible to `anon`/`authenticated`, full stop.

### `allowlisted_domains` and `scholarship_reports` — zero policies, intentionally

RLS is enabled with **no policies at all** on both, meaning default-deny for every role except `service_role`. Nobody outside a server action can read or write the curated domain list. `scholarship_reports` (FR13) follows the same shape deliberately: it is the app's first anon-facing write, and per `PRD.md` §4.1 it must NOT get its own anon RLS insert policy — the public "report an issue" form (`lib/actions/reports.ts`) goes through a rate-limited Server Action using the service-role client instead, exactly like `submitProfileForm`/`requestMagicLink`, so "no write policy exists for `anon` on any table" stays literally true.

### User-owned tables — `auth.uid()` ownership, no exceptions

```sql
-- saved_scholarships: select / insert / delete for the owner only. No update policy —
-- rows are immutable (you save or unsave; you don't edit a save).
create policy "owner select saved_scholarships" on saved_scholarships for select to authenticated using (user_id = auth.uid());
create policy "owner insert saved_scholarships" on saved_scholarships for insert to authenticated with check (user_id = auth.uid());
create policy "owner delete saved_scholarships" on saved_scholarships for delete to authenticated using (user_id = auth.uid());

-- reminders: full CRUD for the owner.
create policy "owner select reminders" on reminders for select to authenticated using (user_id = auth.uid());
create policy "owner insert reminders" on reminders for insert to authenticated with check (user_id = auth.uid());
create policy "owner update reminders" on reminders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner delete reminders" on reminders for delete to authenticated using (user_id = auth.uid());

-- push_subscriptions (FR18): select/insert/delete for the owner, no update
-- policy -- a subscription is created or removed, never edited. Same shape
-- as saved_scholarships.
-- saved_list_shares (FR19) and saved_profiles (FR20): full owner CRUD,
-- same shape as reminders. saved_list_shares' contents are additionally
-- readable by anon/authenticated ONLY via get_shared_saved_list() (§6) --
-- never a direct policy on this table or saved_scholarships.
```

There is no path — client-side or otherwise — for user A to read or write user B's saved list, reminders, push subscriptions, share link, or saved profile. This is the concrete enforcement of `PRD.md` NFR "Security" and `SECURITY.md` SEC-G2.

### Admin tables

```sql
-- admin_users: a user may only check their OWN membership. Granting/revoking admin
-- requires the service-role key — there is no self-service admin signup.
create policy "self read admin_users" on admin_users for select to authenticated using (user_id = auth.uid());

-- audit_log: readable only by confirmed admins, via a SECURITY DEFINER function
-- (avoids a circular RLS check against admin_users' self-only policy). No insert/
-- update/delete policy for any role — append-only, service-role writes only.
create policy "admin read audit_log" on audit_log for select to authenticated using (is_admin());
```

### What this means for the app

`requireAdmin()` (`lib/auth/require-admin.ts`) is a **UX gate**, not the security boundary — the real boundary is RLS plus the fact that all admin mutations use the service-role client. Even if an admin page's `requireAdmin()` check were accidentally skipped, an `authenticated`-role client still could not write to `scholarships`/`providers`/etc., because no RLS policy permits it.

### A policy is not a grant

`create policy ... to <role>` only gates access a role already has via `GRANT` — it doesn't confer the underlying `SELECT`/`INSERT`/`UPDATE`/`DELETE` privilege on the table. Without the matching `GRANT`, every query from that role fails `permission denied for table X` regardless of what the policy allows, and neither `npm run build` nor the unit suite will catch it (mocked, no real DB). `20260101000006_grant_table_privileges.sql` is where these live for every table above; **any new RLS-policy'd table needs a matching `GRANT` added there (or a new migration) in the same change**, not as an afterthought. `tests/integration/rls.test.ts` against a local stack (`SECURITY.md` §5 checklist) is the only thing that actually exercises this — run it after touching either file.

## 6. Functions & Triggers

```sql
-- Extracts the host from a URL and checks it against gov.ph / edu.ph suffixes
-- (dot-boundary anchored — "evilgov.ph" does NOT match) or the allowlisted_domains
-- table. NULL url -> true (nothing to check). Malformed URL (no scheme) -> false.
create function is_allowlisted_url(url text) returns boolean language plpgsql stable as $$ ... $$;

-- Fires before insert/update of official_url or application_url on scholarships;
-- raises an exception if either fails is_allowlisted_url(). This means even a
-- compromised admin session or a direct service-role script cannot get a phishing
-- link into a published record — it's enforced at the database layer, not just
-- the Zod refinement in lib/types/admin.ts (see SECURITY.md §3).
create trigger scholarships_url_allowlist
  before insert or update of official_url, application_url on scholarships
  for each row execute function enforce_scholarship_url_allowlist();

-- SECURITY DEFINER, search_path pinned to public (hardened against search_path
-- hijacking). Used only by the audit_log select policy above, specifically to
-- sidestep the circular-RLS problem of checking admin_users from within another
-- table's policy.
create function is_admin() returns boolean language sql stable security definer
  set search_path = public as $$ select exists (select 1 from admin_users where user_id = auth.uid()) $$;

-- FR19 (PRD.md §4.3): the ONLY path a saved-list share link's contents are
-- ever read through. SECURITY DEFINER, search_path pinned, mirroring
-- is_admin() above -- lets an anonymous visitor holding just the slug
-- resolve a shared list WITHOUT a client-facing RLS policy on
-- saved_list_shares or saved_scholarships that could someday leak
-- user_id/email through a future join change. The RETURNS TABLE is a
-- narrow, explicit allowlist of scholarship-facing columns only; is_published
-- = true is re-checked here as defense-in-depth. Added 20260101000010;
-- granted EXECUTE to anon, authenticated.
create function get_shared_saved_list(share_slug text)
returns table (scholarship_slug text, title text, provider_name text, closes_at date, opens_at date, status text)
language sql stable security definer set search_path = public as $$ ... $$;
```

## 7. Known Gaps

- **SQL and TypeScript enforce the URL allowlist independently**, with no shared source of truth — `is_allowlisted_url()` in Postgres and `isAllowlistedUrl()` in `lib/security/url-allowlist.ts` must be kept in sync by hand. A change to one without the other is a silent drift risk.
- **`deadline_cycles.status`** has no CHECK constraint restricting it to the four known values.
- **`scholarships.updated_at`** is not auto-refreshed by a trigger.
- **`CURATED_FOUNDATION_DOMAINS`** (and its DB counterpart `allowlisted_domains`) is empty today — only `*.gov.ph`/`*.edu.ph` are allowlisted in practice; foundation-domain curation is a planned P5 feature, not yet built.
- **`scholarship_reports.reason`** is a fixed 4-value CHECK enum (`stale_info`/`broken_link`/`wrong_deadline`/`other`) with no admin UI to add new reasons — adding one requires a migration, matching the `coverage_type`/`operator` convention elsewhere in this schema.
- **`saved_profiles.notified_scholarship_ids`** is an unbounded jsonb array — fine at this MVP's 10-20 scholarship scale, would need a real join table if the catalog grows by orders of magnitude.
