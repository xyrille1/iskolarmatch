// Verified-checkmark mark (ring with a gap, checkmark breaking through it).
// currentColor so it inherits ink on light chrome / paper-ink on dark chrome
// (SiteHeader vs AppBootSplash vs AdminLayout) without a separate light/dark
// asset. Geometry mirrors public/icon.svg and app/icon.svg -- keep the three
// in sync if the mark ever changes.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <path d="M86.7 40.2A38 38 0 1 1 74.4 20.9" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M30 52L44 66L86 27"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
