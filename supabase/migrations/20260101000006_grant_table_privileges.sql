-- Table-level GRANTs. In Postgres, RLS policies only gate access a role
-- already has via GRANT -- `create policy ... to anon` does not itself grant
-- SELECT on the table. Every prior RLS migration (0003, 0004, 0005) defined
-- policies with no matching GRANT, so anon/authenticated/service_role all
-- got "permission denied for table X" on every table in this schema: the
-- anon-key matching flow (lib/actions/match-profile.ts, FR1/FR2) was broken
-- end to end, as was the service-role admin/cron path. Confirmed against a
-- local stack via tests/integration/rls.test.ts before this fix.

grant usage on schema public to anon, authenticated, service_role;

-- Public content: anon + authenticated get SELECT only, matching the
-- read-only policies in 20260101000003_rls_policies.sql. service_role gets
-- full CRUD for admin server actions (lib/actions/admin.ts) and the
-- refresh-deadlines cron (app/api/cron/refresh-deadlines).
grant select
  on table providers, scholarships, eligibility_rules, requirements, deadline_cycles
  to anon, authenticated;

grant select, insert, update, delete
  on table providers, scholarships, eligibility_rules, requirements, deadline_cycles
  to service_role;

-- allowlisted_domains: service_role only, matching its zero-policy
-- default-deny for anon/authenticated (20260101000002_url_allowlist.sql).
grant select, insert, update, delete on table allowlisted_domains to service_role;

-- saved_scholarships: authenticated gets exactly what its RLS policies allow
-- (select/insert/delete -- no update policy, rows are immutable).
-- service_role needs full access for admin/cron use.
grant select, insert, delete on table saved_scholarships to authenticated;
grant select, insert, update, delete on table saved_scholarships to service_role;

-- reminders: full CRUD for the owner (matches RLS), and for service_role
-- (the send-reminders cron reads pending reminders and stamps sent_at).
grant select, insert, update, delete on table reminders to authenticated, service_role;

-- Admin tables: authenticated can only ever SELECT (self admin-check /
-- audit read, both RLS-gated); service_role performs all writes.
grant select on table admin_users, audit_log to authenticated;
grant select, insert, update, delete on table admin_users, audit_log to service_role;
