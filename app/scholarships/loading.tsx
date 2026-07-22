import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton, ScholarshipRowSkeleton } from "@/components/ui/skeleton";

// Loading state for the browse route (UX doc §170: every screen defines a
// loading state). Mirrors the eyebrow → title → filter form → list rhythm so
// the real page lands without a jump. Header stays real to keep wayfinding.
export default function BrowseLoading() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1" aria-busy="true">
        <div role="status" className="mx-auto max-w-4xl px-6 py-12">
          <span className="sr-only">Loading scholarships…</span>

          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-11 w-4/5 max-w-lg" />
          <Skeleton className="mt-3 h-4 w-64" />

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-11 rounded-md ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}
              />
            ))}
            <Skeleton className="col-span-2 h-11 rounded-full sm:col-span-1" />
          </div>

          <Skeleton className="mt-6 h-4 w-32" />

          <ul className="mt-4 flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <ScholarshipRowSkeleton key={i} />
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
