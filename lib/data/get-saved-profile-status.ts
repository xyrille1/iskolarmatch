import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SavedProfileStatus {
  hasSavedProfile: boolean;
  digestOptIn: boolean;
  lastDigestSentAt: string | null;
}

const NONE: SavedProfileStatus = { hasSavedProfile: false, digestOptIn: false, lastDigestSentAt: null };

// FR20: RLS scopes this to the caller's own row (owner select policy on
// saved_profiles, unique on user_id).
export async function getSavedProfileStatus(): Promise<SavedProfileStatus> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("saved_profiles").select("digest_opt_in, last_digest_sent_at").maybeSingle();

  if (!data) return NONE;

  return {
    hasSavedProfile: true,
    digestOptIn: data.digest_opt_in,
    lastDigestSentAt: data.last_digest_sent_at,
  };
}
