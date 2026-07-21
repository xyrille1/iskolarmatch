import "server-only";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { DeadlineStatus } from "@/lib/deadline/format-status";

export interface FeaturedScholarship {
  slug: string;
  title: string;
  providerName: string;
  status: DeadlineStatus;
  closesAt: string;
  opensAt: string | null;
}

export interface LandingHighlights {
  featured: FeaturedScholarship[];
  verifiedCount: number | null;
}

interface FeaturedRow {
  slug: string;
  title: string;
  providers: { name: string } | null;
  deadline_cycles: { closes_at: string; opens_at: string | null; status: DeadlineStatus }[];
}

const EMPTY: LandingHighlights = { featured: [], verifiedCount: null };

// Landing is otherwise static (docs/ARCHITECTURE.md), so this is the one
// live read on the page -- kept isolated, best-effort, and never throwing:
// a Supabase hiccup should degrade the gallery/stat tile, not the page.
export async function getLandingHighlights(): Promise<LandingHighlights> {
  try {
    const supabase = createSupabaseClient();

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from("scholarships")
        .select("slug, title, providers ( name ), deadline_cycles ( closes_at, opens_at, status )")
        .eq("is_published", true)
        .order("last_verified_at", { ascending: false })
        .limit(3),
      supabase.from("scholarships").select("id", { count: "exact", head: true }).eq("is_published", true),
    ]);

    if (error || !data) return EMPTY;

    const featured = (data as unknown as FeaturedRow[])
      .map((row) => {
        const primaryCycle = [...row.deadline_cycles].sort(
          (a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at)
        )[0];
        if (!primaryCycle) return null;
        return {
          slug: row.slug,
          title: row.title,
          providerName: row.providers?.name ?? "Unknown provider",
          status: primaryCycle.status,
          closesAt: primaryCycle.closes_at,
          opensAt: primaryCycle.opens_at,
        };
      })
      .filter((item): item is FeaturedScholarship => item !== null);

    return { featured, verifiedCount: countError ? null : count };
  } catch {
    return EMPTY;
  }
}
