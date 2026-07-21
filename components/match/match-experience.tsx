"use client";

import { useState } from "react";
import { MatchForm } from "@/components/match/match-form";
import { MatchResults } from "@/components/match/match-results";
import type { MatchProfileResult } from "@/lib/actions/match-profile";
import type { Profile } from "@/lib/types/profile";

// /match is a single route with two states (form / results), per
// docs/iskolar-ux-design.md §4.2-4.3. Profile data lives only in this
// component's state -- never in the URL, never persisted (unless a
// signed-in user explicitly opts into the FR20 digest on the results screen).
export function MatchExperience({ isSignedIn }: { isSignedIn: boolean }) {
  const [results, setResults] = useState<MatchProfileResult | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  if (results) {
    return (
      <MatchResults
        results={results}
        profile={profile}
        isSignedIn={isSignedIn}
        onStartOver={() => setResults(null)}
      />
    );
  }

  return (
    <MatchForm
      onSuccess={(state) => {
        if (state.results) setResults(state.results);
        if (state.profile) setProfile(state.profile);
      }}
    />
  );
}
