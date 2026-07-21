// FR18 (docs/PRD.md §4.3): minimal Web Push service worker -- shows a
// notification on push, opens the linked scholarship/saved page on click.
// No caching/offline strategy: this app is server-rendered and doesn't need
// one, so the worker's only job is push handling.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "IskolarMatch";
  const options = {
    body: data.body || "You have a deadline reminder.",
    data: { url: data.url || "/saved" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/saved";
  event.waitUntil(self.clients.openWindow(url));
});
