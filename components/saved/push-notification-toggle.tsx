"use client";

import { useEffect, useState } from "react";
import { PillButton } from "@/components/ui/pill";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/actions/push";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

// FR18 (docs/PRD.md §4.3): free Web Push as an alternative/addition to
// email reminders. Renders nothing when the browser doesn't support the
// Push API (degrades silently rather than showing a broken control).
export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [supported] = useState(
    () =>
      Boolean(vapidPublicKey) &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
  );
  const [subscribed, setSubscribed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(existing));
    });
  }, [supported]);

  async function handleEnable() {
    if (!vapidPublicKey) return;
    setIsPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await subscribeToPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
      setSubscribed(true);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDisable() {
    setIsPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setIsPending(false);
    }
  }

  if (!supported) return null;

  return (
    <PillButton
      type="button"
      variant={subscribed ? "solid" : "outline"}
      disabled={isPending}
      onClick={subscribed ? handleDisable : handleEnable}
    >
      {subscribed ? "Push notifications on ✓" : "Enable push notifications"}
    </PillButton>
  );
}
