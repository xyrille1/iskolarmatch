import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminContext {
  userId: string;
  // Branded so an AdminContext can only originate from requireAdmin() --
  // service-role data getters require one as their first parameter, making
  // the "only ever called after requireAdmin() gates the caller" guarantee
  // live in the type system rather than a comment (docs/QA-CHECKLIST.md
  // P2-04). Not unforgeable (an explicit `as AdminContext` cast still
  // bypasses it), but that's a deliberate, greppable red flag instead of an
  // accidental duck-typed object slipping through.
  readonly __brand: "AdminContext";
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

  // Two intentional layers of the same check (defense-in-depth): the explicit
  // .eq("user_id", user.id) is belt-and-suspenders on top of the RLS policy
  // USING (user_id = auth.uid()). RLS stays the primary control, but the filter
  // means an RLS regression -- or a refactor to a service-role client that
  // bypasses RLS entirely -- can't silently let any admin row satisfy the gate.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    redirect("/");
  }

  return { userId: user.id, __brand: "AdminContext" };
}
