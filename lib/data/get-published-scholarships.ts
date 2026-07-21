import "server-only";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { CoverageType } from "@/lib/types/matching";
import type { DeadlineStatus } from "@/lib/deadline/format-status";

export interface BrowseScholarshipItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  providerName: string;
  providerType: string;
  coverageType: CoverageType;
  status: DeadlineStatus;
  closesAt: string;
  opensAt: string | null;
  // Empty means open to every region -- no region eligibility_rule exists.
  regions: string[];
}

interface BrowseRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverage_type: CoverageType | null;
  providers: { name: string; type: string } | null;
  deadline_cycles: { closes_at: string; opens_at: string | null; status: DeadlineStatus }[];
  eligibility_rules: { field: string; value: unknown }[];
}

function regionsFromValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  return [];
}

// FR17 (docs/PRD.md §4.2): browse/filter mode independent of the profile
// form. Fetches every published row -- same "fetch all, process in JS"
// approach matchProfile takes, reasonable at this MVP's 10-20 record scale
// -- and derives a simplified region signal from eligibility_rules. This is
// NOT the authoritative matching engine (lib/matching/); it's a lighter
// display-filtering heuristic for exploring without a profile.
export async function getPublishedScholarships(): Promise<BrowseScholarshipItem[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("scholarships")
    .select(
      `id, slug, title, summary, coverage_type,
       providers ( name, type ),
       deadline_cycles ( closes_at, opens_at, status ),
       eligibility_rules ( field, value )`
    )
    .eq("is_published", true);

  if (error) throw new Error("Failed to load scholarships.");

  return ((data ?? []) as unknown as BrowseRow[])
    .map((row) => {
      const cycle = [...row.deadline_cycles].sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at))[0];
      if (!cycle) return null;

      const regions = row.eligibility_rules
        .filter((r) => r.field === "region")
        .flatMap((r) => regionsFromValue(r.value));

      const item: BrowseScholarshipItem = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        providerName: row.providers?.name ?? "Unknown provider",
        providerType: row.providers?.type ?? "other",
        coverageType: row.coverage_type ?? "other",
        status: cycle.status,
        closesAt: cycle.closes_at,
        opensAt: cycle.opens_at,
        regions,
      };
      return item;
    })
    .filter((item): item is BrowseScholarshipItem => item !== null);
}
