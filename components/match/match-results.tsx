"use client";

import { useState } from "react";
import Link from "next/link";
import { PillLink } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import type { MatchProfileResult, ScholarshipMatch } from "@/lib/actions/match-profile";

function ScholarshipTile({ match }: { match: ScholarshipMatch }) {
  return (
    <li className="border-b border-line py-8">
      <p className="text-sm text-muted">{match.providerName}</p>
      <h3 className="font-serif text-2xl font-light leading-tight sm:text-3xl">{match.title}</h3>
      <div className="mt-2">
        <StatusDot status={match.status} closesAt={match.closesAt} opensAt={match.opensAt} />
      </div>
      {match.whyChips.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Why</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {match.whyChips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-line px-3 py-1 text-sm"
              >
                {chip} ✓
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-sm text-muted">{match.requirementCount} requirements</p>
      <PillLink href={`/s/${match.slug}`} variant="outline" className="mt-4">
        View &amp; apply
      </PillLink>
    </li>
  );
}

function NearMissTile({ match }: { match: ScholarshipMatch }) {
  return (
    <li className="border-b border-line py-8">
      <p className="text-sm text-muted">{match.providerName}</p>
      <h3 className="font-serif text-2xl font-light leading-tight sm:text-3xl">{match.title}</h3>
      <div className="mt-2">
        <StatusDot status={match.status} closesAt={match.closesAt} opensAt={match.opensAt} />
      </div>
      {match.gapExplainer && (
        <p className="mt-4 text-sm">
          <span className="font-medium">One step away:</span> needs {match.gapExplainer}
        </p>
      )}
      <PillLink href={`/s/${match.slug}`} variant="outline" className="mt-4">
        View details
      </PillLink>
    </li>
  );
}

export function MatchResults({
  results,
  onStartOver,
}: {
  results: MatchProfileResult;
  onStartOver: () => void;
}) {
  const [showNotEligible, setShowNotEligible] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <button onClick={onStartOver} className="text-sm text-muted underline">
        ‹ Start over
      </button>

      <p className="sticky top-16 z-10 mt-6 border-b border-line bg-paper py-3 text-sm">
        {results.eligible.length} eligible · {results.nearMiss.length} near · {results.notEligible.length} not
        eligible
      </p>

      {results.eligible.length === 0 && results.nearMiss.length === 0 && (
        <div className="mt-12 border border-line p-8 text-center">
          <p className="font-serif text-2xl font-light">No matches yet -- and that&apos;s useful to know.</p>
          <p className="mt-2 text-muted">
            Answer a few more questions to unlock matches, or check back as new scholarships are verified.
          </p>
        </div>
      )}

      {results.eligible.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Eligible</h2>
          <ul className="mt-4 sm:grid sm:grid-cols-2 sm:gap-x-8">
            {results.eligible.map((m) => (
              <ScholarshipTile key={m.scholarshipId} match={m} />
            ))}
          </ul>
        </section>
      )}

      {results.nearMiss.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Near-miss</h2>
          <ul className="mt-4 sm:grid sm:grid-cols-2 sm:gap-x-8">
            {results.nearMiss.map((m) => (
              <NearMissTile key={m.scholarshipId} match={m} />
            ))}
          </ul>
        </section>
      )}

      {results.notEligible.length > 0 && (
        <section className="mt-12">
          {!showNotEligible ? (
            <button
              onClick={() => setShowNotEligible(true)}
              className="min-h-[44px] rounded-full border border-ink px-6 py-3 text-sm"
            >
              Show {results.notEligible.length} you don&apos;t qualify for
            </button>
          ) : (
            <>
              <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Not eligible</h2>
              <ul className="mt-4 sm:grid sm:grid-cols-2 sm:gap-x-8">
                {results.notEligible.map((m) => (
                  <ScholarshipTile key={m.scholarshipId} match={m} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <p className="mt-12 text-sm text-muted">
        <Link href="/privacy" className="underline">
          How we use your answers
        </Link>
      </p>
    </div>
  );
}
