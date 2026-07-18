import { z } from 'zod';

// Single source of truth for every field a scholarship's eligibility rules can
// reference. Kept in sync manually with the DB CHECK constraint on
// eligibility_rules.field (supabase/migrations/20260101000001_init_core_schema.sql).
export const PROFILE_FIELDS = [
  'education_level',
  'year_level',
  'gwa',
  'course_field',
  'region',
  'province',
  'income_bracket',
  'is_pwd',
  'is_solo_parent_dependent',
  'is_indigenous',
  'is_top_graduate',
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const profileFieldSchema = z.enum(PROFILE_FIELDS);

export const OPERATORS = [
  'gte',
  'lte',
  'eq',
  'neq',
  'in',
  'includes',
  'is_true',
  'is_false',
] as const;

export type Operator = (typeof OPERATORS)[number];

export const operatorSchema = z.enum(OPERATORS);

// Profile data is session-only and never persisted (Context/iskolar-security.md
// PR1) -- there is no student_profiles table. All fields are optional: a
// missing field is treated as a failed mandatory rule by the matching engine,
// never inferred.
export const profileSchema = z
  .object({
    education_level: z.string().optional(),
    year_level: z.string().optional(),
    gwa: z.number().optional(),
    course_field: z.string().optional(),
    region: z.string().optional(),
    province: z.string().optional(),
    income_bracket: z.string().optional(),
    is_pwd: z.boolean().optional(),
    is_solo_parent_dependent: z.boolean().optional(),
    is_indigenous: z.boolean().optional(),
    is_top_graduate: z.boolean().optional(),
  })
  .strict();

export type Profile = z.infer<typeof profileSchema>;

export const ruleSchema = z
  .object({
    id: z.string(),
    scholarship_id: z.string(),
    field: profileFieldSchema,
    operator: operatorSchema,
    value: z.unknown(),
    is_mandatory: z.boolean(),
    human_label: z.string().nullable().optional(),
  })
  .strict();

export type Rule = z.infer<typeof ruleSchema>;
