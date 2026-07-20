# IskolarMatch — Data Models

_Database schema for the Philippine scholarship discovery and matching tool, extracted from the Technical Design Document._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** PostgreSQL via Supabase
**Status:** Draft v1 for build

---

## 4.4 Data Models

```
providers
  id            uuid pk
  name          text not null
  type          text check in ('government','lgu','private','university')
  website       text
  logo_url      text

scholarships
  id                uuid pk
  provider_id       uuid fk → providers
  title             text not null
  slug              text unique not null
  summary           text
  description       text
  coverage_type     text check in ('full','partial','allowance','other')
  benefit_summary   text
  official_url      text not null          -- trust requirement
  application_url   text
  is_published      boolean default false
  last_verified_at  timestamptz            -- trust requirement (must be set to publish)
  verified_by       uuid fk → auth.users
  created_at        timestamptz default now()
  updated_at        timestamptz default now()
  -- CHECK: is_published = false OR (official_url is not null AND last_verified_at is not null)

deadline_cycles
  id             uuid pk
  scholarship_id uuid fk → scholarships (on delete cascade)
  academic_year  text                       -- e.g. '2026-2027'
  opens_at       date
  closes_at      date not null
  status         text default 'upcoming'    -- computed daily: upcoming|open|closing_soon|closed
  notes          text

eligibility_rules                            -- data-driven; new scholarships need rows, not code
  id             uuid pk
  scholarship_id uuid fk → scholarships (on delete cascade)
  field          text not null              -- must match a ProfileField key (see enum)
  operator       text not null check in ('gte','lte','eq','neq','in','includes','is_true','is_false')
  value          jsonb                       -- number | string | string[] | boolean
  is_mandatory   boolean default true
  human_label    text                        -- e.g. "GWA of 90 or higher"

requirements
  id             uuid pk
  scholarship_id uuid fk → scholarships (on delete cascade)
  label          text not null               -- e.g. "Certified True Copy of Form 138"
  is_mandatory   boolean default true
  sort_order     int default 0

student_profiles                             -- RLS: owner only; optional (anon match doesn't persist)
  id               uuid pk
  user_id          uuid fk → auth.users
  education_level  text                       -- shs_graduate | college
  year_level       int
  gwa              numeric(5,2)
  course_field     text                       -- stem | health | education | business | arts | other
  region           text
  province         text
  income_bracket   text                       -- low | mid | high  (bracketed, not exact peso)
  is_pwd           boolean default false
  is_solo_parent_dependent boolean default false
  is_indigenous    boolean default false
  is_top_graduate  boolean default false
  updated_at       timestamptz default now()

saved_scholarships                           -- RLS: owner only
  id             uuid pk
  user_id        uuid fk → auth.users
  scholarship_id uuid fk → scholarships
  created_at     timestamptz default now()
  unique(user_id, scholarship_id)

reminders                                    -- RLS: owner only
  id             uuid pk
  user_id        uuid fk → auth.users
  scholarship_id uuid fk → scholarships
  remind_on      date not null               -- computed = closes_at - lead_days
  lead_days      int default 7
  sent_at        timestamptz

-- Phase 2, admin only ------------------------------------------------
source_watch
  id             uuid pk
  scholarship_id uuid fk → scholarships
  source_url     text not null
  last_hash      text
  last_checked_at timestamptz
  change_detected boolean default false

ingestion_suggestions
  id             uuid pk
  scholarship_id uuid fk → scholarships (nullable = new candidate)
  source_url     text
  raw_extract    jsonb                       -- LLM structured guess
  proposed_diff  jsonb
  status         text default 'pending' check in ('pending','approved','rejected')
  created_at     timestamptz default now()
```

**ProfileField enum (single source of truth, shared TS type):**
`education_level | year_level | gwa | course_field | region | province | income_bracket | is_pwd | is_solo_parent_dependent | is_indigenous | is_top_graduate`

Every `eligibility_rules.field` MUST be one of these keys — enforce with a Zod validator in the admin form so a rule can never reference a field the matcher can't read.
