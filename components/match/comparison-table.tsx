"use client";

import { StatusDot } from "@/components/ui/status-dot";
import type { ScholarshipMatch } from "@/lib/actions/match-profile";

// FR16 (docs/PRD.md §4.2): purely client-side, derived from already-selected
// match results -- no new DB reads. Renders once 2-3 scholarships (from any
// bucket) are picked for comparison.
export function ComparisonTable({
  matches,
  onRemove,
}: {
  matches: ScholarshipMatch[];
  onRemove: (id: string) => void;
}) {
  return (
    <section className="my-8 overflow-x-auto border border-line">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="p-3 text-xs font-medium uppercase tracking-[0.12em] text-muted">Compare</th>
            {matches.map((m) => (
              <th key={m.scholarshipId} className="p-3 align-top">
                <p className="font-serif text-lg font-light leading-tight">{m.title}</p>
                <p className="text-xs text-muted">{m.providerName}</p>
                <button onClick={() => onRemove(m.scholarshipId)} className="mt-1 text-xs text-muted underline">
                  Remove
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <th className="p-3 text-left font-normal text-muted">Coverage</th>
            {matches.map((m) => (
              <td key={m.scholarshipId} className="p-3">
                {m.coverageType}
              </td>
            ))}
          </tr>
          <tr className="border-b border-line">
            <th className="p-3 text-left font-normal text-muted">Deadline</th>
            {matches.map((m) => (
              <td key={m.scholarshipId} className="p-3">
                <StatusDot status={m.status} closesAt={m.closesAt} opensAt={m.opensAt} />
              </td>
            ))}
          </tr>
          <tr className="border-b border-line">
            <th className="p-3 text-left font-normal text-muted">Requirements</th>
            {matches.map((m) => (
              <td key={m.scholarshipId} className="p-3">
                {m.requirementCount}
              </td>
            ))}
          </tr>
          <tr>
            <th className="p-3 align-top text-left font-normal text-muted">Mandatory rules</th>
            {matches.map((m) => (
              <td key={m.scholarshipId} className="p-3 align-top">
                <ul className="flex flex-col gap-1">
                  {m.whyChips.map((c) => (
                    <li key={c} className="text-status-open">
                      ✓ {c}
                    </li>
                  ))}
                  {m.failedChips.map((c) => (
                    <li key={c} className="text-muted">
                      ✕ {c}
                    </li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
