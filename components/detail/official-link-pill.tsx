import { PillLink } from "@/components/ui/pill";
import { isAllowlistedUrl } from "@/lib/security/url-allowlist";

// Anti-phishing, made visible: always shows the destination domain beneath the
// pill, rel="noopener noreferrer", allowlisted domains only (UX doc §5,
// docs/SECURITY.md §3.2). This is a UI-layer defense-in-depth check on top of the
// DB trigger that already guarantees official_url is allowlisted.
export function OfficialLinkPill({ url, label }: { url: string; label: string }) {
  if (!isAllowlistedUrl(url)) return null;

  const domain = new URL(url).hostname;

  return (
    <div className="flex flex-col items-start gap-1">
      <PillLink href={url} target="_blank" rel="noopener noreferrer" variant="solid">
        {label} →
      </PillLink>
      <span className="text-sm text-muted">{domain}</span>
    </div>
  );
}
