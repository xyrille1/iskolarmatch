import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getProviders } from "@/lib/data/get-providers";
import { getAdminScholarshipDetail } from "@/lib/data/get-admin-scholarship-detail";
import { getPendingSuggestionCountForScholarship } from "@/lib/data/get-suggestion-counts";
import { ScholarshipForm } from "@/components/admin/scholarship-form";
import { EligibilityRulesPanel } from "@/components/admin/eligibility-rules-panel";
import { RequirementsPanel } from "@/components/admin/requirements-panel";
import { DeadlineCyclesPanel } from "@/components/admin/deadline-cycles-panel";
import { markVerified } from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Edit scholarship — Admin" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditScholarshipPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { id } = await params;

  const [providers, scholarship, pendingSuggestions] = await Promise.all([
    getProviders(admin),
    getAdminScholarshipDetail(admin, id),
    getPendingSuggestionCountForScholarship(admin, id),
  ]);
  if (!scholarship) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit: {scholarship.title}</h1>
        <form action={markVerified.bind(null, scholarship.id)}>
          <button type="submit" className="rounded border border-black px-3 py-1.5 text-sm">
            Mark verified now
          </button>
        </form>
      </div>

      {pendingSuggestions > 0 && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The source-watcher found {pendingSuggestions} pending change
          {pendingSuggestions === 1 ? "" : "s"} for this scholarship.{" "}
          <Link href="/admin/suggestions" className="font-medium underline">
            Review in the suggestion queue
          </Link>
          .
        </div>
      )}

      <div className="mt-6">
        <ScholarshipForm providers={providers} scholarship={scholarship} />
      </div>

      <EligibilityRulesPanel scholarshipId={scholarship.id} rules={scholarship.eligibilityRules} />
      <RequirementsPanel scholarshipId={scholarship.id} requirements={scholarship.requirements} />
      <DeadlineCyclesPanel scholarshipId={scholarship.id} cycles={scholarship.deadlineCycles} />
    </div>
  );
}
