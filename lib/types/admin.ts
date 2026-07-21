import { z } from "zod";
import { operatorSchema, profileFieldSchema } from "@/lib/types/profile";
import { isAllowlistedUrl } from "@/lib/security/url-allowlist";

const urlAllowlistRefinement = (val: string | undefined | null) => !val || isAllowlistedUrl(val);

// Mirrors the DB publish guard + URL allowlist trigger (defense-in-depth,
// docs/SECURITY.md §3.2): the admin form rejects the same things the DB would, so the
// curator gets a clear error instead of a raw constraint-violation message.
export const scholarshipUpsertSchema = z
  .object({
    id: z.string().optional(),
    provider_id: z.string(),
    title: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only."),
    summary: z.string().optional(),
    description: z.string().optional(),
    coverage_type: z.enum(["full", "partial", "allowance", "other"]),
    benefit_summary: z.string().optional(),
    official_url: z
      .string()
      .url()
      .refine(urlAllowlistRefinement, "official_url must be on *.gov.ph, *.edu.ph, or the curated allowlist."),
    application_url: z
      .string()
      .url()
      .optional()
      .or(z.literal(""))
      .refine(urlAllowlistRefinement, "application_url must be on *.gov.ph, *.edu.ph, or the curated allowlist."),
    is_published: z.boolean(),
    last_verified_at: z.string().nullable().optional(),
  })
  .strict()
  .refine((val) => val.is_published === false || (val.official_url && val.last_verified_at), {
    message: "Cannot publish without an official_url and a verification date.",
    path: ["is_published"],
  });

export type ScholarshipUpsertInput = z.infer<typeof scholarshipUpsertSchema>;

export const eligibilityRuleInputSchema = z
  .object({
    scholarship_id: z.string(),
    field: profileFieldSchema,
    operator: operatorSchema,
    value: z.unknown(),
    is_mandatory: z.boolean(),
    human_label: z.string().min(1),
    // FR14 (docs/PRD.md §4.2): optional curator-authored near-miss guidance.
    guidance_text: z.string().optional(),
  })
  .strict();

export const requirementInputSchema = z
  .object({
    scholarship_id: z.string(),
    label: z.string().min(1),
    is_mandatory: z.boolean(),
    sort_order: z.number().int().nonnegative(),
  })
  .strict();

export const deadlineCycleInputSchema = z
  .object({
    scholarship_id: z.string(),
    academic_year: z.string().optional(),
    opens_at: z.string().optional(),
    closes_at: z.string().min(1),
  })
  .strict();

export const providerInputSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["government", "lgu", "private", "university"]),
    website: z.string().url().optional().or(z.literal("")),
  })
  .strict();
