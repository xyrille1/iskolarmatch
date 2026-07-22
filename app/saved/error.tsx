"use client";

import { RouteError } from "@/components/layout/route-error";

// Segment error boundary for /saved (docs/QA-CHECKLIST.md P2-03): a failed
// per-user read degrades gracefully within the segment instead of bubbling to
// the root boundary.
export default function SavedError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Your saved list didn't load." />;
}
