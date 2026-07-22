"use server";

import { z } from "zod";
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

// Validate the client-supplied subscription before it reaches the DB, matching
// the .strict() Zod convention every sibling action uses (docs/SECURITY.md
// §3.4). RLS/FK constraints already scope the row, but shape validation gives a
// clear rejection instead of a raw constraint error on a malformed payload.
const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().url(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

// FR18 (docs/PRD.md §4.3): stores a browser's Web Push subscription,
// owner-scoped via the session (never a caller-supplied user id, mirroring
// saveScholarship's convention -- docs/SECURITY.md §3.4). Upserted on
// endpoint so re-subscribing the same browser is idempotent.
export async function subscribeToPush(subscription: PushSubscriptionInput): Promise<void> {
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success) {
    throw new Error("Invalid push subscription payload.");
  }

  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) throw new Error("Failed to save push subscription.");
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  const parsed = z.string().url().safeParse(endpoint);
  if (!parsed.success) {
    throw new Error("Invalid push subscription endpoint.");
  }

  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", parsed.data);

  if (error) throw new Error("Failed to remove push subscription.");
}
