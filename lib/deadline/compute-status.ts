import type { DeadlineStatus } from "./format-status";

const CLOSING_SOON_WINDOW_DAYS = 7;

function daysBetween(fromIso: string, toIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / msPerDay);
}

// Pure: no I/O, no reliance on the server's local clock -- caller passes in
// "today" (Asia/Manila, see manila-date.ts) as a plain YYYY-MM-DD string.
// today < opens_at -> upcoming; today > closes_at -> closed;
// closes_at - today <= 7 days -> closing_soon; else open.
export function computeDeadlineStatus(todayIso: string, opensAt: string | null, closesAt: string): DeadlineStatus {
  if (opensAt && todayIso < opensAt) {
    return "upcoming";
  }
  if (todayIso > closesAt) {
    return "closed";
  }
  if (daysBetween(todayIso, closesAt) <= CLOSING_SOON_WINDOW_DAYS) {
    return "closing_soon";
  }
  return "open";
}
