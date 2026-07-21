import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CoverageType } from "@/lib/types/matching";
import type { ProfileField, Operator } from "@/lib/types/profile";

export interface AdminScholarshipDetail {
  id: string;
  provider_id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  coverage_type: CoverageType | null;
  benefit_summary: string | null;
  official_url: string;
  application_url: string | null;
  is_published: boolean;
  last_verified_at: string | null;
  eligibilityRules: {
    id: string;
    field: ProfileField;
    operator: Operator;
    value: unknown;
    is_mandatory: boolean;
    human_label: string | null;
    guidance_text: string | null;
  }[];
  requirements: { id: string; label: string; is_mandatory: boolean; sort_order: number }[];
  deadlineCycles: { id: string; academic_year: string | null; opens_at: string | null; closes_at: string; status: string }[];
}

export async function getAdminScholarshipDetail(id: string): Promise<AdminScholarshipDetail | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scholarships")
    .select(
      `id, provider_id, title, slug, summary, description, coverage_type, benefit_summary,
       official_url, application_url, is_published, last_verified_at,
       eligibility_rules ( id, field, operator, value, is_mandatory, human_label, guidance_text ),
       requirements ( id, label, is_mandatory, sort_order ),
       deadline_cycles ( id, academic_year, opens_at, closes_at, status )`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Failed to load scholarship.");
  if (!data) return null;

  const row = data as unknown as AdminScholarshipDetail & {
    eligibility_rules: AdminScholarshipDetail["eligibilityRules"];
    requirements: AdminScholarshipDetail["requirements"];
    deadline_cycles: AdminScholarshipDetail["deadlineCycles"];
  };

  return {
    ...row,
    eligibilityRules: row.eligibility_rules,
    requirements: row.requirements,
    deadlineCycles: row.deadline_cycles,
  };
}
