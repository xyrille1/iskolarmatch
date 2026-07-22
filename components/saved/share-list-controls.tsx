"use client";

import { useState, useTransition } from "react";
import { PillButton } from "@/components/ui/pill";
import { createSavedListShare, revokeSavedListShare } from "@/lib/actions/share";

// FR19 (docs/PRD.md §4.3): one active share link at a time -- regenerating
// replaces it, revoking clears it. The link itself only ever resolves
// through the SECURITY DEFINER RPC (lib/data/get-shared-saved-list.ts).
export function ShareListControls({ initialSlug, siteUrl }: { initialSlug: string | null; siteUrl: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [isPending, startTransition] = useTransition();

  const shareUrl = slug ? `${siteUrl}/shared/${slug}` : null;

  function regenerate() {
    startTransition(async () => {
      const result = await createSavedListShare();
      setSlug(result.slug);
    });
  }

  function revoke() {
    startTransition(async () => {
      await revokeSavedListShare();
      setSlug(null);
    });
  }

  if (!shareUrl) {
    return (
      <PillButton type="button" variant="outline" disabled={isPending} onClick={regenerate}>
        Share my list
      </PillButton>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted">
        Share link: <span className="break-all text-ink">{shareUrl}</span>
      </p>
      <div className="flex items-center gap-4">
        <PillButton type="button" variant="outline" disabled={isPending} onClick={regenerate}>
          Regenerate
        </PillButton>
        <button type="button" disabled={isPending} onClick={revoke} className="text-muted underline disabled:opacity-50">
          Revoke
        </button>
      </div>
    </div>
  );
}
