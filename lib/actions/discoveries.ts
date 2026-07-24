"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/actions/log-audit";
import { upsertScholarship } from "@/lib/actions/admin";

// FR22 (docs/PRD.md §4.7): curator review of discovered candidates. Nothing here
// auto-publishes. A candidate becomes real data ONLY when a curator promotes it,
// and promotion routes the reviewed fields through the SAME validated
// upsertScholarship action a curator uses by hand -- so nothing bypasses Zod
// validation, the URL allowlist, or the publish guard. The promoted scholarship
// is created as a DRAFT (is_published = false): the curator then adds eligibility
// rules, requirements, and a deadline on the edit page before publishing.
// Identical in spirit to the FR10 suggestion-approval gate (lib/actions/
// suggestions.ts).

// Promote a candidate into a new draft scholarship. Reads the curator-reviewed
// fields from the form, not the raw extraction -- the human is the author of
// record. Redirects to the full edit page to finish the record.
export async function promoteCandidateFormAction(candidateId: string, formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: candidate, error } = await supabase
    .from("scholarship_candidates")
    .select("id, status")
    .eq("id", candidateId)
    .single();
  if (error || !candidate) throw new Error("Candidate not found.");
  if (candidate.status !== "pending") throw new Error("This candidate has already been reviewed.");

  // Created as a DRAFT: is_published false + no verification date. The publish
  // guard therefore passes, and nothing goes live until the curator publishes
  // from the edit page after adding rules/requirements/deadline.
  const result = await upsertScholarship({
    provider_id: formData.get("provider_id")?.toString(),
    title: formData.get("title")?.toString(),
    slug: formData.get("slug")?.toString(),
    summary: formData.get("summary")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    coverage_type: formData.get("coverage_type")?.toString(),
    benefit_summary: formData.get("benefit_summary")?.toString() || undefined,
    official_url: formData.get("official_url")?.toString(),
    application_url: formData.get("application_url")?.toString() || undefined,
    is_published: false,
    last_verified_at: null,
  });

  const { error: statusError } = await supabase
    .from("scholarship_candidates")
    .update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      promoted_scholarship_id: result.id,
    })
    .eq("id", candidateId)
    .eq("status", "pending");
  if (statusError) throw new Error("Created the scholarship but failed to close the candidate; please check the queue.");

  await logAudit(userId, "promote_candidate", "scholarship_candidate", candidateId, { scholarship_id: result.id });
  revalidatePath("/admin/discoveries");
  redirect(`/admin/scholarships/${result.id}/edit`);
}

export async function rejectCandidate(candidateId: string, reason?: string): Promise<void> {
  const { userId } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // Pure bookkeeping on our own queue table -- zero writes to real content, so
  // "nothing auto-publishes" holds on the reject path too.
  const { error } = await supabase
    .from("scholarship_candidates")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason?.trim() || null,
    })
    .eq("id", candidateId)
    .eq("status", "pending");
  if (error) throw new Error("Failed to reject candidate.");

  await logAudit(userId, "reject_candidate", "scholarship_candidate", candidateId);
  revalidatePath("/admin/discoveries");
}

export async function rejectCandidateFormAction(candidateId: string, formData: FormData): Promise<void> {
  await rejectCandidate(candidateId, formData.get("reason")?.toString());
}
