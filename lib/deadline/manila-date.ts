// Deadline correctness is pinned to Asia/Manila (docs/SECURITY.md
// SR-D), not the server's UTC clock -- otherwise a cycle can flip status a
// day early/late depending on where the cron happens to run.
export function getManilaTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now);
}
