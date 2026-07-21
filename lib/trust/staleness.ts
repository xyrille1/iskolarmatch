import { VERIFIED_STALENESS_DAYS } from "./verified-eyebrow";

// FR12 (docs/PRD.md §4.1): a published record is worklist-worthy once it's
// within this many days of crossing the staleness threshold, not only after
// it's already crossed -- gives the curator a heads-up, not just an alarm.
export const STALENESS_WORKLIST_LEAD_DAYS = 14;

// null (never verified) can't happen for a published row in practice --
// scholarships_publish_guard requires last_verified_at to publish -- but
// treated as "needs attention" defensively rather than assumed away.
export function isNearingOrPastStaleness(daysSinceVerified: number | null): boolean {
  if (daysSinceVerified === null) return true;
  return daysSinceVerified >= VERIFIED_STALENESS_DAYS - STALENESS_WORKLIST_LEAD_DAYS;
}
