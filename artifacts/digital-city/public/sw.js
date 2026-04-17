/* ═══════════════════════════════════════════════════════════════
   Sanad · سند  — Service Worker v3
   Strategy:
     • App Shell  → Cache-First  (instant load after first visit)
     • API calls  → Network-Only (always fresh data)
     • Images     → Stale-While-Revalidate
     • Push + Notifications
   ═══════════════════════════════════════════════════════════════ */

const SHELL_CACHE = "sanad-shell-v3";
const IMG_CACHE   = "sanad-images-v3";
const OLD_CACHES  = ["sanad-v1", "sanad-v2", "sanad-shell-v1", "sanad-shell-v2",
                     "sanad-images-v1", "sanad-images-v2"];

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/sanad-logo-master.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

/* ── Install: pre-cache the shell ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: purge old caches ── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) =>
          OLD_CACHES.includes(k) ||
          (k.startsWith("sanad-") && k !== SHELL_CACHE && k !== IMG_CACHE)
        ).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: routing strategy ── */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;
  if (url.origin !== self.location.origin) return;

  /* API / uploads / downloads → network only */
  if (url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/uploads/") ||
      url.pathname.startsWith("/downloads/")) return;

  /* Hashed static assets (/assets/*.js, *.css) → Cache-First */
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  /* Images → Stale-While-Revalidate */
  if (/\.(png|jpg|jpeg|svg|webp|ico|gif)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  /* HTML / navigation → Cache-First, update in background */
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = (await cache.match(request)) || (await cache.match("/"));
      const networkFetch = fetch(request)
        .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => cached);
      if (cached) { event.waitUntil(networkFetch); return cached; }
      return networkFetch;
    })
  );
});

/* ── Push Notifications ── */
self.addEventListener("push", (event) => {
  let data = { title: "سند · Sanad", body: "لديك إشعار جديد", url: "/", icon: "/sanad-logo-master.png" };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch { data.body = event.data.text() || data.body; }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: data.icon, badge: "/favicon.ico",
      dir: "rtl", lang: "ar", vibrate: [200, 100, 200],
      data: { url: data.url || "/" },
      actions: [{ action: "open", title: "فتح" }, { action: "close", title: "إغلاق" }],
      tag: data.tag || "sanad-notification", renotify: true,
    })
  );
});

/* ── Notification Click ── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) { client.navigate(targetUrl); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true }).then((sub) =>
      fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
    )
  );
});
