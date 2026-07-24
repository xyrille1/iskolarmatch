import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";
import { isNearingOrPastStaleness } from "@/lib/trust/staleness";

export interface StalenessWorklistItem {
  id: string;
  title: string;
  providerName: string;
  lastVerifiedAt: string | null;
  daysSinceVerified: number | null;
}

interface StalenessRow {
  id: string;
  title: string;
  last_verified_at: string | null;
  providers: { name: string } | null;
}

// FR12 (docs/PRD.md §4.1): admin-only worklist of published scholarships
// nearing/past the verified-staleness threshold, most urgent first. Pure
// read query -- no new table, reuses scholarships.last_verified_at. `_admin`
// is required (never read) so "only ever called after requireAdmin() gates
// the caller" lives in the type system (docs/QA-CHECKLIST.md P2-04).
export async function getStalenessWorklist(_admin: AdminContext): Promise<StalenessWorklistItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scholarships")
    .select("id, title, last_verified_at, providers ( name )")
    .eq("is_published", true)
    .order("last_verified_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error("Failed to load staleness worklist.");

  const now = Date.now();

  return ((data ?? []) as unknown as StalenessRow[])
    .map((row) => {
      const daysSinceVerified = row.last_verified_at
        ? Math.floor((now - new Date(row.last_verified_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: row.id,
        title: row.title,
        providerName: row.providers?.name ?? "Unknown provider",
        lastVerifiedAt: row.last_verified_at,
        daysSinceVerified,
      };
    })
    .filter((item) => isNearingOrPastStaleness(item.daysSinceVerified));
}
