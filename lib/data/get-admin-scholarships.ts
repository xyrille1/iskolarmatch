import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";

export interface AdminScholarshipListItem {
  id: string;
  slug: string;
  title: string;
  providerName: string;
  isPublished: boolean;
  lastVerifiedAt: string | null;
}

// Admin dashboard needs to see unpublished/draft rows too, so this reads via
// the service-role client. `_admin` is required (never read) so the "only
// ever called after requireAdmin() gates the caller" guarantee lives in the
// type system, not just a comment (docs/QA-CHECKLIST.md P2-04).
export async function getAdminScholarships(_admin: AdminContext): Promise<AdminScholarshipListItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scholarships")
    .select("id, slug, title, is_published, last_verified_at, providers ( name )")
    .order("title", { ascending: true });

  if (error) throw new Error("Failed to load scholarships.");

  return ((data ?? []) as unknown as {
    id: string;
    slug: string;
    title: string;
    is_published: boolean;
    last_verified_at: string | null;
    providers: { name: string } | null;
  }[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    providerName: row.providers?.name ?? "Unknown provider",
    isPublished: row.is_published,
    lastVerifiedAt: row.last_verified_at,
  }));
}
