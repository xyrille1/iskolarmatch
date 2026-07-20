import { formatStatusLabel, type DeadlineStatus } from "@/lib/deadline/format-status";

const DOT_COLOR: Record<DeadlineStatus, string> = {
  open: "bg-status-open",
  closed: "bg-status-closed",
  closing_soon: "bg-status-soon",
  upcoming: "bg-status-upcoming",
};

const TEXT_TONE = {
  default: "text-muted",
  // text-muted is under 4.5:1 on --noir; use this on black/full-bleed
  // sections so the label stays AA-compliant, not just the dot.
  inverted: "text-paper-ink/90",
} as const;

// Status is always icon/dot + word, never color alone (accessibility + UX doc §1.2).
export function StatusDot({
  status,
  closesAt,
  opensAt,
  tone = "default",
}: {
  status: DeadlineStatus;
  closesAt: string;
  opensAt?: string | null;
  tone?: keyof typeof TEXT_TONE;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm ${TEXT_TONE[tone]}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${DOT_COLOR[status]}`} />
      {formatStatusLabel(status, closesAt, opensAt)}
    </span>
  );
}
