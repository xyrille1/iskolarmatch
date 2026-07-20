-- Core schema for IskolarMatch P0: providers, scholarships, deadline cycles,
-- eligibility rules, requirements. See docs/DATABASE.md §4.4.
--
-- student_profiles is intentionally NOT created here: docs/SECURITY.md
-- (PR1) overrides the technical design doc's schema and defers persisted student
-- profiles out of MVP to avoid storing minors' RA 10173 sensitive personal
-- information. Matching profile data is session-only, never persisted.
-- saved_scholarships / reminders are deferred to P3/P4 (they depend on auth
-- semantics that don't exist yet).

create table providers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('government', 'lgu', 'private', 'university')),
  website    text,
  logo_url   text
);

create table scholarships (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid references providers(id),
  title             text not null,
  slug              text not null unique,
  summary           text,
  description       text,
  coverage_type     text check (coverage_type in ('full', 'partial', 'allowance', 'other')),
  benefit_summary   text,
  official_url      text not null,
  application_url   text,
  is_published      boolean not null default false,
  last_verified_at  timestamptz,
  verified_by       uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint scholarships_publish_guard
    check (is_published = false or (official_url is not null and last_verified_at is not null))
);

create table deadline_cycles (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  academic_year  text,
  opens_at       date,
  closes_at      date not null,
  status         text not null default 'upcoming',
  notes          text
);

create table eligibility_rules (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  field          text not null,
  operator       text not null check (operator in ('gte', 'lte', 'eq', 'neq', 'in', 'includes', 'is_true', 'is_false')),
  value          jsonb,
  is_mandatory   boolean not null default true,
  human_label    text,
  -- Defense-in-depth mirror of the TS ProfileField enum (lib/types/profile.ts is the
  -- single source of truth; keep this list in sync manually until an admin tool exists).
  constraint eligibility_rules_field_check
    check (field in (
      'education_level', 'year_level', 'gwa', 'course_field', 'region', 'province',
      'income_bracket', 'is_pwd', 'is_solo_parent_dependent', 'is_indigenous', 'is_top_graduate'
    ))
);

create table requirements (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references scholarships(id) on delete cascade,
  label          text not null,
  is_mandatory   boolean not null default true,
  sort_order     int not null default 0
);

create index scholarships_provider_id_idx on scholarships(provider_id);
create index scholarships_is_published_idx on scholarships(is_published) where is_published = true;
create index eligibility_rules_scholarship_id_idx on eligibility_rules(scholarship_id);
create index requirements_scholarship_id_idx on requirements(scholarship_id);
create index deadline_cycles_scholarship_id_idx on deadline_cycles(scholarship_id);
