import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSavedScholarships } from "@/lib/data/get-saved-scholarships";
import { SavedItem } from "@/components/saved/saved-item";
import { PushNotificationToggle } from "@/components/saved/push-notification-toggle";
import { ShareListControls } from "@/components/saved/share-list-controls";
import { PillLink } from "@/components/ui/pill";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getMySavedListShareSlug } from "@/lib/data/get-saved-list-share";
import { getSavedProfileStatus } from "@/lib/data/get-saved-profile-status";
import { DigestStatus } from "@/components/saved/digest-status";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Saved — IskolarMatch" };
// Per-user, session-dependent -- never statically prerenderable.
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/saved");
  }

  const [items, shareSlug, profileStatus] = await Promise.all([
    getSavedScholarships(),
    getMySavedListShareSlug(),
    getSavedProfileStatus(),
  ]);
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="reveal font-serif text-4xl font-light leading-tight sm:text-5xl">Saved.</h1>
          {items.length > 0 && (
            <p className="mt-3 max-w-[52ch] text-muted">
              Your application tracker. Set each one&apos;s status, tick off requirements, add notes, and get
              a reminder before the deadline.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <PushNotificationToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
          </div>

          {items.length > 0 && (
            <div className="mt-4">
              <ShareListControls initialSlug={shareSlug} siteUrl={siteUrl()} />
            </div>
          )}

          {profileStatus.hasSavedProfile && (
            <div className="mt-4">
              <DigestStatus status={profileStatus} />
            </div>
          )}

          {items.length === 0 ? (
            <div className="mt-8 border border-line p-8">
              <p className="max-w-[46ch] text-muted">
                Nothing saved yet. Find scholarships you qualify for and save the ones you want to track.
              </p>
              <PillLink href="/match" variant="outline" className="mt-6">
                Find my scholarships →
              </PillLink>
            </div>
          ) : (
            <ul className="mt-8">
              {items.map((item) => (
                <SavedItem key={item.scholarshipId} item={item} />
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
