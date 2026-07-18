import Link from "next/link";
import { PillLink } from "@/components/ui/pill";

const PROVIDER_TILES = ["CHED", "DOST-SEI", "UniFAST"];

export default function LandingPage() {
  return (
    <>
      <header className="flex items-center justify-between px-6 py-6">
        <span className="font-sans text-lg font-bold">IskolarMatch</span>
        <nav aria-label="Primary" className="text-sm">
          <Link href="/match" className="underline">
            Find scholarships
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="px-6 py-16">
          <h1 className="font-serif text-5xl font-light leading-[1.05] sm:text-7xl">
            Find what you actually qualify for.
          </h1>
          <p className="mt-4 max-w-[46ch] text-muted">
            Verified. Deadline-tracked. Built for Filipino students.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            {PROVIDER_TILES.map((p) => (
              <div
                key={p}
                className="flex h-24 w-32 items-center justify-center bg-noir text-center text-sm font-medium text-paper-ink"
              >
                {p}
              </div>
            ))}
          </div>

          <PillLink href="/match" variant="solid" className="mt-10 w-full sm:w-auto">
            Find my scholarships →
          </PillLink>

          <div className="mt-16 border-t border-line pt-8">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">What we check</p>
            <p className="mt-2 max-w-[46ch]">
              Education level · GWA · Course field · Region · Income bracket · Special status · Deadlines ·
              Requirements
            </p>
          </div>
        </section>

        <section className="bg-noir px-6 py-16 text-paper-ink">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Every listing links to the official source
          </p>
          <p className="mt-4 max-w-[46ch] font-serif text-3xl font-light leading-tight">
            Every listing links to the official source, and shows when it was verified.
          </p>
        </section>
      </main>

      <footer className="bg-noir px-6 py-16 text-paper-ink">
        <nav aria-label="Footer" className="flex flex-col gap-2 font-serif text-3xl font-light">
          <Link href="/match">Find scholarships</Link>
          <Link href="/saved">Saved</Link>
          <Link href="/about">How it works</Link>
        </nav>
        <p className="mt-8 text-sm">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
        <p className="mt-8 text-xs text-muted" aria-hidden>
          © 2026
        </p>
      </footer>
    </>
  );
}
