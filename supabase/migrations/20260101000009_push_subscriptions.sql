-- FR18 (docs/PRD.md §4.3): Web Push subscriptions, an alternative/addition
-- to email reminders (free VAPID-based push, no per-message cost unlike
-- SMS). Owner-only RLS, same shape as reminders (20260101000004).

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "owner select push_subscriptions"
  on push_subscriptions for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert push_subscriptions"
  on push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner delete push_subscriptions"
  on push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- authenticated gets exactly what its RLS policies allow (no update policy --
-- a subscription is created or removed, never edited). service_role needs
-- full access: the send-reminders cron reads subscriptions to push to, and
-- prunes rows the push service reports as expired (410 Gone).
grant select, insert, delete on table push_subscriptions to authenticated;
grant select, insert, update, delete on table push_subscriptions to service_role;
