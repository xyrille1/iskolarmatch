// Admin-segment loading UI (docs/QA-CHECKLIST.md P2-03). Renders inside
// app/admin/layout.tsx, so a slow admin read keeps the admin bar and shows a
// quiet status line rather than the public loading screen. The container owns
// role="status"/aria-busy; the pulse dot is decorative.
export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-16 text-muted"
    >
      <span aria-hidden className="h-2 w-2 animate-ping rounded-full bg-ink" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}
