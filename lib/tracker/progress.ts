import type { ApplicationStatus } from "@/lib/types/application-tracker";

// FR21: pure derivation of a scholarship's requirement-checklist progress from
// the set of the current user's checked requirement ids. Extracted from the
// data getter so it is unit-testable without a DB (mirrors how the matching
// helpers keep their pure logic separate from Supabase reads).
export function countRequirementProgress(
  requirementIds: string[],
  checkedIds: ReadonlySet<string>
): { total: number; done: number } {
  const total = requirementIds.length;
  let done = 0;
  for (const id of requirementIds) {
    if (checkedIds.has(id)) done += 1;
  }
  // done can never exceed total: only ids drawn from requirementIds are counted.
  return { total, done };
}

// Human labels for each status, kept next to the type so the UI select and any
// future digest/share copy stay in sync with the DB CHECK enum.
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "Interested",
  preparing: "Preparing",
  applied: "Applied",
  submitted: "Submitted",
};
