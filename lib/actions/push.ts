"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be signed in.");
  }

  return { supabase, userId: user.id };
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// FR18 (docs/PRD.md §4.3): stores a browser's Web Push subscription,
// owner-scoped via the session (never a caller-supplied user id, mirroring
// saveScholarship's convention -- docs/SECURITY.md §3.4). Upserted on
// endpoint so re-subscribing the same browser is idempotent.
export async function subscribeToPush(subscription: PushSubscriptionInput): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) throw new Error("Failed to save push subscription.");
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);

  if (error) throw new Error("Failed to remove push subscription.");
}
