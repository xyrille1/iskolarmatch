import type { DeadlineCycle } from "@/lib/types/scholarship";

export type DeadlineStatus = DeadlineCycle["status"];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(iso));
}

function daysUntil(iso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

// Real close dates only -- no manufactured urgency (UX doc §5).
export function formatStatusLabel(status: DeadlineStatus, closesAt: string, opensAt?: string | null): string {
  switch (status) {
    case "closed":
      return "Closed";
    case "upcoming":
      return opensAt ? `Upcoming · opens ${formatDate(opensAt)}` : "Upcoming";
    case "closing_soon": {
      const days = daysUntil(closesAt);
      return `Closing soon · ${days} ${days === 1 ? "day" : "days"} left`;
    }
    case "open":
    default:
      return `Open · closes ${formatDate(closesAt)}`;
  }
}
