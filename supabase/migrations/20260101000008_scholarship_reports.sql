-- FR13 (docs/PRD.md §4.1): "report an issue" flag on scholarship detail
-- pages -- a curator moderation queue, NOT public UGC/reviews. This is the
-- app's first anon-facing write path, so per the PRD's explicit security
-- note it must NOT get its own anon RLS insert policy (that would break the
-- documented invariant that no write policy exists for anon on any table --
-- docs/DATABASE.md §1, §5). Instead RLS is enabled with ZERO policies here,
-- exactly like allowlisted_domains (20260101000002_url_allowlist.sql):
-- default-deny for anon/authenticated, service-role only. The public
-- submission form (lib/actions/reports.ts) goes through a rate-limited
-- Server Action using the service-role client, the same shape as
-- submitProfileForm/requestMagicLink.

create table scholarship_reports (
  id              uuid primary key default gen_random_uuid(),
  scholarship_id  uuid not null references scholarships(id) on delete cascade,
  reason          text not null check (reason in ('stale_info', 'broken_link', 'wrong_deadline', 'other')),
  detail          text,
  reporter_email  text,
  resolved        boolean not null default false,
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index scholarship_reports_scholarship_id_idx on scholarship_reports(scholarship_id);
-- Matches the exact query the admin moderation queue runs: unresolved
-- reports, oldest first. Mirrors reminders_due_idx's partial-index shape.
create index scholarship_reports_unresolved_idx on scholarship_reports(created_at) where resolved = false;

alter table scholarship_reports enable row level security;
-- No policies at all -- service_role only, matching allowlisted_domains'
-- zero-policy default-deny. Both the public submit path and the admin
-- moderation queue (read + resolve) go through lib/actions/reports.ts and
-- lib/actions/admin.ts's service-role client, gated by rate-limiting and
-- requireAdmin() respectively -- never a client-facing RLS grant.

grant select, insert, update, delete on table scholarship_reports to service_role;
