import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "How it works — IskolarMatch" };

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <h1 className="reveal font-serif text-4xl font-light leading-tight sm:text-5xl">How it works.</h1>

          <ol className="mt-8 flex flex-col gap-6">
            <li>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">1. Answer a few questions</p>
              <p className="mt-1">
                Education level, GWA, course field, region, income bracket, and any special status. Nothing is
                saved unless you choose to save a scholarship afterward.
              </p>
            </li>
            <li>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                2. See what you qualify for
              </p>
              <p className="mt-1">
                We check your answers against each scholarship&apos;s published eligibility rules, deterministically
                -- no AI guessing. You&apos;ll see Eligible, Near-miss (one requirement away), or Not eligible.
              </p>
            </li>
            <li>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                3. Apply on the official site
              </p>
              <p className="mt-1">
                Every listing links to the provider&apos;s own site, never a third-party form, and shows when it was
                last verified.
              </p>
            </li>
            <li>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">4. Save and get reminded</p>
              <p className="mt-1">
                Sign in with a magic link (no password) only if you want to save a scholarship or get an email
                reminder before its deadline.
              </p>
            </li>
          </ol>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
