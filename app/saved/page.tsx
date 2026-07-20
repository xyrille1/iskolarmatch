import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSavedScholarships } from "@/lib/data/get-saved-scholarships";
import { SavedItem } from "@/components/saved/saved-item";
import { PillLink } from "@/components/ui/pill";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "Saved — IskolarMatch" };
// Per-user, session-dependent -- never statically prerenderable.
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/saved");
  }

  const items = await getSavedScholarships();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="reveal font-serif text-4xl font-light leading-tight sm:text-5xl">Saved.</h1>

          {items.length === 0 ? (
            <div className="mt-8 border border-line p-8">
              <p className="max-w-[46ch] text-muted">
                Nothing saved yet. Find scholarships you qualify for and save the ones you want to track.
              </p>
              <PillLink href="/match" variant="outline" className="mt-6">
                Find my scholarships →
              </PillLink>
            </div>
          ) : (
            <ul className="mt-8">
              {items.map((item) => (
                <SavedItem key={item.scholarshipId} item={item} />
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
