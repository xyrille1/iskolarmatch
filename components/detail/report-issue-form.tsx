"use client";

import { useActionState, useState } from "react";
import { PillButton } from "@/components/ui/pill";
import { submitScholarshipReport, type ReportFormState } from "@/lib/actions/reports";
import { REPORT_REASONS, type ReportReason } from "@/lib/types/report";

const initialState: ReportFormState = { status: "idle" };

const REASON_LABELS: Record<ReportReason, string> = {
  stale_info: "Information looks outdated",
  broken_link: "Official/apply link is broken",
  wrong_deadline: "Deadline looks wrong",
  other: "Something else",
};

// FR13 (docs/PRD.md §4.1): a moderated trust signal, not public UGC --
// submits into the curator review queue via a rate-limited Server Action
// (lib/actions/reports.ts). Collapsed by default so it stays a secondary
// action, not competing with Save/Set reminder.
export function ReportIssueForm({ scholarshipId }: { scholarshipId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitScholarshipReport, initialState);

  if (state.status === "success") {
    return <p className="text-sm text-muted">Thanks -- a curator will review this.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-muted underline">
        Report an issue with this listing
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border border-line p-4 text-sm">
      <input type="hidden" name="scholarship_id" value={scholarshipId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="reason" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          What&apos;s wrong?
        </label>
        <select id="reason" name="reason" required className="min-h-[44px] rounded-md border border-line px-3 py-2">
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="detail" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Details (optional)
        </label>
        <textarea id="detail" name="detail" rows={3} className="rounded-md border border-line px-3 py-2" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="reporter_email" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Your email (optional, in case we need to follow up)
        </label>
        <input
          id="reporter_email"
          name="reporter_email"
          type="email"
          className="min-h-[44px] rounded-md border border-line px-3 py-2"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-status-soon">
          {state.formError}
        </p>
      )}

      <div className="flex items-center gap-4">
        <PillButton type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Sending…" : "Submit report"}
        </PillButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
