import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";

// Lightweight pending-suggestion counts for curator discoverability (FR10).
// Head-only count queries (no rows transferred). `_admin` is required (never
// read) so "called only after requireAdmin() gates the caller" lives in the
// type system, not just a comment (docs/QA-CHECKLIST.md P2-04).

export async function getPendingSuggestionCount(_admin: AdminContext): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("scholarship_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export async function getPendingSuggestionCountForScholarship(
  _admin: AdminContext,
  scholarshipId: string
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("scholarship_suggestions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("scholarship_id", scholarshipId);
  return count ?? 0;
}
