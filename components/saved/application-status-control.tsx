"use client";

import { setApplicationStatusFormAction } from "@/lib/actions/application-tracker";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types/application-tracker";
import { APPLICATION_STATUS_LABELS } from "@/lib/tracker/progress";

// FR21: per-scholarship application status. A plain form + submit button so it
// degrades without JS, mirroring the reminder <select> in saved-item.tsx.
export function ApplicationStatusControl({
  scholarshipId,
  status,
}: {
  scholarshipId: string;
  status: ApplicationStatus;
}) {
  return (
    <form action={setApplicationStatusFormAction.bind(null, scholarshipId)} className="flex items-center gap-3">
      <label htmlFor={`status-${scholarshipId}`} className="text-sm text-muted">
        Status
      </label>
      <select
        id={`status-${scholarshipId}`}
        name="status"
        defaultValue={status}
        className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {APPLICATION_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-[44px] rounded-full border border-ink px-4 text-sm">
        Save
      </button>
    </form>
  );
}
