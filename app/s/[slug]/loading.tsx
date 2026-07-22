import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

// Loading state for a scholarship detail page (force-dynamic: reads the
// caller's auth cookie for Save/reminder state). Mirrors the back-link →
// provider → title → status → controls → sections rhythm at the same
// max-width so the real content lands in place.
export default function ScholarshipDetailLoading() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1" aria-busy="true">
        <div role="status" className="mx-auto max-w-[62ch] px-6 py-12">
          <span className="sr-only">Loading scholarship…</span>

          <Skeleton className="h-3.5 w-28" />

          <Skeleton className="mt-6 h-3.5 w-32" />
          <Skeleton className="mt-3 h-11 w-full max-w-xl" />
          <Skeleton className="mt-2 h-11 w-2/3" />
          <Skeleton className="mt-4 h-3.5 w-44" />

          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>

          {Array.from({ length: 3 }).map((_, i) => (
            <section key={i} className="mt-12">
              <Skeleton className="h-3 w-32" />
              <SkeletonText lines={i === 0 ? 2 : 3} className="mt-3" />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
