"use client";

import { useFormStatus } from "react-dom";
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
      className="mt-6 flex flex-col gap-2"
    >
      <label
        htmlFor={`notes-${scholarshipId}`}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted"
      >
        Your notes
      </label>
      <textarea
        id={`notes-${scholarshipId}`}
        name="notes"
        defaultValue={notes ?? ""}
        rows={2}
        maxLength={1000}
        placeholder="e.g. still need to ask my teacher for the recommendation letter"
        className="rounded-md border border-line px-3 py-2 text-sm focus:border-ink"
      />
      <div>
        <NotesSubmit hasNote={Boolean(notes)} />
      </div>
    </form>
  );
}

function NotesSubmit({ hasNote }: { hasNote: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] rounded-full border border-ink px-4 text-sm disabled:opacity-50"
    >
      {pending ? "Saving…" : hasNote ? "Update note" : "Save note"}
    </button>
  );
}
