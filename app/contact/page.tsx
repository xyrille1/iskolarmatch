import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "Contact — IskolarMatch" };

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Contact</p>
          <h1 className="reveal mt-2 font-serif text-4xl font-light leading-tight sm:text-5xl">
            Get help, or help us.
          </h1>
          <p className="reveal reveal-delay-1 mt-4 text-muted">
            IskolarMatch is kept accurate by real people. Here&apos;s the fastest way to reach the right one, depending
            on what you need.
          </p>

          <div className="mt-12 flex flex-col divide-y divide-line">
            <section className="py-6">
              <h2 className="font-serif text-xl font-light">A listing looks wrong or out of date</h2>
              <p className="mt-2 text-muted">
                Open the scholarship&apos;s page and use its <span className="text-ink">Report an issue</span> link.
                Reports go straight to the team that curates the data and are the fastest way to get a correction --
                a wrong deadline, a broken link, or an eligibility rule that&apos;s changed.
              </p>
              <Link href="/scholarships" className="link-trace mt-3 inline-block text-ink">
                Browse scholarships →
              </Link>
            </section>

            <section className="py-6">
              <h2 className="font-serif text-xl font-light">A question about how it works</h2>
              <p className="mt-2 text-muted">
                Most questions are answered on the FAQ and the How it works pages -- what the matching does, what
                happens to your answers, and how reminders work.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <Link href="/faq" className="link-trace text-ink">
                  Read the FAQ →
                </Link>
                <Link href="/about" className="link-trace text-ink">
                  How it works →
                </Link>
              </div>
            </section>

            <section className="py-6">
              <h2 className="font-serif text-xl font-light">Your data or privacy</h2>
              <p className="mt-2 text-muted">
                You can see, correct, or delete the little data we hold at any time by managing or deleting your
                account. Our Privacy page explains your rights under the Data Privacy Act (RA 10173) in plain
                language.
              </p>
              <Link href="/privacy" className="link-trace mt-3 inline-block text-ink">
                Read the privacy page →
              </Link>
            </section>
          </div>

          <p className="mt-12 border-t border-line pt-8 text-sm text-muted">
            IskolarMatch is an independent, student-built project. We&apos;re not a call center -- but every report and
            question is read, and it&apos;s how the directory stays trustworthy.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
