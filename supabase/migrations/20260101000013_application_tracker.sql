-- FR21 (docs/PRD.md §4.6): application progress tracker. Turns the saved list
-- from a bookmark+reminder list into the "spreadsheet replacement" the PRD
-- positions the product as (§1.1). Two owner-scoped tables, signed-in only,
-- mirroring the saved_scholarships / reminders posture exactly:
--   * user_id is always the session user (auth.uid()); RLS is the isolation
--     boundary, the app never filters by user_id itself.
--   * This is authenticated-owner write surface, NOT anon-write (contrast
--     scholarship_reports / the source-watcher tables, which are service-role
--     only). It does NOT persist the matching profile, so the zero-persisted
--     -profile posture (docs/SECURITY.md SEC-G1) is unchanged.

-- application_progress: one row per (user, scholarship), created on the first
-- status/note edit. Absence of a row = the implicit "interested" default (the
-- act of saving already implies interest). status/notes are mutable, so this
-- gets an UPDATE policy, mirroring reminders.
create table application_progress (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  status         text not null default 'interested'
                   check (status in ('interested', 'preparing', 'applied', 'submitted')),
  notes          text,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  -- One progress row per (user, scholarship) -- makes setApplicationStatus /
  -- saveApplicationNotes idempotent upserts rather than accumulating rows.
  unique (user_id, scholarship_id)
);

-- requirement_checkoffs: presence = checked, exactly like saved_scholarships.
-- Rows are immutable toggles (insert to check, delete to uncheck), so there is
-- deliberately NO update policy. requirement_id is globally unique and FKs to a
-- single scholarship's requirement, so (user, requirement) alone is sufficient.
create table requirement_checkoffs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  requirement_id uuid not null references requirements(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, requirement_id)
);

create index application_progress_user_id_idx on application_progress(user_id);
create index requirement_checkoffs_user_id_idx on requirement_checkoffs(user_id);

alter table application_progress enable row level security;
alter table requirement_checkoffs enable row level security;

-- application_progress: owner-only CRUD (mirrors reminders -- mutable rows).
create policy "owner select application_progress"
  on application_progress for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert application_progress"
  on application_progress for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner update application_progress"
  on application_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "owner delete application_progress"
  on application_progress for delete to authenticated
  using (user_id = auth.uid());

-- requirement_checkoffs: owner select/insert/delete, no update (mirrors
-- saved_scholarships -- immutable presence toggles).
create policy "owner select requirement_checkoffs"
  on requirement_checkoffs for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert requirement_checkoffs"
  on requirement_checkoffs for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner delete requirement_checkoffs"
  on requirement_checkoffs for delete to authenticated
  using (user_id = auth.uid());

-- Table-level GRANTs. RLS policies only gate access a role already has via
-- GRANT -- without these, authenticated hits "permission denied for table".
-- See 20260101000006_grant_table_privileges.sql and docs/DATABASE.md §5 for
-- the exact bug this prevents.
grant select, insert, update, delete on table application_progress to authenticated, service_role;
grant select, insert, delete on table requirement_checkoffs to authenticated;
grant select, insert, update, delete on table requirement_checkoffs to service_role;
