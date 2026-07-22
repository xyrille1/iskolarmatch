"use client";

import { useState, useTransition } from "react";
import { toggleRequirementCheckoff } from "@/lib/actions/application-tracker";

export interface RequirementItem {
  id: string;
  label: string;
  isMandatory: boolean;
}

// FR21: for signed-in users the checklist persists to requirement_checkoffs
// (seeded from `initialChecked`, each toggle written through in a transition).
// For anonymous visitors it stays purely ephemeral -- no login wall, no error,
// resets on reload -- preserving the anonymous-first posture
// (docs/iskolar-ux-design.md §4.4 DECIDE 4d).
export function RequirementChecklist({
  requirements,
  initialChecked = [],
  isSignedIn = false,
}: {
  requirements: RequirementItem[];
  initialChecked?: string[];
  isSignedIn?: boolean;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const willCheck = !checked.has(id);

    // Optimistic local update.
    setChecked((prev) => {
      const next = new Set(prev);
      if (willCheck) next.add(id);
      else next.delete(id);
      return next;
    });

    if (!isSignedIn) return;

    // Persist; revert local state if the write fails.
    startTransition(async () => {
      try {
        await toggleRequirementCheckoff(id, willCheck);
      } catch {
        setChecked((prev) => {
          const next = new Set(prev);
          if (willCheck) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    });
  }

  return (
    <>
      {isSignedIn && (
        <p className="mb-4 text-sm text-muted" aria-live="polite">
          {checked.size === requirements.length && requirements.length > 0
            ? "All requirements checked ✓"
            : `${checked.size} of ${requirements.length} checked`}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {requirements.map((req) => (
          <li key={req.id}>
            <label className="flex min-h-[44px] items-start gap-3">
              <input
                type="checkbox"
                checked={checked.has(req.id)}
                onChange={() => toggle(req.id)}
                className="mt-1 h-5 w-5"
              />
              <span>
                {req.label}
                {!req.isMandatory && <span className="ml-2 text-sm text-muted">(optional)</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
