-- P5: admin role table + append-only audit log for privileged writes.
-- Per Context/iskolar-security.md SR-A5/SR-A6 (admin authz via a trusted
-- server-side source, never a client claim) and SR-D3 (audit log).

create table admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

-- A user may check only their own admin membership; only the service role
-- can grant/revoke (no insert/update/delete policy exists).
create policy "self read admin_users"
  on admin_users for select to authenticated
  using (user_id = auth.uid());

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

alter table audit_log enable row level security;
-- Append-only, admin-readable, service-role-writable: no insert/update/delete
-- policy for any role (only the service role writes it); no select policy
-- for non-admins. Admins can read via a security-definer function to avoid
-- a circular RLS dependency on admin_users.

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

create policy "admin read audit_log"
  on audit_log for select to authenticated
  using (is_admin());
