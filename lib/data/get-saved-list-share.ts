import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// FR19: RLS scopes this to the caller's own row (owner select policy on
// saved_list_shares, unique on user_id), so no explicit .eq() is needed.
export async function getMySavedListShareSlug(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("saved_list_shares").select("slug").maybeSingle();
  return data?.slug ?? null;
}
