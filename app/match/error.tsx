"use client";

import { RouteError } from "@/components/layout/route-error";

// Segment error boundary for /match (docs/QA-CHECKLIST.md P2-03).
export default function MatchError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="The matcher didn't load." />;
}
