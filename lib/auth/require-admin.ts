import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminContext {
  userId: string;
}

// Role check happens server-side against a trusted source (admin_users),
// never a client-supplied claim (docs/SECURITY.md §3.4).
// Granting admin access is a manual, service-role-only operation (no
// self-service signup path) -- intentional for a solo-curator MVP.
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin");
  }

  const { data: adminRow } = await supabase.from("admin_users").select("user_id").maybeSingle();

  if (!adminRow) {
    redirect("/");
  }

  return { userId: user.id };
}
