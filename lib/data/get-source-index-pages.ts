import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// FR22 (docs/PRD.md §4.7): the curator-managed registry of official index pages
// the discovery crawler reads. Admin-only; service-role client, called only
// after requireAdmin() gates the caller.

export interface SourceIndexPageItem {
  id: string;
  indexUrl: string;
  label: string | null;
  isActive: boolean;
  providerName: string | null;
  lastCrawledAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  index_url: string;
  label: string | null;
  is_active: boolean;
  last_crawled_at: string | null;
  last_error: string | null;
  created_at: string;
  providers: { name: string } | null;
}

export async function getSourceIndexPages(): Promise<SourceIndexPageItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("source_index_pages")
    .select("id, index_url, label, is_active, last_crawled_at, last_error, created_at, providers ( name )")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to load source index pages.");

  const rows = (data ?? []) as unknown as Row[];
  return rows.map((row) => ({
    id: row.id,
    indexUrl: row.index_url,
    label: row.label,
    isActive: row.is_active,
    providerName: row.providers?.name ?? null,
    lastCrawledAt: row.last_crawled_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}
