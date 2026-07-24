import Link from "next/link";
import type { ReactNode } from "react";

// Admin shell (docs/QA-CHECKLIST.md P2-02/P2-03). Deliberately utilitarian --
// NOT editorial-skinned (docs/iskolar-ux-design.md §2) -- but built from the
// shared editorial tokens (--ink / --paper / --line / --muted) rather than raw
// default-Tailwind, so the admin and public surfaces don't drift. This is
// chrome only: the auth gate stays in each page's own requireAdmin() call.
//
// Because this layout wraps every /admin/* segment, the admin error.tsx /
// loading.tsx render INSIDE it -- so a failed read or slow load on an admin
// route now shows this admin bar, never the public SiteHeader/SiteFooter.

const NAV = [
  { href: "/admin", label: "Scholarships" },
  { href: "/admin/suggestions", label: "Suggestions" },
  { href: "/admin/discoveries", label: "Discoveries" },
  { href: "/admin/source-pages", label: "Source pages" },
  { href: "/admin/worklist", label: "Worklist" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/providers", label: "Providers" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/admin" className="text-sm font-semibold tracking-tight text-ink">
            IskolarMatch <span className="text-muted">· Admin</span>
          </Link>
          <nav aria-label="Admin sections" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="link-trace text-muted hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="link-trace ml-auto text-sm text-muted hover:text-ink">
            View site →
          </Link>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
