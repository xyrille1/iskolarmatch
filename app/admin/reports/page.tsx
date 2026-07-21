import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getUnresolvedScholarshipReports } from "@/lib/data/get-scholarship-reports";
import { resolveScholarshipReport } from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Reported issues — Admin" };
export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  stale_info: "Information looks outdated",
  broken_link: "Broken link",
  wrong_deadline: "Wrong deadline",
  other: "Other",
};

// FR13 (docs/PRD.md §4.1): curator moderation queue for student-submitted
// "report an issue" flags. Not public UGC -- admin-only, resolve-and-clear.
export default async function ReportsPage() {
  await requireAdmin();
  const reports = await getUnresolvedScholarshipReports();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reported issues</h1>
        <Link href="/admin" className="underline">
          Back to admin
        </Link>
      </div>
      <p className="mt-2 text-sm text-black/60">Unresolved student reports, oldest first.</p>

      {reports.length === 0 ? (
        <p className="mt-8 text-sm text-black/60">No open reports.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4 text-sm">
          {reports.map((report) => (
            <li key={report.id} className="border-b border-black/10 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/admin/scholarships/${report.scholarshipId}/edit`} className="font-medium underline">
                    {report.scholarshipTitle}
                  </Link>
                  <span className="ml-2 text-black/60">{REASON_LABELS[report.reason] ?? report.reason}</span>
                </div>
                <form action={resolveScholarshipReport.bind(null, report.id)}>
                  <button type="submit" className="underline">
                    Mark resolved
                  </button>
                </form>
              </div>
              {report.detail && <p className="mt-1 text-black/70">{report.detail}</p>}
              <p className="mt-1 text-xs text-black/50">
                {new Date(report.createdAt).toLocaleString("en-PH")}
                {report.reporterEmail && ` · ${report.reporterEmail}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
