"use client";

import { useTransition } from "react";
import { PillButton } from "@/components/ui/pill";
import { cancelReminder, saveScholarship, setReminderFormAction, unsaveScholarship } from "@/lib/actions/saved";

const LEAD_DAY_OPTIONS = [3, 7, 14, 30];

export function SaveReminderControls({
  scholarshipId,
  isSaved,
  reminder,
}: {
  scholarshipId: string;
  isSaved: boolean;
  reminder: { leadDays: number } | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <PillButton
        variant={isSaved ? "solid" : "outline"}
        disabled={isPending}
        onClick={() =>
          startTransition(() => (isSaved ? unsaveScholarship(scholarshipId) : saveScholarship(scholarshipId)))
        }
      >
        {isSaved ? "Saved ✓" : "Save"}
      </PillButton>

      <form action={setReminderFormAction.bind(null, scholarshipId)} className="flex items-center gap-2">
        <select
          name="lead_days"
          defaultValue={reminder?.leadDays ?? 7}
          aria-label="Remind me before deadline"
          className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
        >
          {LEAD_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} days before
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-[44px] rounded-full border border-ink px-4 text-sm">
          {reminder ? "Update reminder" : "Set reminder"}
        </button>
      </form>

      {reminder && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => cancelReminder(scholarshipId))}
          className="text-sm text-muted underline disabled:opacity-50"
        >
          Cancel reminder
        </button>
      )}
    </div>
  );
}
