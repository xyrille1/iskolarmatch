"use client";

import { setApplicationStatusFormAction } from "@/lib/actions/application-tracker";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types/application-tracker";
import { APPLICATION_STATUS_LABELS } from "@/lib/tracker/progress";

// FR21: per-scholarship application status as a tappable segmented control.
// One form with several submit buttons -- each carries its own `status` value,
// so it works WITHOUT JS (native submit) and, with JS, is an instant Server
// Action + revalidation. Active pill reflects server truth after the round-trip.
export function ApplicationStatusControl({
  scholarshipId,
  status,
}: {
  scholarshipId: string;
  status: ApplicationStatus;
}) {
  return (
    <form action={setApplicationStatusFormAction.bind(null, scholarshipId)}>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Application status
        </legend>
        <div className="flex flex-wrap gap-2">
          {APPLICATION_STATUSES.map((s) => {
            const active = s === status;
            return (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                aria-pressed={active}
                className={[
                  "min-h-[44px] rounded-full px-4 text-sm transition-colors",
                  active
                    ? "bg-ink text-paper"
                    : "border border-line text-ink hover:border-ink",
                ].join(" ")}
              >
                {APPLICATION_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </form>
  );
}
