"use client";

import { RouteError } from "@/components/layout/route-error";

// Segment error boundary for /s/[slug] (docs/QA-CHECKLIST.md P2-03): a failed
// scholarship-detail read degrades gracefully within the segment.
export default function ScholarshipDetailError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="This scholarship didn't load." />;
}
