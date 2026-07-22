import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/auth/require-admin";
import type { ReportReason } from "@/lib/types/report";

export interface ScholarshipReportItem {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  reason: ReportReason;
  detail: string | null;
  reporterEmail: string | null;
  createdAt: string;
}

interface ReportRow {
  id: string;
  scholarship_id: string;
  reason: ReportReason;
  detail: string | null;
  reporter_email: string | null;
  created_at: string;
  scholarships: { title: string } | null;
}

// FR13 (docs/PRD.md §4.1): admin-only unresolved moderation queue, oldest
// first. `_admin` is required (never read) so "only ever called after
// requireAdmin() gates the caller" lives in the type system, not just a
// comment (docs/QA-CHECKLIST.md P2-04).
export async function getUnresolvedScholarshipReports(_admin: AdminContext): Promise<ScholarshipReportItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scholarship_reports")
    .select("id, scholarship_id, reason, detail, reporter_email, created_at, scholarships ( title )")
    .eq("resolved", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error("Failed to load scholarship reports.");

  return ((data ?? []) as unknown as ReportRow[]).map((row) => ({
    id: row.id,
    scholarshipId: row.scholarship_id,
    scholarshipTitle: row.scholarships?.title ?? "Unknown scholarship",
    reason: row.reason,
    detail: row.detail,
    reporterEmail: row.reporter_email,
    createdAt: row.created_at,
  }));
}
