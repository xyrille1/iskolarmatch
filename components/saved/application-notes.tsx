"use client";

import { saveApplicationNotesFormAction } from "@/lib/actions/application-tracker";

// FR21: private per-scholarship note. Plain form + submit so it works without
// JS; maxLength mirrors the 1000-char cap enforced server-side.
export function ApplicationNotes({
  scholarshipId,
  notes,
}: {
  scholarshipId: string;
  notes: string | null;
}) {
  return (
    <form
      action={saveApplicationNotesFormAction.bind(null, scholarshipId)}
      className="mt-4 flex flex-col gap-2"
    >
      <label htmlFor={`notes-${scholarshipId}`} className="text-sm text-muted">
        Notes
      </label>
      <textarea
        id={`notes-${scholarshipId}`}
        name="notes"
        defaultValue={notes ?? ""}
        rows={2}
        maxLength={1000}
        placeholder="e.g. still need to ask my teacher for the recommendation letter"
        className="rounded-md border border-line px-3 py-2 text-sm"
      />
      <div>
        <button type="submit" className="min-h-[44px] rounded-full border border-ink px-4 text-sm">
          Save note
        </button>
      </div>
    </form>
  );
}
