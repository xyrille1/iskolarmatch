import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { StatusDot } from "@/components/ui/status-dot";
import { PillLink } from "@/components/ui/pill";
import { getPublishedScholarships } from "@/lib/data/get-published-scholarships";
import { filterScholarships } from "@/lib/browse/filter-scholarships";
import { COVERAGE_TYPES } from "@/lib/types/matching";

export const metadata: Metadata = { title: "Browse scholarships — IskolarMatch" };

// FR17 (docs/PRD.md §4.2): a plain GET <form> so filtering works with zero
// JS (query-string driven, full navigation) -- consistent with the rest of
// the app's low-JS reading philosophy (docs/iskolar-ux-design.md §7).
//
// No `revalidate` here: `await searchParams` below makes every request
// dynamic regardless of what a revalidate value would declare, so a
// `revalidate = 3600` directive was inert and misleading (confirmed `ƒ
// Dynamic` in the build output -- docs/QA-CHECKLIST.md P2-01). If hourly
// ISR caching is wanted later, filtering would need to move client-side/to a
// cached data layer so the shell can prerender -- deferred as a possible
// P3-07-style perf pass, not done here.

const PROVIDER_TYPES = ["government", "lgu", "private", "university"] as const;
const STATUSES = ["open", "closing_soon", "upcoming", "closed"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstOrUndefined(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    coverageType: firstOrUndefined(params.coverage),
    providerType: firstOrUndefined(params.provider),
    region: firstOrUndefined(params.region),
    status: firstOrUndefined(params.status),
    q: firstOrUndefined(params.q),
  };

  const all = await getPublishedScholarships();
  const regionOptions = Array.from(new Set(all.flatMap((i) => i.regions))).sort();
  const results = filterScholarships(all, filters);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Browse</p>
          <h1 className="reveal mt-2 font-serif text-4xl font-light leading-tight sm:text-5xl">
            Explore every verified scholarship.
          </h1>
          <p className="mt-2 text-muted">No profile needed -- filter and search on your own.</p>

          <form className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <input
              type="search"
              name="q"
              placeholder="Search title…"
              defaultValue={filters.q ?? ""}
              className="col-span-2 min-h-[44px] rounded-md border border-line px-3 py-2 text-sm sm:col-span-1"
            />
            <select
              name="coverage"
              defaultValue={filters.coverageType ?? ""}
              className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="">Any coverage</option>
              {COVERAGE_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              name="provider"
              defaultValue={filters.providerType ?? ""}
              className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="">Any provider type</option>
              {PROVIDER_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              name="region"
              defaultValue={filters.region ?? ""}
              className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="">Any region</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="col-span-2 min-h-[44px] rounded-full border border-ink px-4 text-sm sm:col-span-1"
            >
              Apply filters
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {results.length} scholarship{results.length === 1 ? "" : "s"}
          </p>

          <ul className="mt-4 flex flex-col divide-y divide-line">
            {results.map((item) => (
              <li key={item.id} className="py-6">
                <p className="text-sm text-muted">{item.providerName}</p>
                <Link
                  href={`/s/${item.slug}`}
                  className="link-trace mt-1 block w-fit font-serif text-2xl font-light leading-tight"
                >
                  {item.title}
                </Link>
                <div className="mt-2">
                  <StatusDot status={item.status} closesAt={item.closesAt} opensAt={item.opensAt} />
                </div>
              </li>
            ))}
          </ul>

          {results.length === 0 && (
            <p className="mt-8 text-sm text-muted">No scholarships match these filters. Try clearing one.</p>
          )}

          <div className="mt-12">
            <PillLink href="/match" variant="solid">
              Or get a personalized shortlist →
            </PillLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
