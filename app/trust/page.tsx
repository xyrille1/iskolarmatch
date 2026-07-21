import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getTrustStats } from "@/lib/data/get-trust-stats";
import { VERIFIED_STALENESS_DAYS } from "@/lib/trust/verified-eyebrow";

export const metadata: Metadata = { title: "Data freshness — IskolarMatch" };

// FR11 (docs/PRD.md §4.1): same rendering strategy as the landing page --
// static shell, one live aggregate read, regenerated hourly rather than
// force-dynamic (docs/ARCHITECTURE.md).
export const revalidate = 3600;

export default async function TrustPage() {
  const stats = await getTrustStats();
  const pct =
    stats.totalPublished > 0 ? Math.round((stats.verifiedWithinWindow / stats.totalPublished) * 100) : null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Data freshness</p>
          <h1 className="reveal mt-2 font-serif text-4xl font-light leading-tight sm:text-5xl">
            Every listing is verified. Here&apos;s the proof.
          </h1>
          <p className="reveal reveal-delay-1 mt-4 text-muted">
            IskolarMatch never shows a scholarship without a verified date and a link to its official source. These
            numbers are recomputed as records are curated -- not marketing copy.
          </p>

          <dl className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="border-t border-line pt-4">
              <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Published scholarships
              </dt>
              <dd className="mt-2 font-serif text-4xl font-light">{stats.totalPublished}</dd>
            </div>
            <div className="border-t border-line pt-4">
              <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Verified within {VERIFIED_STALENESS_DAYS} days
              </dt>
              <dd className="mt-2 font-serif text-4xl font-light">{pct !== null ? `${pct}%` : "—"}</dd>
            </div>
            <div className="border-t border-line pt-4">
              <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Oldest verification</dt>
              <dd className="mt-2 font-serif text-4xl font-light">
                {stats.oldestVerifiedDays !== null ? `${stats.oldestVerifiedDays}d` : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
