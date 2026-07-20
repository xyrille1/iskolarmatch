// Beyond the staleness threshold, the trust stamp flips from "VERIFIED <date>"
// to "CONFIRM ON OFFICIAL SITE" -- per docs/iskolar-ux-design.md §5 (DECIDE 5a).
export const VERIFIED_STALENESS_DAYS = 60;

export function verifiedEyebrowLabel(lastVerifiedAt: string | null): string {
  if (!lastVerifiedAt) return "CONFIRM ON OFFICIAL SITE";

  const verifiedDate = new Date(lastVerifiedAt);
  const daysSince = Math.floor((Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince > VERIFIED_STALENESS_DAYS) {
    return "CONFIRM ON OFFICIAL SITE";
  }

  const formatted = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(verifiedDate);

  return `VERIFIED ${formatted.toUpperCase()}`;
}
