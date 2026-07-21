import Link from "next/link";

// Shared slim top bar (UX doc §2/§4.1): wordmark left, one primary link
// right. The large stacked nav lives in SiteFooter, so this stays a plain
// Server Component -- no JS, no hamburger, nothing to hydrate.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-paper/90 px-6 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-sans text-lg font-bold tracking-tight">
        <span aria-hidden className="h-2 w-2 rounded-full bg-ink" />
        IskolarMatch
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
        <Link href="/scholarships" className="link-trace">
          Browse all
        </Link>
        <Link href="/match" className="link-trace">
          Find scholarships
        </Link>
      </nav>
    </header>
  );
}
