import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getScholarship } from "@/lib/data/get-scholarship";
import { StatusDot } from "@/components/ui/status-dot";
import { OfficialLinkPill } from "@/components/detail/official-link-pill";
import { Disclaimer } from "@/components/detail/disclaimer";
import { RequirementChecklist } from "@/components/detail/requirement-checklist";
import { PillLink } from "@/components/ui/pill";
import { verifiedEyebrowLabel } from "@/lib/trust/verified-eyebrow";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const scholarship = await getScholarship(slug);
  if (!scholarship) return { title: "Scholarship not found — IskolarMatch" };

  return {
    title: `${scholarship.title} — IskolarMatch`,
    description: scholarship.summary ?? undefined,
  };
}

export default async function ScholarshipDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const scholarship = await getScholarship(slug);
  if (!scholarship) notFound();

  const primaryCycle = scholarship.deadlineCycles[0];

  return (
    <div className="mx-auto max-w-[62ch] px-6 py-12">
      <Link href="/match" className="text-sm text-muted underline">
        ‹ Back to results
      </Link>

      <p className="mt-6 text-sm text-muted">{scholarship.providerName}</p>
      <h1 className="font-serif text-4xl font-light leading-tight sm:text-5xl">{scholarship.title}</h1>

      {primaryCycle && (
        <div className="mt-3">
          <StatusDot status={primaryCycle.status} closesAt={primaryCycle.closesAt} opensAt={primaryCycle.opensAt} />
        </div>
      )}

      <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {verifiedEyebrowLabel(scholarship.lastVerifiedAt)}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <PillLink href={`/auth?next=/s/${scholarship.slug}&action=save`} variant="outline">
          Save
        </PillLink>
        <PillLink href={`/auth?next=/s/${scholarship.slug}&action=remind`} variant="outline">
          Set reminder
        </PillLink>
      </div>

      {scholarship.description && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">What you get</h2>
          <p className="mt-2">{scholarship.benefitSummary ?? scholarship.description}</p>
        </section>
      )}

      {scholarship.eligibilityRules.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Who qualifies</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {scholarship.eligibilityRules.map((rule) => (
              <li key={rule.id}>
                {rule.humanLabel ?? "Eligibility requirement"}
                {!rule.isMandatory && <span className="ml-2 text-sm text-muted">(bonus)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {scholarship.requirements.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Requirements</h2>
          <div className="mt-2">
            <RequirementChecklist
              requirements={scholarship.requirements.map((r) => ({
                id: r.id,
                label: r.label,
                isMandatory: r.isMandatory,
              }))}
            />
          </div>
        </section>
      )}

      {scholarship.deadlineCycles.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Deadlines this cycle</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {scholarship.deadlineCycles.map((cycle, i) => (
              <li key={i}>
                {cycle.academicYear && <span className="text-muted">{cycle.academicYear}: </span>}
                Opens {cycle.opensAt ?? "TBA"} · Closes {cycle.closesAt}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 flex flex-col gap-4">
        <Disclaimer />
        <OfficialLinkPill url={scholarship.applicationUrl ?? scholarship.officialUrl} label="Apply on official site" />
      </div>
    </div>
  );
}
