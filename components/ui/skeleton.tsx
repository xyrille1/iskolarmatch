// Shared skeleton block for loading states (UX doc §170/§307). A single
// primitive keeps every loading screen visually consistent with the real
// layout it stands in for; compose these to mirror a page's rhythm rather
// than reaching for a lone spinner. Decorative only -- the surrounding
// container carries role="status"/aria-busy, so each block is aria-hidden.
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

// A stack of text-line skeletons at body size, last line optionally shorter
// so it reads as a paragraph rather than a filled rectangle.
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </span>
  );
}

// The provider / title / status list row shared by the browse and results
// list loading screens -- mirrors the real tile's vertical rhythm so the
// swap to loaded content doesn't shift the layout.
export function ScholarshipRowSkeleton() {
  return (
    <li className="border-b border-line py-6">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-7 w-3/4 max-w-md" />
      <Skeleton className="mt-4 h-3.5 w-40" />
    </li>
  );
}
