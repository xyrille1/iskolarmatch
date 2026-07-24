-- FR22 (docs/PRD.md §4.7): automated discovery of NEW scholarships. Where the
-- FR10 source-watcher (migration ...012) only re-checks scholarships that
-- ALREADY exist, this stage discovers ones that don't. A scheduled crawler
-- reads curator-registered official gov.ph/edu.ph *index* pages, extracts
-- candidate detail links, runs an LLM structured extraction over each new
-- detail page, and files a draft into scholarship_candidates for curator
-- review. Nothing here ever auto-publishes: a candidate becomes a real
-- scholarship ONLY when a curator promotes it through the validated
-- upsertScholarship admin action (Zod + URL allowlist + publish guard + audit),
-- identical in spirit to the FR10 suggestion-approval gate.
--
-- Both tables follow the source_watcher / scholarship_reports convention exactly
-- (docs/DATABASE.md §5): RLS enabled with ZERO policies (default-deny for
-- anon/authenticated), reachable only via the service-role client, with the
-- matching GRANT in this same migration.

-- Curator-managed registry of official index/listing pages to crawl. The
-- crawler only ever fetches pages reachable from these registered URLs, so the
-- set of sites the app touches is an explicit, auditable curator decision --
-- never an open-ended crawl of the web.
create table source_index_pages (
  id                 uuid primary key default gen_random_uuid(),
  provider_id        uuid references providers(id) on delete set null,
  index_url          text not null unique,
  label              text,
  is_active          boolean not null default true,
  last_crawled_at    timestamptz,
  last_content_hash  text,          -- change-gate: skip the LLM when the link set is unchanged
  last_error         text,          -- a persistently failing index page surfaces to the curator
  created_at         timestamptz not null default now()
);

create index source_index_pages_active_crawled_idx
  on source_index_pages(last_crawled_at) where is_active = true;

-- Discovery review queue. One row = one candidate NEW scholarship the crawler
-- found and drafted, awaiting curator review. This is deliberately a separate
-- table from scholarship_suggestions (...012): that queue is field-level and
-- structurally forbids adding a whole scholarship row
-- (scholarship_suggestions_scholarships_update_only), whereas a discovery IS a
-- whole new draft record.
create table scholarship_candidates (
  id                       uuid primary key default gen_random_uuid(),
  source_index_page_id     uuid references source_index_pages(id) on delete set null,
  -- The official detail page the draft was extracted from. This becomes the
  -- promoted scholarship's official_url, so it is allowlist-enforced here too
  -- (defense-in-depth with the fetch guard and the scholarships URL trigger).
  detail_url               text not null,
  content_hash             text,
  -- The extracted draft (title/coverage/benefit/deadline/eligibility notes/
  -- requirement labels). jsonb, not columns, because it is an un-verified draft
  -- a human reviews and edits at promotion -- never queried as live data.
  extracted                jsonb not null,
  -- Verbatim snippets of the source sections the draft was read from, shown to
  -- the curator as evidence (parallel to scholarship_suggestions citations).
  citing_snippets          jsonb not null default '[]'::jsonb,
  confidence               text not null check (confidence in ('high', 'medium', 'low')),
  status                   text not null default 'pending'
                             check (status in ('pending', 'approved', 'rejected', 'duplicate')),
  -- Normalized detail_url used to dedupe re-discoveries of the same page.
  dedupe_key               text not null,
  promoted_scholarship_id  uuid references scholarships(id) on delete set null,
  reviewed_by              uuid references auth.users(id),
  reviewed_at              timestamptz,
  rejection_reason         text,
  created_at               timestamptz not null default now()
);

-- Queue query: pending candidates, oldest first (mirrors the suggestions queue).
create index scholarship_candidates_pending_idx
  on scholarship_candidates(created_at) where status = 'pending';

-- Dedupe invariant: at most one PENDING candidate per source page, so a weekly
-- re-crawl doesn't pile up duplicates. The app also checks dedupe_key against
-- live scholarships.official_url before inserting (lib/source-discovery/
-- run-discovery.ts); this index is the safety net.
create unique index scholarship_candidates_pending_dedupe_idx
  on scholarship_candidates(dedupe_key) where status = 'pending';

-- Allowlist enforcement at the DB layer (same posture as the scholarships URL
-- trigger in ...002): a candidate detail_url, and a registered index_url, must
-- resolve to gov.ph / edu.ph / a curated allowlisted domain. Reuses the shared
-- is_allowlisted_url() from migration ...002 so there is one source of truth.
create or replace function enforce_source_discovery_url_allowlist()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'source_index_pages' then
    if not is_allowlisted_url(new.index_url) then
      raise exception 'index_url % is not on the allowlist (gov.ph / edu.ph / curated domains)', new.index_url;
    end if;
  elsif tg_table_name = 'scholarship_candidates' then
    if not is_allowlisted_url(new.detail_url) then
      raise exception 'detail_url % is not on the allowlist (gov.ph / edu.ph / curated domains)', new.detail_url;
    end if;
  end if;
  return new;
end;
$$;

create trigger source_index_pages_url_allowlist
  before insert or update of index_url on source_index_pages
  for each row execute function enforce_source_discovery_url_allowlist();

create trigger scholarship_candidates_url_allowlist
  before insert or update of detail_url on scholarship_candidates
  for each row execute function enforce_source_discovery_url_allowlist();

alter table source_index_pages enable row level security;
alter table scholarship_candidates enable row level security;
-- No policies at all -- service_role only, exactly like source_documents /
-- scholarship_suggestions / allowlisted_domains. Anon/authenticated: default-deny.

grant select, insert, update, delete on table source_index_pages to service_role;
grant select, insert, update, delete on table scholarship_candidates to service_role;
