import Link from "next/link";
import { PillLink } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getLandingHighlights } from "@/lib/data/get-landing-highlights";

const PROVIDER_TILES = ["CHED", "DOST-SEI", "UniFAST"];

const WHAT_WE_CHECK = [
  "Education level",
  "GWA",
  "Course field",
  "Region",
  "Income bracket",
  "Special status",
  "Deadlines",
  "Requirements",
];

// Landing is documented as static (docs/ARCHITECTURE.md); the featured
// gallery and stat tile are the one live read, so this is ISR rather than
// force-dynamic -- still prerendered, just regenerated hourly.
export const revalidate = 3600;

export default async function LandingPage() {
  const { featured, verifiedCount } = await getLandingHighlights();

  return (
    <>
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden px-6 py-20 sm:py-28">
          <span
            aria-hidden
            className="marginalia-vertical absolute right-6 top-20 hidden text-[11px] font-medium uppercase tracking-[0.2em] text-muted sm:block"
          >
            Verified data · est. 2026
          </span>

          <h1 className="reveal max-w-3xl font-serif text-5xl font-light leading-[1.05] sm:text-7xl">
            Find what you actually qualify for.
          </h1>
          <p className="reveal reveal-delay-1 mt-4 max-w-[46ch] text-muted">
            Verified. Deadline-tracked. Built for Filipino students.
          </p>

          <div className="reveal reveal-delay-2 mt-10 flex flex-wrap items-end gap-4">
            {PROVIDER_TILES.map((p, i) => (
              <div
                key={p}
                className={`flex h-24 w-32 items-center justify-center text-center text-sm font-medium transition-transform duration-300 hover:-translate-y-1 ${
                  i === 1 ? "bg-ink text-paper-ink" : "border border-line text-ink"
                }`}
              >
                {p}
              </div>
            ))}
            {verifiedCount !== null && (
              <div className="flex h-24 w-40 flex-col justify-center border border-line px-4">
                <span className="font-serif text-3xl font-light leading-none">{verifiedCount}</span>
                <span className="mt-1 text-xs text-muted">
                  verified scholarship{verifiedCount === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>

          <PillLink href="/match" variant="solid" className="reveal reveal-delay-2 mt-10 w-full sm:w-auto">
            Find my scholarships →
          </PillLink>

          <div className="reveal reveal-delay-3 mt-16 border-t border-line pt-8">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">What we check</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {WHAT_WE_CHECK.map((item) => (
                <li key={item} className="rounded-full border border-line px-3 py-1 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {featured.length > 0 && (
          <section className="grain-noir bg-noir px-6 py-16 text-paper-ink">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Featured scholarships</p>
            <ul className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-3">
              {featured.map((item) => (
                <li key={item.slug} className="border-t border-paper-ink/15 pt-6">
                  <p className="text-sm text-paper-ink/70">{item.providerName}</p>
                  <Link
                    href={`/s/${item.slug}`}
                    className="link-trace mt-1 block w-fit font-serif text-2xl font-light leading-tight"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-3">
                    <StatusDot status={item.status} closesAt={item.closesAt} opensAt={item.opensAt} tone="inverted" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-noir px-6 py-16 text-paper-ink">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Every listing links to the official source
          </p>
          <p className="mt-4 max-w-[46ch] font-serif text-3xl font-light leading-tight">
            Every listing links to the official source, and shows when it was verified.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
