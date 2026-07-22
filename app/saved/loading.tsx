import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";

// Loading state for the per-user Saved/tracker route, which is force-dynamic
// and always suspends on its Supabase reads. Mirrors the title → controls →
// tracked-item list so the swap to real data is jump-free.
export default function SavedLoading() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1" aria-busy="true">
        <div role="status" className="mx-auto max-w-4xl px-6 py-12">
          <span className="sr-only">Loading your saved scholarships…</span>

          <Skeleton className="h-11 w-40" />
          <Skeleton className="mt-4 h-4 w-full max-w-[52ch]" />

          <div className="mt-6 flex flex-wrap gap-4">
            <Skeleton className="h-11 w-48 rounded-full" />
          </div>

          <ul className="mt-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="border-b border-line py-8">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-3 h-7 w-3/4 max-w-md" />
                <Skeleton className="mt-4 h-3.5 w-40" />
                <Skeleton className="mt-6 h-9 w-56 rounded-full" />
                <div className="mt-6 flex items-center gap-3">
                  <Skeleton className="h-2 w-40 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
