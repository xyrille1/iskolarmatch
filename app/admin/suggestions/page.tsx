import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getPendingSuggestions } from "@/lib/data/get-suggestions-queue";
import { approveSuggestionFormAction, rejectSuggestionFormAction } from "@/lib/actions/suggestions";

export const metadata: Metadata = { title: "Source suggestions — Admin" };
export const dynamic = "force-dynamic";

const CONFIDENCE_STYLE: Record<string, string> = {
  low: "bg-status-danger/10 text-status-danger",
  medium: "bg-status-soon/10 text-status-soon",
  high: "bg-status-open/10 text-status-open",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(none)";
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 160)}…` : value;
  return JSON.stringify(value);
}

// FR10 (docs/PRD.md §1.6): curator suggestion queue. Field-level: each row is
// one proposed change, approvable/rejectable independently, worst-confidence
// first. Approval routes through the validated admin actions; nothing here
// auto-publishes. Mirrors app/admin/reports/page.tsx.
export default async function SuggestionsPage() {
  const admin = await requireAdmin();
  const suggestions = await getPendingSuggestions(admin);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Source suggestions</h1>
        <Link href="/admin" className="underline">
          Back to admin
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Proposed changes detected on official source pages, worst confidence first. Approving applies the change and
        re-verifies the scholarship; nothing publishes without your approval.
      </p>

      {suggestions.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No pending suggestions.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-5 text-sm">
          {suggestions.map((s) => (
            <li key={s.id} className="border-b border-line pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/scholarships/${s.scholarshipId}/edit`} className="font-medium underline">
                    {s.scholarshipTitle}
                  </Link>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[s.confidence] ?? ""}`}>
                    {s.confidence} confidence
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {s.targetTable}.{s.targetField}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span className="text-muted">Current:</span>
                <span className="text-ink/80 line-through">{formatValue(s.oldValue)}</span>
                <span className="text-muted">Proposed:</span>
                <span className="font-medium">{formatValue(s.newValue)}</span>
              </div>

              <p className="mt-2 text-xs text-muted">
                Cited from: {s.citingLabels.length > 0 ? s.citingLabels.join(", ") : "(no section)"} ·{" "}
                {new Date(s.createdAt).toLocaleString("en-PH")}
              </p>

              <div className="mt-3 flex items-center gap-4">
                <form action={approveSuggestionFormAction.bind(null, s.id)}>
                  <button type="submit" className="rounded border border-ink px-3 py-1.5">
                    Approve &amp; apply
                  </button>
                </form>
                <form action={rejectSuggestionFormAction.bind(null, s.id)} className="flex items-center gap-2">
                  <input
                    type="text"
                    name="reason"
                    placeholder="Reason (optional)"
                    className="rounded border border-line px-2 py-1 text-xs"
                  />
                  <button type="submit" className="underline">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
