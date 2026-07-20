# IskolarMatch — Database & Row-Level Security

_Authoritative schema reference, generated from the actual migrations in `supabase/migrations/`, not from the original pre-code design. RLS gets its own top-level section (§5) because it is the primary access-control mechanism for this app — see `PRD.md` NFR "Security" and `SECURITY.md` SEC-G2._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** PostgreSQL via Supabase
**Status:** Reflects migrations `20260101000001`–`20260101000005` — update this doc in the same PR as any new migration

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

### Deferred / not implemented — do not assume these exist

- **`student_profiles`** — intentionally **not created**. Matching runs on an in-session profile only; nothing about a student is persisted unless they sign in to save/remind. This is a deliberate RA 10173 data-minimization choice for a mostly-minor audience (`SECURITY.md` §1, SEC-G1), not an oversight.
- **`source_watch`**, **`ingestion_suggestions`** — Phase 2 (FR10, agentic source-watcher) tables; no migration exists yet. Do not reference them as current state.

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
```

The two partial indexes exist specifically to match the exact query shapes RLS policies and the reminder cron use — not general-purpose.

## 5. Row-Level Security — the primary access control

**Every table has RLS enabled.** There is no write policy anywhere for `providers`, `scholarships`, `eligibility_rules`, `requirements`, `deadline_cycles`, or `allowlisted_domains` — **all writes to those tables require the service-role key**, which only server actions and cron handlers hold. This is the "default-deny baseline": if a policy doesn't explicitly allow it, it's denied.

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

### `allowlisted_domains` — zero policies, intentionally

RLS is enabled with **no policies at all**, meaning default-deny for every role except `service_role`. Nobody outside a server action can read or write the curated domain list.

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
```

There is no path — client-side or otherwise — for user A to read or write user B's saved list or reminders. This is the concrete enforcement of `PRD.md` NFR "Security" and `SECURITY.md` SEC-G2.

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
```

## 7. Known Gaps

- **SQL and TypeScript enforce the URL allowlist independently**, with no shared source of truth — `is_allowlisted_url()` in Postgres and `isAllowlistedUrl()` in `lib/security/url-allowlist.ts` must be kept in sync by hand. A change to one without the other is a silent drift risk.
- **`deadline_cycles.status`** has no CHECK constraint restricting it to the four known values.
- **`scholarships.updated_at`** is not auto-refreshed by a trigger.
- **`CURATED_FOUNDATION_DOMAINS`** (and its DB counterpart `allowlisted_domains`) is empty today — only `*.gov.ph`/`*.edu.ph` are allowlisted in practice; foundation-domain curation is a planned P5 feature, not yet built.
