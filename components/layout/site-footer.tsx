import Link from "next/link";

// Stacked serif nav on black, mirroring the reference's "Work / Originals /
// The Studio" (UX doc §1.3, §1.6). Shared across public pages so wayfinding
// doesn't dead-end on /match, /saved, or a detail page. The column grid below
// gives every route a home, so the footer doubles as the full sitemap.
const MARQUEE = [
  { href: "/match", label: "Find scholarships" },
  { href: "/scholarships", label: "Browse all" },
  { href: "/saved", label: "Saved" },
] as const;

const COLUMNS = [
  {
    heading: "Explore",
    links: [
      { href: "/match", label: "Find my scholarships" },
      { href: "/scholarships", label: "Browse all" },
      { href: "/saved", label: "Saved & tracker" },
    ],
  },
  {
    heading: "Trust & help",
    links: [
      { href: "/about", label: "How it works" },
      { href: "/trust", label: "Data freshness" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="grain-noir bg-noir px-6 py-16 text-paper-ink">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Find your fit</p>
      <nav aria-label="Footer highlights" className="mt-4 flex flex-col gap-1 font-serif text-3xl font-light sm:text-4xl">
        {MARQUEE.map((item) => (
          <Link key={item.href} href={item.href} className="w-fit transition-opacity hover:opacity-70">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-paper-ink/15 pt-10 sm:grid-cols-3">
        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{col.heading}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-trace">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-end justify-between gap-6 border-t border-paper-ink/15 pt-8">
        <p className="text-xs text-muted">© 2026 IskolarMatch · verified data</p>
        <p className="max-w-[38ch] text-xs text-muted">
          Independent and unofficial. Not affiliated with CHED, DOST-SEI, or UniFAST. Always confirm details on the
          official site before applying.
        </p>
      </div>
    </footer>
  );
}
