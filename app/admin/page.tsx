import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminScholarships } from "@/lib/data/get-admin-scholarships";
import { getPendingSuggestionCount } from "@/lib/data/get-suggestion-counts";
import { getPendingCandidateCount } from "@/lib/data/get-discovery-queue";
import { markVerified } from "@/lib/actions/admin";
import { verifiedEyebrowLabel } from "@/lib/trust/verified-eyebrow";

export const metadata: Metadata = { title: "Admin — IskolarMatch" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [scholarships, pendingSuggestions, pendingDiscoveries] = await Promise.all([
    getAdminScholarships(),
    getPendingSuggestionCount(),
    getPendingCandidateCount(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin: Scholarships</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin/reports" className="underline">
            Reported issues
          </Link>
          <Link href="/admin/suggestions" className="underline">
            Source suggestions
            {pendingSuggestions > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                {pendingSuggestions}
              </span>
            )}
          </Link>
          <Link href="/admin/discoveries" className="underline">
            Discoveries
            {pendingDiscoveries > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                {pendingDiscoveries}
              </span>
            )}
          </Link>
          <Link href="/admin/source-pages" className="underline">
            Source pages
          </Link>
          <Link href="/admin/worklist" className="underline">
            Staleness worklist
          </Link>
          <Link href="/admin/providers" className="underline">
            Providers
          </Link>
          <Link href="/admin/scholarships/new" className="rounded border border-black px-3 py-1.5">
            + New scholarship
          </Link>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/20 text-left">
            <th className="py-2">Title</th>
            <th className="py-2">Provider</th>
            <th className="py-2">Published</th>
            <th className="py-2">Verified</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {scholarships.map((s) => (
            <tr key={s.id} className="border-b border-black/10">
              <td className="py-2">{s.title}</td>
              <td className="py-2">{s.providerName}</td>
              <td className="py-2">{s.isPublished ? "Yes" : "Draft"}</td>
              <td className="py-2">{verifiedEyebrowLabel(s.lastVerifiedAt)}</td>
              <td className="py-2">
                <div className="flex gap-3">
                  <Link href={`/admin/scholarships/${s.id}/edit`} className="underline">
                    Edit
                  </Link>
                  <form action={markVerified.bind(null, s.id)}>
                    <button type="submit" className="underline">
                      Mark verified
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
