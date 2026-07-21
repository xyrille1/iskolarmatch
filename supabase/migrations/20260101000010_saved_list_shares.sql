-- FR19 (docs/PRD.md §4.3): shareable read-only saved-list link. One active
-- share per user (regenerating replaces/invalidates the previous slug --
-- no accumulating unrevoked links). The table itself has NO anon-facing
-- read policy; a share's contents are only ever readable through
-- get_shared_saved_list() below.

create table saved_list_shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create index saved_list_shares_slug_idx on saved_list_shares(slug);

alter table saved_list_shares enable row level security;

create policy "owner select saved_list_shares"
  on saved_list_shares for select to authenticated
  using (user_id = auth.uid());

create policy "owner insert saved_list_shares"
  on saved_list_shares for insert to authenticated
  with check (user_id = auth.uid());

create policy "owner update saved_list_shares"
  on saved_list_shares for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "owner delete saved_list_shares"
  on saved_list_shares for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table saved_list_shares to authenticated;
grant select, insert, update, delete on table saved_list_shares to service_role;

-- The only path a share link's contents are ever read through. SECURITY
-- DEFINER so an anonymous visitor holding just the slug can resolve a
-- shared list WITHOUT a client-facing RLS policy on saved_scholarships (or
-- this table) that could someday leak user_id/email through a future join
-- change -- the RETURNS TABLE below is a narrow, explicit allowlist of
-- scholarship-facing columns only. search_path pinned, mirroring is_admin()
-- (20260101000005_admin_and_audit.sql). is_published = true is enforced
-- again here even though saved_scholarships should only ever reference
-- published rows, as defense-in-depth against ever exposing a draft.
create or replace function get_shared_saved_list(share_slug text)
returns table (
  scholarship_slug text,
  title text,
  provider_name text,
  closes_at date,
  opens_at date,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.slug, s.title, p.name, dc.closes_at, dc.opens_at, dc.status
  from saved_list_shares share
  join saved_scholarships saved on saved.user_id = share.user_id
  join scholarships s on s.id = saved.scholarship_id and s.is_published = true
  left join providers p on p.id = s.provider_id
  left join lateral (
    select closes_at, opens_at, status
    from deadline_cycles
    where scholarship_id = s.id
    order by closes_at asc
    limit 1
  ) dc on true
  where share.slug = share_slug;
$$;

grant execute on function get_shared_saved_list(text) to anon, authenticated;
