import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AdminProvider {
  id: string;
  name: string;
  type: "government" | "lgu" | "private" | "university";
  website: string | null;
}

export async function getProviders(): Promise<AdminProvider[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("providers").select("id, name, type, website").order("name");

  if (error) throw new Error("Failed to load providers.");
  return data ?? [];
}
