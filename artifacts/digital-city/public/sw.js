/* ═══════════════════════════════════════════════════════════════
   Sanad · سند  — Service Worker
   Handles:  push notifications (background)
             notification click
             basic offline cache
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = "sanad-v1";
const OFFLINE_URL = "/";

/* ── Install ─────────────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/logo.png", "/favicon.svg"])
    )
  );
  self.skipWaiting();
});

/* ── Activate ────────────────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch (network-first, fallback to cache) ────────────────── */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match(OFFLINE_URL)))
  );
});

/* ── Push ────────────────────────────────────────────────────── */
self.addEventListener("push", (event) => {
  let data = { title: "سند · Sanad", body: "لديك إشعار جديد", url: "/", icon: "/logo.png" };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/logo.png",
    badge: "/favicon.svg",
    dir: "rtl",
    lang: "ar",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "فتح · Ouvrir" },
      { action: "close", title: "إغلاق · Fermer" },
    ],
    requireInteraction: false,
    tag: data.tag || "sanad-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

/* ── Notification Click ──────────────────────────────────────── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        /* If app already open — focus it */
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        /* Otherwise — open new tab */
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

/* ── Push subscription change ────────────────────────────────── */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((sub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        })
      )
  );
});
