"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema, type Profile } from "@/lib/types/profile";

async function requireUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be signed in.");
  }

  return { supabase, userId: user.id };
}

// FR20 (docs/PRD.md §4.3): explicit opt-in only -- called from a checked-in
// action on the results screen (signed-in users only), never automatically.
// Re-validates with the same profileSchema the anonymous match path uses
// (lib/types/profile.ts), so a saved profile can never contain a field the
// matching engine wouldn't also accept.
export async function saveProfileForDigest(profile: Profile): Promise<void> {
  const { supabase, userId } = await requireUserId();
  const parsed = profileSchema.parse(profile);

  const { error } = await supabase.from("saved_profiles").upsert(
    {
      user_id: userId,
      profile: parsed,
      digest_opt_in: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error("Failed to save profile for digest.");

  revalidatePath("/saved");
  revalidatePath("/match");
}

export async function setDigestOptIn(optIn: boolean): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("saved_profiles")
    .update({ digest_opt_in: optIn, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update digest preference.");

  revalidatePath("/saved");
}

// Full delete, not just opt-out -- erases the persisted profile entirely
// (right-to-erasure-friendly, RA 10173).
export async function deleteSavedProfile(): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("saved_profiles").delete().eq("user_id", userId);
  if (error) throw new Error("Failed to delete saved profile.");

  revalidatePath("/saved");
}
