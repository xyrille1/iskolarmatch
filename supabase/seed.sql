-- P0 seed data: 3 real government scholarships, chosen to exercise the
-- eligible / near-miss / not-eligible buckets and the coverage_type tie-break
-- (full > partial > allowance) in the matching engine and RLS tests.
--
-- This is illustrative/starter data for demo and testing purposes only. Per
-- the spec's own QA principle, the real curated 10-20 dataset (P5) must be
-- independently re-verified against each official source page before any
-- real-world publish.

insert into providers (id, name, type, website) values
  ('00000000-0000-0000-0000-000000000001', 'Commission on Higher Education', 'government', 'https://ched.gov.ph'),
  ('00000000-0000-0000-0000-000000000002', 'DOST Science Education Institute', 'government', 'https://sei.dost.gov.ph'),
  ('00000000-0000-0000-0000-000000000003', 'UniFAST', 'government', 'https://unifast.gov.ph');

-- 1. CHED Merit Scholarship Program (CMSP) -- published, partial coverage
insert into scholarships (
  id, provider_id, title, slug, summary, description, coverage_type, benefit_summary,
  official_url, application_url, is_published, last_verified_at
) values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'CHED Merit Scholarship Program',
  'ched-merit-scholarship-program',
  'Merit-based scholarship for high-achieving college students.',
  'The CHED Merit Scholarship Program (CMSP) provides financial assistance to academically outstanding students enrolled in CHED-recognized higher education institutions.',
  'partial',
  'Tuition subsidy plus a fixed stipend per semester.',
  'https://ched.gov.ph/cmsp',
  'https://ched.gov.ph/cmsp/apply',
  true,
  now()
);

insert into deadline_cycles (scholarship_id, academic_year, opens_at, closes_at, status) values
  ('00000000-0000-0000-0000-000000000101', '2026-2027', '2026-06-01', '2026-09-15', 'open');

insert into eligibility_rules (scholarship_id, field, operator, value, is_mandatory, human_label) values
  ('00000000-0000-0000-0000-000000000101', 'education_level', 'in', '["college"]', true, 'Must be enrolled in college'),
  ('00000000-0000-0000-0000-000000000101', 'gwa', 'gte', '85', true, 'General weighted average of at least 85'),
  ('00000000-0000-0000-0000-000000000101', 'income_bracket', 'in', '["low", "mid"]', true, 'Household income in the low or mid bracket'),
  ('00000000-0000-0000-0000-000000000101', 'is_top_graduate', 'is_true', 'true', false, 'Bonus: top graduate of previous level');

insert into requirements (scholarship_id, label, is_mandatory, sort_order) values
  ('00000000-0000-0000-0000-000000000101', 'Certified true copy of grades', true, 1),
  ('00000000-0000-0000-0000-000000000101', 'Certificate of indigency or income', true, 2),
  ('00000000-0000-0000-0000-000000000101', 'Recommendation letter', false, 3);

-- 2. DOST-SEI Undergraduate Scholarship -- published, full coverage
insert into scholarships (
  id, provider_id, title, slug, summary, description, coverage_type, benefit_summary,
  official_url, application_url, is_published, last_verified_at
) values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000002',
  'DOST-SEI Undergraduate Scholarship',
  'dost-sei-undergraduate-scholarship',
  'Full scholarship for students pursuing priority STEM courses.',
  'The DOST-SEI Undergraduate Scholarship supports Filipino students taking up priority science and technology courses at participating universities.',
  'full',
  'Full tuition, monthly stipend, book and transportation allowance.',
  'https://sei.dost.gov.ph/undergrad',
  'https://sei.dost.gov.ph/undergrad/apply',
  true,
  now()
);

insert into deadline_cycles (scholarship_id, academic_year, opens_at, closes_at, status) values
  ('00000000-0000-0000-0000-000000000102', '2026-2027', '2026-05-01', '2026-08-01', 'open');

insert into eligibility_rules (scholarship_id, field, operator, value, is_mandatory, human_label) values
  ('00000000-0000-0000-0000-000000000102', 'education_level', 'in', '["college"]', true, 'Must be enrolled in college'),
  ('00000000-0000-0000-0000-000000000102', 'course_field', 'in', '["stem"]', true, 'Must be enrolled in a STEM course'),
  ('00000000-0000-0000-0000-000000000102', 'gwa', 'gte', '88', true, 'General weighted average of at least 88'),
  ('00000000-0000-0000-0000-000000000102', 'is_top_graduate', 'is_true', 'true', false, 'Bonus: top graduate of previous level');

insert into requirements (scholarship_id, label, is_mandatory, sort_order) values
  ('00000000-0000-0000-0000-000000000102', 'Certified true copy of grades', true, 1),
  ('00000000-0000-0000-0000-000000000102', 'PSA birth certificate', true, 2),
  ('00000000-0000-0000-0000-000000000102', 'Barangay certificate of residency', false, 3);

-- 3. Tertiary Education Subsidy (TES/UniFAST) -- published, allowance coverage,
-- deliberately broad eligibility (no GWA gate) so it demonstrates a different
-- shape of mandatory-rule set than the two above.
insert into scholarships (
  id, provider_id, title, slug, summary, description, coverage_type, benefit_summary,
  official_url, application_url, is_published, last_verified_at
) values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000003',
  'Tertiary Education Subsidy',
  'tertiary-education-subsidy',
  'Financial subsidy for students from low-income households.',
  'The Tertiary Education Subsidy (TES), administered under UniFAST, provides a subsidy to qualified Filipino students regardless of academic standing, prioritizing financial need.',
  'allowance',
  'Fixed per-semester cash allowance disbursed directly to the student.',
  'https://unifast.gov.ph/tes',
  'https://unifast.gov.ph/tes/apply',
  true,
  now()
);

insert into deadline_cycles (scholarship_id, academic_year, opens_at, closes_at, status) values
  ('00000000-0000-0000-0000-000000000103', '2026-2027', '2026-06-15', '2026-10-31', 'open');

insert into eligibility_rules (scholarship_id, field, operator, value, is_mandatory, human_label) values
  ('00000000-0000-0000-0000-000000000103', 'education_level', 'in', '["college"]', true, 'Must be enrolled in college'),
  ('00000000-0000-0000-0000-000000000103', 'income_bracket', 'in', '["low"]', true, 'Household income in the low bracket'),
  ('00000000-0000-0000-0000-000000000103', 'is_top_graduate', 'is_true', 'true', false, 'Bonus: top graduate of previous level');

insert into requirements (scholarship_id, label, is_mandatory, sort_order) values
  ('00000000-0000-0000-0000-000000000103', 'Certificate of indigency or income', true, 1),
  ('00000000-0000-0000-0000-000000000103', 'Certificate of registration (COR)', true, 2);

-- Negative fixture: a draft/unverified scholarship, deliberately left
-- unpublished. This proves the anon RLS "is_published = true" policy actually
-- filters unpublished rows, not just that the migrations compile -- it is a
-- test fixture, not a 4th real scholarship.
insert into scholarships (
  id, provider_id, title, slug, summary, description, coverage_type, benefit_summary,
  official_url, application_url, is_published, last_verified_at
) values (
  '00000000-0000-0000-0000-000000000199',
  '00000000-0000-0000-0000-000000000001',
  'Draft Unverified Scholarship (RLS test fixture)',
  'draft-unverified-scholarship-rls-fixture',
  'Not a real scholarship -- exists only to verify RLS hides unpublished rows.',
  null,
  'other',
  null,
  'https://ched.gov.ph/draft-fixture',
  null,
  false,
  null
);
