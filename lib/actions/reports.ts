"use server";

import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { scholarshipReportInputSchema } from "@/lib/types/report";

export interface ReportFormState {
  status: "idle" | "error" | "success";
  formError?: string;
}

// FR13 (docs/PRD.md §4.1): the app's first anon-facing write path. Deliberately
// NOT a client-side Supabase insert against an RLS policy -- routed through
// the service-role client behind a rate limit, the same shape as
// submitProfileForm/requestMagicLink (docs/SECURITY.md §3.3). Treated as new
// attack surface, not a low-risk add: a tighter limit than the match form.
export async function submitScholarshipReport(
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  const forwardedFor = (await headers()).get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(`report:${forwardedFor}`, 5, 60_000);
  if (!allowed) {
    return { status: "error", formError: "Too many requests. Please wait a moment and try again." };
  }

  const parsed = scholarshipReportInputSchema.safeParse({
    scholarship_id: formData.get("scholarship_id")?.toString(),
    reason: formData.get("reason")?.toString(),
    detail: formData.get("detail")?.toString() || undefined,
    reporter_email: formData.get("reporter_email")?.toString() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", formError: "Please choose a reason for the report." };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("scholarship_reports").insert({
    scholarship_id: parsed.data.scholarship_id,
    reason: parsed.data.reason,
    detail: parsed.data.detail || null,
    reporter_email: parsed.data.reporter_email || null,
  });

  if (error) {
    return { status: "error", formError: "Failed to submit report. Please try again." };
  }

  return { status: "success" };
}
