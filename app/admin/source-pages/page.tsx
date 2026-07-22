import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSourceIndexPages } from "@/lib/data/get-source-index-pages";
import { getProviders } from "@/lib/data/get-providers";
import {
  addSourceIndexPageFormAction,
  setSourceIndexPageActiveFormAction,
  deleteSourceIndexPageFormAction,
} from "@/lib/actions/source-pages";

export const metadata: Metadata = { title: "Source pages — Admin" };
export const dynamic = "force-dynamic";

// FR22 (docs/PRD.md §4.7): the discovery crawler's source registry. A curator
// registers official gov.ph/edu.ph index/listing pages here; the weekly
// discover-sources cron only ever crawls pages reachable from these. Utilitarian
// admin styling, matching app/admin/providers/page.tsx.
export default async function AdminSourcePagesPage() {
  const admin = await requireAdmin();
  const [pages, providers] = await Promise.all([getSourceIndexPages(admin), getProviders(admin)]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Source pages</h1>
        <Link href="/admin" className="text-sm underline">
          Back to admin
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Official <strong>gov.ph / edu.ph</strong> index pages the discovery crawler reads each week to find new
        scholarships. Only these pages (and links found on them) are ever fetched. Off-allowlist sites can&apos;t be
        added.
      </p>

      {pages.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No source pages registered yet.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3 text-sm">
          {pages.map((p) => (
            <li key={p.id} className="border-b border-line pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{p.label ?? p.indexUrl}</div>
                  <a href={p.indexUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-muted underline">
                    {p.indexUrl}
                  </a>
                  <div className="mt-1 text-xs text-muted">
                    {p.providerName ? `${p.providerName} · ` : ""}
                    {p.isActive ? "Active" : "Paused"}
                    {p.lastCrawledAt ? ` · last crawled ${new Date(p.lastCrawledAt).toLocaleString("en-PH")}` : " · never crawled"}
                  </div>
                  {p.lastError && <div className="mt-1 text-xs text-status-danger">Last error: {p.lastError}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <form action={setSourceIndexPageActiveFormAction.bind(null, p.id, !p.isActive)}>
                    <button type="submit" className="underline">
                      {p.isActive ? "Pause" : "Activate"}
                    </button>
                  </form>
                  <form action={deleteSourceIndexPageFormAction.bind(null, p.id)}>
                    <button type="submit" className="text-status-danger underline">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={addSourceIndexPageFormAction} className="mt-10 flex flex-col gap-3 text-sm">
        <h2 className="text-lg font-semibold">Add a source page</h2>
        <input
          name="index_url"
          type="url"
          required
          placeholder="https://up.phinma.edu.ph/scholarships"
          className="rounded border border-line px-2 py-1.5"
        />
        <input name="label" placeholder="Label (optional, e.g. PHINMA scholarships)" className="rounded border border-line px-2 py-1.5" />
        <select name="provider_id" defaultValue="" className="rounded border border-line px-2 py-1.5">
          <option value="">Provider (optional)</option>
          {providers.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
        <button type="submit" className="w-fit rounded border border-ink px-3 py-1.5">
          Add source page
        </button>
        <p className="text-xs text-muted">
          Must be on <code>*.gov.ph</code> or <code>*.edu.ph</code> (or a curated allowlisted domain).
        </p>
      </form>
    </div>
  );
}
