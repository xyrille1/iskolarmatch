import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";

// Loading state for /match (force-dynamic: reads the auth cookie to decide
// the FR20 digest opt-in). Mirrors the question-form rhythm -- title, eyebrow,
// then a run of labelled field groups -- so the form lands without a jump.
export default function MatchLoading() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1" aria-busy="true">
        <div
          role="status"
          className="mx-auto flex max-w-[62ch] flex-col gap-8 px-6 py-12"
        >
          <span className="sr-only">Loading…</span>

          <div>
            <Skeleton className="h-11 w-3/4 max-w-md" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>

          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          ))}

          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </main>
    </>
  );
}
