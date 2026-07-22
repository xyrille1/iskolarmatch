import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Lightweight pending-suggestion counts for curator discoverability (FR10).
// Head-only count queries (no rows transferred). Called only after
// requireAdmin() gates the caller.

export async function getPendingSuggestionCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("scholarship_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export async function getPendingSuggestionCountForScholarship(scholarshipId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("scholarship_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("scholarship_id", scholarshipId);
  return count ?? 0;
}
