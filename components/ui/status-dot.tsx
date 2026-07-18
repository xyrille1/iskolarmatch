import { formatStatusLabel, type DeadlineStatus } from "@/lib/deadline/format-status";

const DOT_COLOR: Record<DeadlineStatus, string> = {
  open: "bg-status-open",
  closed: "bg-status-closed",
  closing_soon: "bg-status-soon",
  upcoming: "bg-status-upcoming",
};

// Status is always icon/dot + word, never color alone (accessibility + UX doc §1.2).
export function StatusDot({
  status,
  closesAt,
  opensAt,
}: {
  status: DeadlineStatus;
  closesAt: string;
  opensAt?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className={`h-2 w-2 rounded-full ${DOT_COLOR[status]}`} />
      {formatStatusLabel(status, closesAt, opensAt)}
    </span>
  );
}
