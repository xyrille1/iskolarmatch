import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getPendingCandidates } from "@/lib/data/get-discovery-queue";
import { getProviders } from "@/lib/data/get-providers";
import { isAllowlistedUrl } from "@/lib/security/url-allowlist";
import { slugify } from "@/lib/source-discovery/slugify";
import { COVERAGE_TYPES } from "@/lib/types/source-discovery";
import { promoteCandidateFormAction, rejectCandidateFormAction } from "@/lib/actions/discoveries";

export const metadata: Metadata = { title: "Discoveries — Admin" };
export const dynamic = "force-dynamic";

const CONFIDENCE_STYLE: Record<string, string> = {
  low: "bg-status-danger/10 text-status-danger",
  medium: "bg-status-soon/10 text-status-soon",
  high: "bg-status-open/10 text-status-open",
};

// FR22 (docs/PRD.md §4.7): curator review of newly discovered scholarships.
// Worst-confidence first. Promoting creates a DRAFT scholarship via the same
// validated admin action a curator uses by hand, then hands off to the edit
// page to add rules/requirements/deadline before publishing. Nothing here
// auto-publishes. Mirrors app/admin/suggestions/page.tsx.
export default async function DiscoveriesPage() {
  const admin = await requireAdmin();
  const [candidates, providers] = await Promise.all([getPendingCandidates(admin), getProviders(admin)]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Discovered scholarships</h1>
        <Link href="/admin" className="text-sm underline">
          Back to admin
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        New scholarships the crawler found on registered{" "}
        <Link href="/admin/source-pages" className="underline">
          source pages
        </Link>
        , worst confidence first. Review the draft, then <strong>Promote</strong> it into a draft scholarship — it stays
        unpublished until you add its rules and publish it. Nothing here goes live automatically.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No pending discoveries.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-8">
          {candidates.map((c) => {
            const draft = c.draft;
            const matchedProvider = draft.provider_name
              ? providers.find((p) => p.name.toLowerCase() === draft.provider_name!.toLowerCase())
              : undefined;
            const prefillApplicationUrl = draft.application_url && isAllowlistedUrl(draft.application_url) ? draft.application_url : "";

            return (
              <li key={c.id} className="rounded border border-line p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <a href={c.detailUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                      {draft.title || "(untitled)"}
                    </a>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[c.confidence] ?? ""}`}>
                      {c.confidence} confidence
                    </span>
                  </div>
                  <span className="text-xs text-muted">{c.sourceLabel ?? "unknown source"}</span>
                </div>

                {/* Only facts NOT editable in the promote form below, so nothing
                    is shown twice. Coverage/benefit/provider live in the form;
                    deadline/eligibility/requirements are transcribed onto the
                    edit page after promoting. */}
                <div className="mt-3 rounded bg-paper-ink p-3">
                  <p className="text-xs font-medium text-muted">Detected — add on the edit page after promoting</p>
                  <div className="mt-1 text-xs text-ink/80">
                    <span className="text-muted">Deadline: </span>
                    {draft.deadline_closes_at ?? "(none detected)"}
                    {draft.deadline_academic_year ? ` · AY ${draft.deadline_academic_year}` : ""}
                  </div>
                  {(draft.eligibility_notes.length > 0 || draft.requirement_labels.length > 0) && (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {draft.eligibility_notes.length > 0 && (
                        <div>
                          <p className="text-xs text-muted">Eligibility</p>
                          <ul className="mt-1 list-disc pl-5 text-xs text-ink/80">
                            {draft.eligibility_notes.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {draft.requirement_labels.length > 0 && (
                        <div>
                          <p className="text-xs text-muted">Requirements</p>
                          <ul className="mt-1 list-disc pl-5 text-xs text-ink/80">
                            {draft.requirement_labels.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {c.snippets.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-muted">Source evidence ({c.snippets.length} sections)</summary>
                    <div className="mt-2 flex flex-col gap-2 text-xs text-muted">
                      {c.snippets.map((s, i) => (
                        <div key={i}>
                          <span className="font-medium">{s.heading ?? "(no heading)"}: </span>
                          {s.text}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Promote: curator reviews/edits, then creates a DRAFT scholarship. */}
                <form action={promoteCandidateFormAction.bind(null, c.id)} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                  <p className="text-xs font-medium text-muted">Review &amp; promote</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Title</span>
                      <input name="title" required defaultValue={draft.title} className="rounded border border-line px-2 py-1.5" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Slug</span>
                      <input
                        name="slug"
                        required
                        defaultValue={slugify(draft.title)}
                        pattern="[a-z0-9-]+"
                        className="rounded border border-line px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Provider</span>
                      <select name="provider_id" required defaultValue={matchedProvider?.id ?? ""} className="rounded border border-line px-2 py-1.5">
                        <option value="" disabled>
                          Select a provider…
                        </option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {!matchedProvider && draft.provider_name && (
                        <span className="text-xs text-status-soon">
                          Detected “{draft.provider_name}” — no match.{" "}
                          <Link href="/admin/providers" className="underline">
                            Add it
                          </Link>{" "}
                          if needed.
                        </span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Coverage type</span>
                      <select name="coverage_type" defaultValue={draft.coverage_type} className="rounded border border-line px-2 py-1.5">
                        {COVERAGE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Summary</span>
                    <textarea name="summary" rows={2} defaultValue={draft.summary ?? ""} className="rounded border border-line px-2 py-1.5" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Benefit summary</span>
                    <input name="benefit_summary" defaultValue={draft.benefit_summary ?? ""} className="rounded border border-line px-2 py-1.5" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Official URL (allowlist-enforced)</span>
                    <input name="official_url" required defaultValue={draft.official_url} className="rounded border border-line px-2 py-1.5" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">Application URL (optional, allowlist-enforced)</span>
                    <input name="application_url" defaultValue={prefillApplicationUrl} placeholder="Leave blank if off-allowlist" className="rounded border border-line px-2 py-1.5" />
                  </label>
                  <button type="submit" className="w-fit rounded border border-ink px-3 py-1.5">
                    Promote to draft scholarship
                  </button>
                </form>

                <form action={rejectCandidateFormAction.bind(null, c.id)} className="mt-3 flex items-center gap-2">
                  <input type="text" name="reason" placeholder="Reason (optional)" className="rounded border border-line px-2 py-1 text-xs" />
                  <button type="submit" className="text-xs underline">
                    Reject
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
