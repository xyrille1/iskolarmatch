import type { Metadata } from "next";
import { MatchExperience } from "@/components/match/match-experience";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Find your scholarships — IskolarMatch",
};

// FR20 (docs/PRD.md §4.3): reads the auth cookie to decide whether to offer
// the opt-in "save this profile for a digest" control on results -- the one
// thing that makes this page auth-aware rather than purely static
// (docs/ARCHITECTURE.md §3 notes this trade-off).
export const dynamic = "force-dynamic";

export default async function MatchPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <MatchExperience isSignedIn={Boolean(user)} />
      </main>
      <SiteFooter />
    </>
  );
}
