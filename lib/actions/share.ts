"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function generateShareSlug(): string {
  // 9 random bytes -> 12 base64url chars -- unguessable, URL-safe.
  return randomBytes(9).toString("base64url");
}

// FR19 (docs/PRD.md §4.3): creates (or replaces) the caller's single active
// share link -- regenerating invalidates the previous slug. Owner-scoped
// via the session, never a caller-supplied user id (docs/SECURITY.md §3.4),
// same convention as saveScholarship/setReminder.
export async function createSavedListShare(): Promise<{ slug: string }> {
  const { supabase, userId } = await requireUserId();
  const slug = generateShareSlug();

  const { error } = await supabase.from("saved_list_shares").upsert({ user_id: userId, slug }, { onConflict: "user_id" });

  if (error) throw new Error("Failed to create share link.");

  revalidatePath("/saved");
  return { slug };
}

export async function revokeSavedListShare(): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("saved_list_shares").delete().eq("user_id", userId);
  if (error) throw new Error("Failed to revoke share link.");

  revalidatePath("/saved");
}
