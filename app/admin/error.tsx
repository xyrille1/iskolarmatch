"use client";

import Link from "next/link";
import { useEffect } from "react";

// Admin-segment error boundary (docs/QA-CHECKLIST.md P2-03). Renders inside
// app/admin/layout.tsx, so a failed admin read shows the admin chrome and a
// utilitarian message -- never the public SiteHeader/SiteFooter the root
// error.tsx would have used. Raw error text is never shown (it can leak
// internals); we log it and offer a retry.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-status-danger">Admin error</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">That didn&apos;t load.</h1>
      <p className="mt-3 text-sm text-muted">
        A hiccup on our end, not yours. Try again, or head back to the dashboard.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-ink px-3 py-1.5 text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded border border-line px-3 py-1.5 text-muted transition-colors hover:border-ink hover:text-ink"
        >
          Back to admin
        </Link>
      </div>
    </div>
  );
}
