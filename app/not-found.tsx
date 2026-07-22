import Link from "next/link";
import { PillLink } from "@/components/ui/pill";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[52ch] px-6 py-24">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Error 404</p>
          <h1 className="reveal mt-2 font-serif text-5xl font-light leading-[1.05] sm:text-6xl">
            This page isn&apos;t here.
          </h1>
          <p className="reveal reveal-delay-1 mt-4 text-muted">
            The link may be broken, or the page may have moved. The scholarships haven&apos;t gone anywhere, though.
          </p>

          <div className="reveal reveal-delay-2 mt-10 flex flex-wrap gap-3">
            <PillLink href="/match" variant="solid">
              Find my scholarships →
            </PillLink>
            <PillLink href="/scholarships" variant="outline">
              Browse all
            </PillLink>
          </div>

          <p className="mt-10 text-sm text-muted">
            Or head back{" "}
            <Link href="/" className="link-trace text-ink">
              home
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
