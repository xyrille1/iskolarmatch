import { z } from "zod";

// FR13 (docs/PRD.md §4.1): mirrors the DB CHECK constraint on
// scholarship_reports.reason (supabase/migrations/20260101000008_scholarship_reports.sql).
export const REPORT_REASONS = ["stale_info", "broken_link", "wrong_deadline", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const reportReasonSchema = z.enum(REPORT_REASONS);

export const scholarshipReportInputSchema = z
  .object({
    scholarship_id: z.string().min(1),
    reason: reportReasonSchema,
    detail: z.string().max(1000).optional(),
    reporter_email: z.string().email().optional().or(z.literal("")),
  })
  .strict();

export type ScholarshipReportInput = z.infer<typeof scholarshipReportInputSchema>;
