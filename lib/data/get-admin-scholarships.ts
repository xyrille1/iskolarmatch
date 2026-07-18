import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AdminScholarshipListItem {
  id: string;
  slug: string;
  title: string;
  providerName: string;
  isPublished: boolean;
  lastVerifiedAt: string | null;
}

// Admin dashboard needs to see unpublished/draft rows too, so this reads via
// the service-role client -- only ever called after requireAdmin() gates the
// caller.
export async function getAdminScholarships(): Promise<AdminScholarshipListItem[]> {
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
