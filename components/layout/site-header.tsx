import Link from "next/link";

// Shared slim top bar (UX doc §2/§4.1): wordmark left, wayfinding right.
// The large stacked nav lives in SiteFooter, so this stays a plain Server
// Component -- no JS, no hamburger, nothing to hydrate. Secondary links fold
// away on small screens (the footer carries full wayfinding on mobile);
// "Saved" and the primary CTA stay visible at every width.
const NAV_LINKS = [
  { href: "/scholarships", label: "Browse all", show: "hidden sm:inline" },
  { href: "/about", label: "How it works", show: "hidden md:inline" },
  { href: "/trust", label: "Data freshness", show: "hidden lg:inline" },
  { href: "/saved", label: "Saved", show: "hidden sm:inline" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur sm:px-6">
      {/* Keyboard/screen-reader users can jump past the nav to the page body. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-30 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      <Link href="/" className="flex items-center gap-2 font-sans text-base font-bold tracking-tight sm:text-lg">
        <span aria-hidden className="h-2 w-2 rounded-full bg-ink" />
        IskolarMatch
      </Link>

      <nav aria-label="Primary" className="flex items-center gap-5 text-sm sm:gap-6">
        {NAV_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className={`link-trace ${item.show}`}>
            {item.label}
          </Link>
        ))}
        <Link
          href="/match"
          className="inline-flex min-h-[40px] items-center rounded-full bg-ink px-4 py-2 font-medium text-paper transition-colors hover:bg-ink/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Find scholarships
        </Link>
      </nav>
    </header>
  );
}
