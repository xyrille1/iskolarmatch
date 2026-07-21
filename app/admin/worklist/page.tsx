import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getStalenessWorklist } from "@/lib/data/get-staleness-worklist";

export const metadata: Metadata = { title: "Staleness worklist — Admin" };
export const dynamic = "force-dynamic";

// FR12 (docs/PRD.md §4.1): admin-only companion to the public /trust
// dashboard (FR11) -- surfaces exactly which records need re-verification.
export default async function StalenessWorklistPage() {
  await requireAdmin();
  const items = await getStalenessWorklist();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staleness worklist</h1>
        <Link href="/admin" className="underline">
          Back to admin
        </Link>
      </div>
      <p className="mt-2 text-sm text-black/60">
        Published scholarships nearing or past the 60-day verified-staleness threshold, most urgent first.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-black/60">Nothing needs re-verification right now.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/20 text-left">
              <th className="py-2">Title</th>
              <th className="py-2">Provider</th>
              <th className="py-2">Last verified</th>
              <th className="py-2">Days since</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-black/10">
                <td className="py-2">{item.title}</td>
                <td className="py-2">{item.providerName}</td>
                <td className="py-2">
                  {item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleDateString("en-PH") : "Never"}
                </td>
                <td className="py-2">{item.daysSinceVerified ?? "—"}</td>
                <td className="py-2">
                  <Link href={`/admin/scholarships/${item.id}/edit`} className="underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
