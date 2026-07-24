"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Shared public route-segment error UI (docs/QA-CHECKLIST.md P2-03). The
// dynamic public routes (/match, /saved, /s/[slug], /shared/[slug]) each wire a
// thin error.tsx to this so a failed read degrades to a graceful, retryable
// message WITHIN that segment -- rather than bubbling up to the root boundary
// and replacing the whole page. Raw error text is never shown; we log and
// offer a retry. Public chrome (header/footer) is intentional here, unlike the
// admin boundary.
export function RouteError({
  reset,
  error,
  title = "That didn't load.",
  message = "A hiccup on our end, not yours. Try again -- and if it keeps happening, let us know.",
}: {
  reset: () => void;
  error: Error & { digest?: string };
  title?: string;
  message?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[52ch] px-6 py-24">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Something went wrong</p>
          <h1 className="mt-2 font-serif text-4xl font-light leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 text-muted">{message}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
