-- P3: saved scholarships and deadline reminders, owner-only via RLS.
-- Deferred from P0 because they depend on auth.users, which only becomes
-- meaningful once Supabase Auth (magic link) is wired up. See
-- Context/scholarship-finder-spec.md TDD §4.4.

create table saved_scholarships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, scholarship_id)
);

create table reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  remind_on      date not null,
  lead_days      int not null default 7,
  sent_at        timestamptz,
  -- One active reminder per (user, scholarship) -- makes setReminder() an
  -- idempotent upsert rather than accumulating duplicate rows.
  unique (user_id, scholarship_id)
);

create index saved_scholarships_user_id_idx on saved_scholarships(user_id);
create index reminders_user_id_idx on reminders(user_id);
create index reminders_due_idx on reminders(remind_on) where sent_at is null;

alter table saved_scholarships enable row level security;
alter table reminders enable row level security;

create policy "owner select saved_scholarships"
  on saved_scholarships for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert saved_scholarships"
  on saved_scholarships for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner delete saved_scholarships"
  on saved_scholarships for delete to authenticated
  using (user_id = auth.uid());

create policy "owner select reminders"
  on reminders for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert reminders"
  on reminders for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner update reminders"
  on reminders for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "owner delete reminders"
  on reminders for delete to authenticated
  using (user_id = auth.uid());
