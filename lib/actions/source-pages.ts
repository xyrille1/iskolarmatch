"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/actions/log-audit";
import { sourceIndexPageInputSchema } from "@/lib/types/source-discovery";

// FR22 (docs/PRD.md §4.7): curator management of the discovery crawler's source
// registry. Same shape as every other admin write -- requireAdmin() gate,
// service-role client, Zod validation, audit-logged. The index_url allowlist is
// enforced both here (Zod refine, for a clear error) and by the DB trigger in
// migration ...014 (defense-in-depth), so an off-allowlist page can never be
// registered.

export async function addSourceIndexPage(payload: unknown): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = sourceIndexPageInputSchema.parse(payload);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("source_index_pages")
    .insert({
      provider_id: parsed.provider_id || null,
      index_url: parsed.index_url,
      label: parsed.label || null,
    })
    .select("id")
    .single();

  if (error) {
    // The unique(index_url) constraint gives a friendlier message than the raw
    // Postgres error when a curator re-adds an existing page.
    if (error.code === "23505") throw new Error("That index page is already registered.");
    throw new Error(`Failed to add source page: ${error.message}`);
  }

  await logAudit(userId, "create", "source_index_page", data.id, { index_url: parsed.index_url });
  revalidatePath("/admin/source-pages");
}

export async function setSourceIndexPageActive(id: string, isActive: boolean): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("source_index_pages").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error("Failed to update source page.");

  await logAudit(userId, isActive ? "activate" : "deactivate", "source_index_page", id);
  revalidatePath("/admin/source-pages");
}

export async function deleteSourceIndexPage(id: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("source_index_pages").delete().eq("id", id);
  if (error) throw new Error("Failed to delete source page.");

  await logAudit(userId, "delete", "source_index_page", id);
  revalidatePath("/admin/source-pages");
}

// --- FormData-facing wrappers for plain <form action={...}> submissions ---

export async function addSourceIndexPageFormAction(formData: FormData): Promise<void> {
  await addSourceIndexPage({
    provider_id: formData.get("provider_id")?.toString() || "",
    index_url: formData.get("index_url")?.toString(),
    label: formData.get("label")?.toString() || undefined,
  });
}

export async function setSourceIndexPageActiveFormAction(id: string, isActive: boolean): Promise<void> {
  await setSourceIndexPageActive(id, isActive);
}

export async function deleteSourceIndexPageFormAction(id: string): Promise<void> {
  await deleteSourceIndexPage(id);
}
