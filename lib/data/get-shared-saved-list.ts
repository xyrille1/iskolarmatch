import "server-only";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { DeadlineStatus } from "@/lib/deadline/format-status";

export interface SharedSavedListItem {
  slug: string;
  title: string;
  providerName: string;
  status: DeadlineStatus;
  closesAt: string;
  opensAt: string | null;
}

interface SharedRow {
  scholarship_slug: string;
  title: string;
  provider_name: string | null;
  closes_at: string;
  opens_at: string | null;
  status: DeadlineStatus;
}

// FR19 (docs/PRD.md §4.3): reads exclusively through get_shared_saved_list(),
// a SECURITY DEFINER RPC that returns scholarship-facing fields only, never
// user_id/email (supabase/migrations/20260101000010_saved_list_shares.sql).
// Returns null both when the slug doesn't resolve to a share AND when a
// valid share currently has nothing saved -- both render as "not found",
// which the page copy deliberately hedges rather than the code disambiguating.
export async function getSharedSavedList(shareSlug: string): Promise<SharedSavedListItem[] | null> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("get_shared_saved_list", { share_slug: shareSlug });
  if (error || !data || data.length === 0) return null;

  return (data as SharedRow[]).map((row) => ({
    slug: row.scholarship_slug,
    title: row.title,
    providerName: row.provider_name ?? "Unknown provider",
    status: row.status,
    closesAt: row.closes_at,
    opensAt: row.opens_at,
  }));
}
