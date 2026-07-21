"use client";

import { useState } from "react";

export interface RequirementItem {
  id: string;
  label: string;
  isMandatory: boolean;
}

// Ephemeral for anonymous visitors (resets on reload) -- persisted per-user
// once signed in is a P3 concern, per docs/iskolar-ux-design.md §4.4 (DECIDE 4d).
export function RequirementChecklist({ requirements }: { requirements: RequirementItem[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
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
  );
}
