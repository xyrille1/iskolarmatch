import "server-only";
import { createSupabaseClient } from "@/lib/supabase/client";
import { VERIFIED_STALENESS_DAYS } from "@/lib/trust/verified-eyebrow";

export interface TrustStats {
  totalPublished: number;
  verifiedWithinWindow: number;
  oldestVerifiedDays: number | null;
}

const EMPTY: TrustStats = { totalPublished: 0, verifiedWithinWindow: 0, oldestVerifiedDays: null };

// FR11 (docs/PRD.md §4.1): aggregate, read-only, public trust stats -- reads
// only last_verified_at on already-public rows (RLS: "anon read published
// scholarships"), no PII. Best-effort like getLandingHighlights: a Supabase
// hiccup degrades the numbers shown, never the page.
export async function getTrustStats(): Promise<TrustStats> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("scholarships")
      .select("last_verified_at")
      .eq("is_published", true);

    if (error || !data) return EMPTY;

    const now = Date.now();
    const ageInDays = (data as { last_verified_at: string | null }[])
      .map((row) =>
        row.last_verified_at ? Math.floor((now - new Date(row.last_verified_at).getTime()) / (1000 * 60 * 60 * 24)) : null
      )
      .filter((d): d is number => d !== null);

    return {
      totalPublished: data.length,
      verifiedWithinWindow: ageInDays.filter((d) => d <= VERIFIED_STALENESS_DAYS).length,
      oldestVerifiedDays: ageInDays.length > 0 ? Math.max(...ageInDays) : null,
    };
  } catch {
    return EMPTY;
  }
}
