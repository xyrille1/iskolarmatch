import "server-only";
import webpush from "web-push";

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// Marks a subscription as gone (push service returned 404/410 -- the
// browser unsubscribed itself) so the caller can prune it. Any other
// failure just means "we couldn't send this one," not "delete the row."
export class PushSubscriptionExpiredError extends Error {}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be set.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// FR18 (docs/PRD.md §4.3): free Web Push as an alternative/addition to
// email reminders -- no per-message cost, unlike SMS.
export async function sendPushNotification(subscription: PushSubscriptionRecord, payload: PushPayload): Promise<void> {
  ensureConfigured();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      throw new PushSubscriptionExpiredError("Push subscription is no longer valid.");
    }
    throw err;
  }
}
