import Link from "next/link";

// Stacked serif nav on black, mirroring the reference's "Work / Originals /
// The Studio" (UX doc §1.3, §1.6). Shared across public pages so wayfinding
// doesn't dead-end on /match, /saved, or a detail page.
export function SiteFooter() {
  return (
    <footer className="grain-noir bg-noir px-6 py-16 text-paper-ink">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Find your fit</p>
      <nav aria-label="Footer" className="mt-4 flex flex-col gap-1 font-serif text-3xl font-light sm:text-4xl">
        <Link href="/match" className="w-fit transition-opacity hover:opacity-70">
          Find scholarships
        </Link>
        <Link href="/saved" className="w-fit transition-opacity hover:opacity-70">
          Saved
        </Link>
        <Link href="/about" className="w-fit transition-opacity hover:opacity-70">
          How it works
        </Link>
        <Link href="/trust" className="w-fit transition-opacity hover:opacity-70">
          Data freshness
        </Link>
      </nav>

      <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-paper-ink/15 pt-8">
        <p className="text-sm">
          <Link href="/privacy" className="link-trace">
            Privacy
          </Link>
        </p>
        <p className="max-w-[32ch] text-xs text-muted">
          Independent and unofficial. Not affiliated with CHED, DOST-SEI, or UniFAST.
        </p>
      </div>

      <p className="mt-10 text-xs text-muted" aria-hidden>
        © 2026 IskolarMatch · verified data
      </p>
    </footer>
  );
}
