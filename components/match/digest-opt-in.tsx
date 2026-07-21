"use client";

import { useState, useTransition } from "react";
import { PillButton } from "@/components/ui/pill";
import { saveProfileForDigest } from "@/lib/actions/saved-profile";
import type { Profile } from "@/lib/types/profile";

// FR20 (docs/PRD.md §4.3): explicit, signed-in-only opt-in -- persists the
// just-submitted profile ONLY when the student clicks this. Never automatic,
// the sole exception to the app's zero-persisted-profile posture.
export function DigestOptIn({ profile }: { profile: Profile }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (saved) {
    return (
      <p className="text-sm text-muted">
        Saved -- we&apos;ll email you when new scholarships match this profile. Manage this anytime on your{" "}
        <a href="/saved" className="underline">
          saved page
        </a>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <PillButton
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await saveProfileForDigest(profile);
              setSaved(true);
            } catch {
              setError("Failed to save. Please try again.");
            }
          })
        }
      >
        {isPending ? "Saving…" : "Email me when new scholarships match this profile"}
      </PillButton>
      {error && (
        <p role="alert" className="text-sm text-status-soon">
          {error}
        </p>
      )}
    </div>
  );
}
