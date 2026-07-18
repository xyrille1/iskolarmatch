import { z } from 'zod';

// Zod mirrors of the DB rows, for runtime-validating data read back via
// supabase-js. Not consumed by anything in P0 -- scaffolded now as part of the
// shared single-source-of-truth types, wired up starting P1.

export const providerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['government', 'lgu', 'private', 'university']),
    website: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
  })
  .strict();

export type Provider = z.infer<typeof providerSchema>;

export const scholarshipSchema = z
  .object({
    id: z.string(),
    provider_id: z.string().nullable(),
    title: z.string(),
    slug: z.string(),
    summary: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    coverage_type: z.enum(['full', 'partial', 'allowance', 'other']).nullable().optional(),
    benefit_summary: z.string().nullable().optional(),
    official_url: z.string(),
    application_url: z.string().nullable().optional(),
    is_published: z.boolean(),
    last_verified_at: z.string().nullable().optional(),
    verified_by: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export type Scholarship = z.infer<typeof scholarshipSchema>;

export const deadlineCycleSchema = z
  .object({
    id: z.string(),
    scholarship_id: z.string(),
    academic_year: z.string().nullable().optional(),
    opens_at: z.string().nullable().optional(),
    closes_at: z.string(),
    status: z.enum(['upcoming', 'open', 'closing_soon', 'closed']),
    notes: z.string().nullable().optional(),
  })
  .strict();

export type DeadlineCycle = z.infer<typeof deadlineCycleSchema>;

export const requirementSchema = z
  .object({
    id: z.string(),
    scholarship_id: z.string(),
    label: z.string(),
    is_mandatory: z.boolean(),
    sort_order: z.number(),
  })
  .strict();

export type Requirement = z.infer<typeof requirementSchema>;
