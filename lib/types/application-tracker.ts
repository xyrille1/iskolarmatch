import { z } from "zod";

// FR21 (docs/PRD.md §4.6): application progress tracker. Mirrors the DB CHECK
// constraint on application_progress.status
// (supabase/migrations/20260101000013_application_tracker.sql).
export const APPLICATION_STATUSES = ["interested", "preparing", "applied", "submitted"] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);

// Notes are the user's own private free text. Capped to mirror the report
// detail cap; React escapes on render so no extra sanitization is needed.
export const applicationNotesSchema = z.string().trim().max(1000);

export const scholarshipIdSchema = z.string().uuid();
export const requirementIdSchema = z.string().uuid();
