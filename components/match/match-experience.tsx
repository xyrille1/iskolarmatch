"use client";

import { useState } from "react";
import { MatchForm } from "@/components/match/match-form";
import { MatchResults } from "@/components/match/match-results";
import type { MatchProfileResult } from "@/lib/actions/match-profile";

// /match is a single route with two states (form / results), per
// docs/iskolar-ux-design.md §4.2-4.3. Profile data lives only in this
// component's state -- never in the URL, never persisted.
export function MatchExperience() {
  const [results, setResults] = useState<MatchProfileResult | null>(null);

  if (results) {
    return <MatchResults results={results} onStartOver={() => setResults(null)} />;
  }

  return <MatchForm onSuccess={(state) => state.results && setResults(state.results)} />;
}
