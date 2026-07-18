import "server-only";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { CoverageType } from "@/lib/types/matching";
import type { DeadlineStatus } from "@/lib/deadline/format-status";

export interface ScholarshipDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverageType: CoverageType;
  benefitSummary: string | null;
  officialUrl: string;
  applicationUrl: string | null;
  lastVerifiedAt: string | null;
  providerName: string;
  deadlineCycles: { closesAt: string; opensAt: string | null; status: DeadlineStatus; academicYear: string | null }[];
  eligibilityRules: { id: string; humanLabel: string | null; isMandatory: boolean }[];
  requirements: { id: string; label: string; isMandatory: boolean; sortOrder: number }[];
}

interface ScholarshipDetailRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverage_type: CoverageType | null;
  benefit_summary: string | null;
  official_url: string;
  application_url: string | null;
  last_verified_at: string | null;
  providers: { name: string } | null;
  deadline_cycles: { closes_at: string; opens_at: string | null; status: DeadlineStatus; academic_year: string | null }[];
  eligibility_rules: { id: string; human_label: string | null; is_mandatory: boolean }[];
  requirements: { id: string; label: string; is_mandatory: boolean; sort_order: number }[];
}

// Data (SSR + metadata for SEO) for /s/[slug]. RLS scopes anon reads to
// is_published = true rows, so an unpublished/draft slug simply returns null.
export async function getScholarship(slug: string): Promise<ScholarshipDetail | null> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("scholarships")
    .select(
      `id, slug, title, summary, description, coverage_type, benefit_summary,
       official_url, application_url, last_verified_at,
       providers ( name ),
       deadline_cycles ( closes_at, opens_at, status, academic_year ),
       eligibility_rules ( id, human_label, is_mandatory ),
       requirements ( id, label, is_mandatory, sort_order )`
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load scholarship.");
  }
  if (!data) return null;

  const row = data as unknown as ScholarshipDetailRow;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    coverageType: row.coverage_type ?? "other",
    benefitSummary: row.benefit_summary,
    officialUrl: row.official_url,
    applicationUrl: row.application_url,
    lastVerifiedAt: row.last_verified_at,
    providerName: row.providers?.name ?? "Unknown provider",
    deadlineCycles: [...row.deadline_cycles]
      .sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at))
      .map((c) => ({ closesAt: c.closes_at, opensAt: c.opens_at, status: c.status, academicYear: c.academic_year })),
    eligibilityRules: row.eligibility_rules.map((r) => ({
      id: r.id,
      humanLabel: r.human_label,
      isMandatory: r.is_mandatory,
    })),
    requirements: [...row.requirements]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, label: r.label, isMandatory: r.is_mandatory, sortOrder: r.sort_order })),
  };
}
