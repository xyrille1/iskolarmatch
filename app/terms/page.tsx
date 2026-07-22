import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "Terms — IskolarMatch" };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <h1 className="reveal font-serif text-4xl font-light leading-tight sm:text-5xl">Terms of use.</h1>
          <p className="mt-2 text-sm text-muted">
            Plain-language terms for using IskolarMatch. By using the site, you agree to what&apos;s below.
          </p>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">What IskolarMatch is</h2>
            <p className="mt-2">
              IskolarMatch is a free, independent tool that helps Filipino students discover scholarships they may
              qualify for and keep track of deadlines. It is a directory and a matching helper -- not a scholarship
              provider, an application portal, or a government service.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">No guarantee of eligibility</h2>
            <p className="mt-2">
              Matching results are based on the eligibility rules we&apos;ve recorded for each scholarship and the
              answers you provide. They are an estimate to help you shortlist, not a decision. Only the provider can
              confirm whether you qualify. Always read the official rules and apply on the provider&apos;s own site.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Accuracy and timing</h2>
            <p className="mt-2">
              We work to keep every listing verified and current, and each one shows when it was last checked. Even
              so, providers can change requirements or deadlines without notice. If a detail looks wrong or out of
              date, use the &quot;Report an issue&quot; link on that scholarship&apos;s page -- it genuinely helps.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Your account</h2>
            <p className="mt-2">
              You can browse and match without an account. Signing in with a magic link is optional and only needed
              to save scholarships or set deadline reminders. Keep your email secure, use the service for its
              intended purpose, and don&apos;t attempt to disrupt it or access data that isn&apos;t yours.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Links to other sites</h2>
            <p className="mt-2">
              Every listing links to the provider&apos;s official site. Those sites have their own terms and privacy
              practices, which we don&apos;t control and aren&apos;t responsible for.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms as the service grows. Continuing to use IskolarMatch after a change means you
              accept the updated terms. These terms are governed by the laws of the Republic of the Philippines.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Disclaimer</h2>
            <p className="mt-2">
              IskolarMatch is an independent, unofficial tool. We are not affiliated with CHED, DOST-SEI, UniFAST, or
              any scholarship provider listed here, and the service is provided &quot;as is&quot; without warranties.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
