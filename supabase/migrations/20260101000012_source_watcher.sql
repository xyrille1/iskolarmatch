-- FR10 (docs/PRD.md §1.6, Phase 2): agentic source-watcher. A scheduled job
-- fetches official scholarship source pages, detects per-section changes,
-- runs LLM-grounded structured extraction, and files field-level SUGGESTIONS
-- for a curator to approve or reject. Nothing here ever auto-publishes --
-- last_verified_at/verified_by are only ever stamped by an explicit curator
-- approval, identical to the FR9 "mark verified" flow.
--
-- All three tables follow the scholarship_reports / allowlisted_domains
-- convention exactly (docs/DATABASE.md §5): RLS enabled with ZERO policies
-- (default-deny for anon/authenticated), reachable only via the service-role
-- client. The GRANT to service_role lives in this same migration, per the
-- "any new RLS table needs a matching GRANT in the same change" rule.

-- One row per fetch attempt. History is retained deliberately: the change-gate
-- diffs new sections against the PREVIOUS document's sections. Failed fetches
-- are recorded too (fetch_error set, content_hash null) so a persistently
-- broken official_url surfaces to a curator instead of failing silently.
create table source_documents (
  id              uuid primary key default gen_random_uuid(),
  scholarship_id  uuid not null references scholarships(id) on delete cascade,
  source_url      text not null,
  source_kind     text not null check (source_kind in ('html', 'pdf')),
  http_status     int,
  content_hash    text,
  raw_byte_size   int,
  fetch_error     text,
  fetched_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  -- A success has a hash + byte size and no error; a failure has an error and
  -- no hash. Keeps a half-written row from ever looking like a valid snapshot.
  constraint source_documents_success_shape check (
    (fetch_error is null and content_hash is not null and raw_byte_size is not null)
    or (fetch_error is not null and content_hash is null)
  )
);

create index source_documents_scholarship_fetched_idx
  on source_documents(scholarship_id, fetched_at desc);

-- Heading-delimited sections of a fetched document, each hashed independently.
-- Deliberately NOT embedded / not a vector store: the change-gate compares
-- section_hash values to find exactly which sections changed, and the changed
-- sections' text is fed verbatim into the extraction prompt and shown to the
-- curator as citation context. No pgvector, no retrieval-by-similarity.
create table source_sections (
  id                  uuid primary key default gen_random_uuid(),
  source_document_id  uuid not null references source_documents(id) on delete cascade,
  section_index       int not null,
  heading_label       text,
  section_hash        text not null,
  section_text        text not null,
  char_count          int not null,
  created_at          timestamptz not null default now(),
  unique (source_document_id, section_index)
);

create index source_sections_document_idx on source_sections(source_document_id);
create index source_sections_hash_idx on source_sections(section_hash);

-- Field-level curator-approval queue. One row = one proposed change to ONE
-- field of ONE row of ONE table -- never one row per extraction run, so a
-- curator can approve the good fields and reject a flaky one independently
-- (docs plan §4). target_row_id is polymorphic across four tables and carries
-- no FK, the same pattern as audit_log.entity_id; for target_table =
-- 'scholarships' it is always the scholarship's own id (there is one row),
-- keeping the table+row+field model uniform across all targets.
create table scholarship_suggestions (
  id                  uuid primary key default gen_random_uuid(),
  scholarship_id      uuid not null references scholarships(id) on delete cascade,
  source_document_id  uuid not null references source_documents(id) on delete cascade,
  target_table        text not null check (target_table in ('scholarships', 'eligibility_rules', 'deadline_cycles', 'requirements')),
  target_row_id       uuid,
  target_field        text not null,
  change_kind         text not null check (change_kind in ('update_field', 'add_row', 'remove_row')),
  -- old_value is filled in by OUR deterministic diff from the live record --
  -- never authored by the LLM. new_value is the extracted, schema-validated
  -- proposal. Both jsonb so a value of any field type round-trips cleanly.
  old_value           jsonb,
  new_value           jsonb not null,
  citing_section_ids  uuid[] not null default '{}'::uuid[],
  confidence          text not null check (confidence in ('high', 'medium', 'low')),
  confidence_detail   jsonb,
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by         uuid references auth.users(id),
  reviewed_at         timestamptz,
  rejection_reason    text,
  created_at          timestamptz not null default now(),
  -- add_row targets a not-yet-existing row (no id); update_field/remove_row
  -- target an existing one (id required).
  constraint scholarship_suggestions_row_id_shape check (
    (change_kind = 'add_row' and target_row_id is null)
    or (change_kind in ('update_field', 'remove_row') and target_row_id is not null)
  ),
  -- The scholarships row itself is never added or removed by the watcher --
  -- only its fields updated.
  constraint scholarship_suggestions_scholarships_update_only check (
    target_table <> 'scholarships' or change_kind = 'update_field'
  ),
  -- Defense-in-depth mirror of ALLOWED_FIELDS_BY_TABLE in
  -- lib/types/source-watcher.ts (kept in sync manually, same pattern as
  -- eligibility_rules_field_check). Curator-authored fields (e.g.
  -- eligibility_rules.guidance_text, FR14) are deliberately absent -- the
  -- watcher never proposes changes to human-authored guidance.
  constraint scholarship_suggestions_field_allowlist check (
    (target_table = 'scholarships' and target_field in ('title', 'summary', 'description', 'coverage_type', 'benefit_summary', 'official_url', 'application_url'))
    or (target_table = 'eligibility_rules' and target_field in ('field', 'operator', 'value', 'is_mandatory', 'human_label'))
    or (target_table = 'deadline_cycles' and target_field in ('academic_year', 'opens_at', 'closes_at'))
    or (target_table = 'requirements' and target_field in ('label', 'is_mandatory', 'sort_order'))
  )
);

-- The queue's main query: pending suggestions, oldest first. Mirrors
-- scholarship_reports_unresolved_idx's partial-index shape.
create index scholarship_suggestions_pending_idx
  on scholarship_suggestions(created_at) where status = 'pending';
create index scholarship_suggestions_scholarship_idx
  on scholarship_suggestions(scholarship_id);

-- Dedupe invariant: at most one PENDING suggestion per
-- (scholarship, table, row, field), so weekly re-runs update the existing
-- pending row instead of piling up duplicates. coalesce() collapses a null
-- target_row_id (add_row) to a sentinel so repeated add_row proposals for the
-- same field still collide. The app does an explicit select-then-update-or-
-- insert (lib/source-watcher/upsert-suggestions.ts) rather than relying on
-- PostgREST upsert against this expression index; this index is the safety net.
create unique index scholarship_suggestions_pending_dedupe_idx
  on scholarship_suggestions(
    scholarship_id,
    target_table,
    coalesce(target_row_id, '00000000-0000-0000-0000-000000000000'::uuid),
    target_field
  ) where status = 'pending';

alter table source_documents enable row level security;
alter table source_sections enable row level security;
alter table scholarship_suggestions enable row level security;
-- No policies at all -- service_role only, exactly like allowlisted_domains
-- and scholarship_reports. Anon/authenticated get default-deny.

grant select, insert, update, delete on table source_documents to service_role;
grant select, insert, update, delete on table source_sections to service_role;
grant select, insert, update, delete on table scholarship_suggestions to service_role;
