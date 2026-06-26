/* Vitals — service worker for Web Push */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Vitals", body: event.data.text() };
  }
  const { title = "Vitals", body = "", url = "/", tag, badge } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/apple-icon",
      badge: badge || "/apple-icon",
      tag,
      data: { url },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client && client.url.includes(url)) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
