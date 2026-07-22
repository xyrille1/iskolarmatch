import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getScholarship } from "@/lib/data/get-scholarship";
import { StatusDot } from "@/components/ui/status-dot";
import { OfficialLinkPill } from "@/components/detail/official-link-pill";
import { Disclaimer } from "@/components/detail/disclaimer";
import { RequirementChecklist } from "@/components/detail/requirement-checklist";
import { SaveReminderControls } from "@/components/detail/save-reminder-controls";
import { ApplicationStatusControl } from "@/components/saved/application-status-control";
import { ReportIssueForm } from "@/components/detail/report-issue-form";
import type { ApplicationStatus } from "@/lib/types/application-tracker";
import { PillLink } from "@/components/ui/pill";
import { verifiedEyebrowLabel } from "@/lib/trust/verified-eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Reads the caller's auth cookie to show Save/Set-reminder state -- never
// statically prerenderable.
export const dynamic = "force-dynamic";

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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isSaved = false;
  let reminder: { leadDays: number } | null = null;
  let checkedRequirementIds: string[] = [];
  let applicationStatus: ApplicationStatus = "interested";

  if (user) {
    const { data: savedRow } = await supabase
      .from("saved_scholarships")
      .select("id")
      .eq("scholarship_id", scholarship.id)
      .maybeSingle();
    isSaved = Boolean(savedRow);

    const { data: reminderRow } = await supabase
      .from("reminders")
      .select("lead_days")
      .eq("scholarship_id", scholarship.id)
      .maybeSingle();
    reminder = reminderRow ? { leadDays: reminderRow.lead_days } : null;

    // FR21: which of this scholarship's requirements the signed-in user has
    // already checked off. RLS scopes this to the owner; we filter to this
    // scholarship's requirement ids so the client only receives what it renders.
    const requirementIds = scholarship.requirements.map((r) => r.id);
    if (requirementIds.length > 0) {
      const { data: checkoffRows } = await supabase
        .from("requirement_checkoffs")
        .select("requirement_id")
        .in("requirement_id", requirementIds);
      checkedRequirementIds = (checkoffRows ?? []).map((c) => c.requirement_id as string);
    }

    // FR21: current application status for this scholarship (absence = "interested").
    const { data: progressRow } = await supabase
      .from("application_progress")
      .select("status")
      .eq("scholarship_id", scholarship.id)
      .maybeSingle();
    if (progressRow) applicationStatus = progressRow.status as ApplicationStatus;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <Link href="/match" className="link-trace text-sm text-muted">
            ‹ Back to results
          </Link>

          <p className="mt-6 text-sm text-muted">{scholarship.providerName}</p>
          <h1 className="reveal font-serif text-4xl font-light leading-tight sm:text-5xl">{scholarship.title}</h1>

          {primaryCycle && (
            <div className="mt-3">
              <StatusDot
                status={primaryCycle.status}
                closesAt={primaryCycle.closesAt}
                opensAt={primaryCycle.opensAt}
              />
            </div>
          )}

          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
            {verifiedEyebrowLabel(scholarship.lastVerifiedAt)}
          </p>

          <div className="mt-6">
            {user ? (
              <div className="flex flex-col gap-4">
                <SaveReminderControls scholarshipId={scholarship.id} isSaved={isSaved} reminder={reminder} />
                <ApplicationStatusControl scholarshipId={scholarship.id} status={applicationStatus} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <PillLink href={`/auth?next=/s/${scholarship.slug}`} variant="outline">
                  Save
                </PillLink>
                <PillLink href={`/auth?next=/s/${scholarship.slug}`} variant="outline">
                  Set reminder
                </PillLink>
              </div>
            )}
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
            <section id="requirements" className="mt-12 scroll-mt-24">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Requirements</h2>
                {!user && (
                  <Link
                    href={`/auth?next=/s/${scholarship.slug}`}
                    className="text-sm text-muted underline hover:text-ink"
                  >
                    Sign in to save your progress
                  </Link>
                )}
              </div>
              <div className="mt-3">
                <RequirementChecklist
                  requirements={scholarship.requirements.map((r) => ({
                    id: r.id,
                    label: r.label,
                    isMandatory: r.isMandatory,
                  }))}
                  initialChecked={checkedRequirementIds}
                  isSignedIn={Boolean(user)}
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
            <OfficialLinkPill
              url={scholarship.applicationUrl ?? scholarship.officialUrl}
              label="Apply on official site"
            />
          </div>

          <div className="mt-8">
            <ReportIssueForm scholarshipId={scholarship.id} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
