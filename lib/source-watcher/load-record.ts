import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RecordSnapshot } from "./types";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

// Loads the live DB record for a scholarship as the snapshot the extraction is
// diffed against. Child rows carry their ids so the model can target an
// existing row rather than always proposing a new one.
export async function loadRecordSnapshot(
  supabase: AdminClient,
  scholarshipId: string
): Promise<RecordSnapshot | null> {
  const { data, error } = await supabase
    .from("scholarships")
    .select(
      `id, title, summary, description, coverage_type, benefit_summary, official_url, application_url,
       eligibility_rules ( id, field, operator, value, is_mandatory, human_label ),
       deadline_cycles ( id, academic_year, opens_at, closes_at, notes ),
       requirements ( id, label, is_mandatory, sort_order )`
    )
    .eq("id", scholarshipId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    title: string | null;
    summary: string | null;
    description: string | null;
    coverage_type: string | null;
    benefit_summary: string | null;
    official_url: string | null;
    application_url: string | null;
    eligibility_rules: RecordSnapshot["eligibilityRules"];
    deadline_cycles: RecordSnapshot["deadlineCycles"];
    requirements: RecordSnapshot["requirements"];
  };

  return {
    scholarshipId: row.id,
    scholarship: {
      title: row.title,
      summary: row.summary,
      description: row.description,
      coverage_type: row.coverage_type,
      benefit_summary: row.benefit_summary,
      official_url: row.official_url,
      application_url: row.application_url,
    },
    eligibilityRules: row.eligibility_rules ?? [],
    deadlineCycles: row.deadline_cycles ?? [],
    requirements: row.requirements ?? [],
  };
}
