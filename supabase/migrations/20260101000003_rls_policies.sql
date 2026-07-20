-- Row Level Security: default-deny baseline. Public tables are anon-readable
-- only where is_published = true; no write policies exist anywhere, so all
-- writes require the service-role key. See docs/SECURITY.md SR-A3/SR-A4.

alter table providers enable row level security;
alter table scholarships enable row level security;
alter table eligibility_rules enable row level security;
alter table requirements enable row level security;
alter table deadline_cycles enable row level security;
alter table allowlisted_domains enable row level security;

create policy "anon read published scholarships"
  on scholarships for select to anon, authenticated
  using (is_published = true);

-- providers has no is_published column of its own: visibility is derived from
-- whether it has at least one published scholarship. Revisit if a P5 admin
-- provider-list page needs different visibility rules.
create policy "anon read providers of published scholarships"
  on providers for select to anon, authenticated
  using (exists (
    select 1 from scholarships s
    where s.provider_id = providers.id and s.is_published = true
  ));

create policy "anon read eligibility rules of published scholarships"
  on eligibility_rules for select to anon, authenticated
  using (exists (
    select 1 from scholarships s
    where s.id = eligibility_rules.scholarship_id and s.is_published = true
  ));

create policy "anon read requirements of published scholarships"
  on requirements for select to anon, authenticated
  using (exists (
    select 1 from scholarships s
    where s.id = requirements.scholarship_id and s.is_published = true
  ));

create policy "anon read deadline cycles of published scholarships"
  on deadline_cycles for select to anon, authenticated
  using (exists (
    select 1 from scholarships s
    where s.id = deadline_cycles.scholarship_id and s.is_published = true
  ));

-- allowlisted_domains: RLS enabled, no policies at all -> default-deny for
-- anon/authenticated. Only the service role can read/write it.
