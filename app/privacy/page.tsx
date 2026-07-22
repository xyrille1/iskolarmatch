import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "Privacy — IskolarMatch" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <h1 className="reveal font-serif text-4xl font-light leading-tight sm:text-5xl">
            Privacy, in plain language.
          </h1>
          <p className="mt-2 text-sm text-muted">
            This page follows the Philippine Data Privacy Act of 2012 (RA 10173). We wrote it so a 16-year-old can
            understand it.
          </p>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Answering the matching questions
            </h2>
            <p className="mt-2">
              When you use the &quot;Find my scholarships&quot; form, your answers (education level, GWA, course
              field, region, income bracket, and any special status like PWD, solo-parent dependent, or
              indigenous) are used only for that one request, to check which scholarships you qualify for. They
              are never written to a database and never leave your session. Once you close the tab, they&apos;re
              gone.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">If you sign in</h2>
            <p className="mt-2">
              Signing in only requires an email address -- no password, no other personal details. We use it to
              send you a magic link, to remember which scholarships you saved, and to email you a reminder before
              a deadline you asked about. We don&apos;t ask for anything else, and we never sell or share your
              email with anyone outside IskolarMatch.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">How long we keep it</h2>
            <p className="mt-2">
              Your email is kept only while your account exists. Saved scholarships and reminders for cycles that
              have already closed may be periodically removed. You can delete your account at any time, which
              removes your saved list and reminders along with it.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Your rights</h2>
            <p className="mt-2">
              You can ask to see, correct, or delete any personal data we hold about you, at any time, by deleting
              your account or contacting us. We don&apos;t use third-party analytics or trackers on the matching
              form or profile flow.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">If something goes wrong</h2>
            <p className="mt-2">
              If we ever discover a data breach that could affect you, Philippine law requires us to notify the
              National Privacy Commission and everyone affected within 72 hours of finding out. We take that
              seriously.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Disclaimer</h2>
            <p className="mt-2">
              IskolarMatch is an independent, unofficial tool. We are not affiliated with CHED, DOST-SEI, UniFAST,
              or any scholarship provider listed here. Always confirm details on the official site before
              applying.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
