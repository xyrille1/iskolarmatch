import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CoverageType } from "@/lib/types/matching";
import type { DeadlineStatus } from "@/lib/deadline/format-status";

export interface SavedScholarshipItem {
  scholarshipId: string;
  slug: string;
  title: string;
  providerName: string;
  coverageType: CoverageType;
  status: DeadlineStatus;
  closesAt: string | null;
  opensAt: string | null;
  reminder: { leadDays: number; remindOn: string } | null;
}

interface SavedRow {
  scholarship_id: string;
  scholarships: {
    slug: string;
    title: string;
    coverage_type: CoverageType | null;
    providers: { name: string } | null;
    deadline_cycles: { closes_at: string; opens_at: string | null; status: DeadlineStatus }[];
  } | null;
}

// Owner-only via RLS (user_id = auth.uid()) -- this function relies entirely
// on that policy for isolation, it never filters by user_id itself.
export async function getSavedScholarships(): Promise<SavedScholarshipItem[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: savedRows, error } = await supabase
    .from("saved_scholarships")
    .select(
      `scholarship_id,
       scholarships ( slug, title, coverage_type,
         providers ( name ),
         deadline_cycles ( closes_at, opens_at, status ) )`
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to load saved scholarships.");

  const { data: reminderRows } = await supabase
    .from("reminders")
    .select("scholarship_id, lead_days, remind_on");

  const reminderByScholarship = new Map(
    (reminderRows ?? []).map((r) => [r.scholarship_id, { leadDays: r.lead_days, remindOn: r.remind_on }])
  );

  return ((savedRows ?? []) as unknown as SavedRow[])
    .filter((row) => row.scholarships !== null)
    .map((row) => {
      const s = row.scholarships!;
      const cycle = [...s.deadline_cycles].sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at))[0];

      return {
        scholarshipId: row.scholarship_id,
        slug: s.slug,
        title: s.title,
        providerName: s.providers?.name ?? "Unknown provider",
        coverageType: s.coverage_type ?? "other",
        status: cycle?.status ?? "closed",
        closesAt: cycle?.closes_at ?? null,
        opensAt: cycle?.opens_at ?? null,
        reminder: reminderByScholarship.get(row.scholarship_id) ?? null,
      };
    });
}
