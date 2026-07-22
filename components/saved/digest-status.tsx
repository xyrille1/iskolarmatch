"use client";

import { useState, useTransition } from "react";
import { deleteSavedProfile, setDigestOptIn } from "@/lib/actions/saved-profile";
import type { SavedProfileStatus } from "@/lib/data/get-saved-profile-status";

// FR20 (docs/PRD.md §4.3): lets a user see/toggle/delete their opt-in digest
// profile without having to re-run /match. Only rendered when a saved
// profile actually exists (app/saved/page.tsx).
export function DigestStatus({ status }: { status: SavedProfileStatus }) {
  const [optIn, setOptIn] = useState(status.digestOptIn);
  const [deleted, setDeleted] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (deleted) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={optIn}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.checked;
            setOptIn(next);
            startTransition(() => setDigestOptIn(next));
          }}
          className="h-4 w-4"
        />
        Email me weekly when new scholarships match my saved profile
      </label>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await deleteSavedProfile();
          setDeleted(true);
        })}
        className="text-muted underline disabled:opacity-50"
      >
        Delete saved profile
      </button>
    </div>
  );
}
