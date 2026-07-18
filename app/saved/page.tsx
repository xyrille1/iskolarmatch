import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSavedScholarships } from "@/lib/data/get-saved-scholarships";
import { SavedItem } from "@/components/saved/saved-item";

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
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-serif text-4xl font-light leading-tight sm:text-5xl">Saved.</h1>

      {items.length === 0 ? (
        <p className="mt-8 text-muted">
          Nothing saved yet. Find scholarships you qualify for and save the ones you want to track.
        </p>
      ) : (
        <ul className="mt-8">
          {items.map((item) => (
            <SavedItem key={item.scholarshipId} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
