import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";

export interface AdminProvider {
  id: string;
  name: string;
  type: "government" | "lgu" | "private" | "university";
  website: string | null;
}

// `_admin` is required (never read) so "only ever called after requireAdmin()
// gates the caller" lives in the type system, not just a comment
// (docs/QA-CHECKLIST.md P2-04).
export async function getProviders(_admin: AdminContext): Promise<AdminProvider[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("providers").select("id, name, type, website").order("name");

  if (error) throw new Error("Failed to load providers.");
  return data ?? [];
}
