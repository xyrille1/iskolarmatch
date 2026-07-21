-- FR20 (docs/PRD.md §4.3): opt-in weekly "new matches for you" digest --
-- the ONE feature in the v2 backlog that persists a signed-in user's
-- profile answers, and only when they explicitly opt in. This is a
-- deliberate, scoped exception to the app's zero-persisted-profile posture
-- (docs/SECURITY.md SEC-G1) -- anonymous matching still persists nothing;
-- this table exists only for users who sign in AND opt in.
--
-- Named saved_profiles, NOT student_profiles: docs/DATABASE.md §2 documents
-- student_profiles as intentionally absent for anonymous matching, and that
-- remains true. This is a separate, narrower, opt-in-only concept.

create table saved_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  -- Whole Profile object as jsonb rather than duplicated columns (mirrors
  -- eligibility_rules.value's jsonb convention) -- avoids a second place
  -- that must track lib/types/profile.ts's ProfileField list.
  profile                  jsonb not null,
  digest_opt_in            boolean not null default true,
  -- Scholarship ids already emailed to this user, so the weekly digest only
  -- ever reports NEW matches, never repeats. Small array at this MVP's
  -- scale (10-20 scholarships) -- a join table would be overkill.
  notified_scholarship_ids jsonb not null default '[]'::jsonb,
  last_digest_sent_at      timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Matches the reminders cron's query shape: "which opted-in profiles are
-- due," scoped to true (partial index, mirrors reminders_due_idx).
create index saved_profiles_digest_opt_in_idx on saved_profiles(user_id) where digest_opt_in = true;

alter table saved_profiles enable row level security;

-- Full owner CRUD, mirroring reminders (20260101000004) exactly: a user can
-- opt in, update their saved profile, or delete it (opt out + erase) at any
-- time via their own authenticated session.
create policy "owner select saved_profiles"
  on saved_profiles for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert saved_profiles"
  on saved_profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner update saved_profiles"
  on saved_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "owner delete saved_profiles"
  on saved_profiles for delete to authenticated
  using (user_id = auth.uid());

-- authenticated gets exactly what RLS allows; service_role needs full
-- access for the weekly send-digest cron (reads opted-in profiles, updates
-- notified_scholarship_ids/last_digest_sent_at).
grant select, insert, update, delete on table saved_profiles to authenticated;
grant select, insert, update, delete on table saved_profiles to service_role;
