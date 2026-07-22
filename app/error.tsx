"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Route-segment error boundary (App Router). Must be a Client Component and
// receive { error, reset }. We never surface the raw error text to users --
// it can leak internals -- we just log it and offer a retry.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[52ch] px-6 py-24">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Something went wrong</p>
          <h1 className="mt-2 font-serif text-5xl font-light leading-[1.05] sm:text-6xl">
            That didn&apos;t load.
          </h1>
          <p className="mt-4 text-muted">
            A hiccup on our end, not yours. Try again -- and if it keeps happening, let us know.
          </p>

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

          <p className="mt-10 text-sm text-muted">
            Still stuck?{" "}
            <Link href="/contact" className="link-trace text-ink">
              Contact us
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
