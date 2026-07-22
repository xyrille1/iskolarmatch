import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PillLink } from "@/components/ui/pill";

export const metadata: Metadata = { title: "FAQ — IskolarMatch" };

const FAQS = [
  {
    q: "Is IskolarMatch free?",
    a: "Yes, completely. There's no cost to browse, match, save scholarships, or set deadline reminders.",
  },
  {
    q: "Do I need an account?",
    a: "No. You can browse every listing and run the matching form without signing in. An account -- a passwordless magic link sent to your email -- is only needed if you want to save scholarships or get reminders before a deadline.",
  },
  {
    q: "Are you affiliated with CHED, DOST-SEI, or UniFAST?",
    a: "No. IskolarMatch is independent and unofficial. We link to each provider's own site so you always apply through the official source, never a third-party form.",
  },
  {
    q: "How do you keep the information accurate?",
    a: "Every scholarship is verified and stamped with the date it was last checked, and we monitor official sources for changes. The Data freshness page shows exactly how current the whole directory is.",
  },
  {
    q: "What happens to the answers I put in the matching form?",
    a: "They're used only for that one request, to check what you qualify for. They're never saved to a database and never leave your session -- close the tab and they're gone.",
  },
  {
    q: "How do the matching results work?",
    a: "We check your answers against each scholarship's published eligibility rules deterministically -- no AI guessing. You'll see Eligible, Near-miss (one requirement away), or Not eligible, so you can focus where it counts.",
  },
  {
    q: "Can I apply through IskolarMatch?",
    a: "No, and that's on purpose. We send you to the provider's official application page. IskolarMatch helps you find and track scholarships; the provider handles the actual application.",
  },
  {
    q: "How do reminders work?",
    a: "Save a scholarship while signed in, and you can opt into an email or browser reminder before its deadline. You control which ones remind you, and you can turn them off anytime.",
  },
  {
    q: "I found something wrong in a listing. What do I do?",
    a: "Use the \"Report an issue\" link on that scholarship's page. Reports go straight to the people who keep the data accurate and are the fastest way to get a fix.",
  },
];

export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Questions</p>
          <h1 className="reveal mt-2 font-serif text-4xl font-light leading-tight sm:text-5xl">
            Frequently asked.
          </h1>
          <p className="reveal reveal-delay-1 mt-4 text-muted">
            The short version of how IskolarMatch works and what it does with your information.
          </p>

          <dl className="mt-12 flex flex-col divide-y divide-line">
            {FAQS.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-serif text-xl font-light leading-snug">{item.q}</dt>
                <dd className="mt-2 text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-12 border-t border-line pt-8">
            <p className="text-muted">
              Still stuck? Read{" "}
              <Link href="/about" className="link-trace text-ink">
                how it works
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="link-trace text-ink">
                get in touch
              </Link>
              .
            </p>
            <PillLink href="/match" variant="solid" className="mt-6">
              Find my scholarships →
            </PillLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
