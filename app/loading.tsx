import { SiteHeader } from "@/components/layout/site-header";

// Root-level loading UI, shown during navigations to a segment that suspends
// (e.g. the dynamic /saved and /match reads). Static pages skip it entirely.
// Kept quiet and header-stable so there's no layout jump when the page lands.
export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1" aria-busy="true">
        <div
          role="status"
          className="mx-auto flex max-w-[52ch] items-center gap-3 px-6 py-24 text-muted"
        >
          <span aria-hidden className="h-2 w-2 animate-ping rounded-full bg-ink" />
          <span className="text-sm">Loading…</span>
        </div>
      </main>
    </>
  );
}
