"use client";

import Link from "next/link";
import { useTransition } from "react";
import { PillLink } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { cancelReminder, setReminderFormAction, unsaveScholarship } from "@/lib/actions/saved";
import { ApplicationStatusControl } from "@/components/saved/application-status-control";
import { ApplicationNotes } from "@/components/saved/application-notes";
import type { SavedScholarshipItem } from "@/lib/data/get-saved-scholarships";

const LEAD_DAY_OPTIONS = [3, 7, 14, 30];

export function SavedItem({ item }: { item: SavedScholarshipItem }) {
  const [isPending, startTransition] = useTransition();

  const progressPct =
    item.requirementTotal > 0 ? Math.round((item.requirementDone / item.requirementTotal) * 100) : 0;

  return (
    <li className="border-b border-line py-8">
      <p className="text-sm text-muted">{item.providerName}</p>
      <h3 className="font-serif text-2xl font-light leading-tight sm:text-3xl">{item.title}</h3>
      {item.closesAt && (
        <div className="mt-2">
          <StatusDot status={item.status} closesAt={item.closesAt} opensAt={item.opensAt} />
        </div>
      )}

      {/* FR21: application status */}
      <div className="mt-4">
        <ApplicationStatusControl scholarshipId={item.scholarshipId} status={item.applicationStatus} />
      </div>

      {/* FR21: requirement-checklist progress, links to the detail checklist */}
      {item.requirementTotal > 0 && (
        <Link
          href={`/s/${item.slug}#requirements`}
          className="mt-4 flex items-center gap-3"
          aria-label={`${item.requirementDone} of ${item.requirementTotal} requirements done`}
        >
          <span className="h-2 w-40 overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full bg-ink" style={{ width: `${progressPct}%` }} />
          </span>
          <span className="text-sm text-muted">
            {item.requirementDone}/{item.requirementTotal} requirements
          </span>
        </Link>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <PillLink href={`/s/${item.slug}`} variant="outline">
          View
        </PillLink>

        <button
          disabled={isPending}
          onClick={() => startTransition(() => unsaveScholarship(item.scholarshipId))}
          className="text-sm text-muted underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      <form action={setReminderFormAction.bind(null, item.scholarshipId)} className="mt-4 flex items-center gap-3">
        <label htmlFor={`lead-days-${item.scholarshipId}`} className="text-sm text-muted">
          Remind me
        </label>
        <select
          id={`lead-days-${item.scholarshipId}`}
          name="lead_days"
          defaultValue={item.reminder?.leadDays ?? 7}
          className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm"
        >
          {LEAD_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} days before
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-[44px] rounded-full border border-ink px-4 text-sm">
          {item.reminder ? "Update" : "Set reminder"}
        </button>
        {item.reminder && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => cancelReminder(item.scholarshipId))}
            className="text-sm text-muted underline disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </form>

      {/* FR21: private per-scholarship note */}
      <ApplicationNotes scholarshipId={item.scholarshipId} notes={item.notes} />
    </li>
  );
}
