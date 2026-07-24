"use client";

import { RouteError } from "@/components/layout/route-error";

// Segment error boundary for /shared/[slug] (docs/QA-CHECKLIST.md P2-03): a
// failed shared-list read degrades gracefully within the segment.
export default function SharedListError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="This shared list didn't load." />;
}
