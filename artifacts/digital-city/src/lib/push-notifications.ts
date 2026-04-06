/* ══════════════════════════════════════════════════════════════
   Sanad · سند  — Web Push notification utilities
   Supports: foreground Notification API + background Web Push
   ══════════════════════════════════════════════════════════════ */
import { getSessionToken } from "@/lib/auth";


/* ── Register service worker ────────────────────────────────── */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.warn("[SW] Registration failed:", err);
    return null;
  }
}

/* ── Request permission + subscribe to Web Push ─────────────── */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") {
    await subscribeWebPush();
    return "granted";
  }
  if (Notification.permission === "denied") return "denied";

  const result = await Notification.requestPermission();
  if (result === "granted") await subscribeWebPush();
  return result;
}

/* ── Subscribe to Web Push (called after permission granted) ─── */
export async function subscribeWebPush(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    /* Fetch VAPID public key from server */
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return false;
    const { key } = await res.json() as { key: string };
    if (!key) return false;

    /* Get or create push subscription */
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    /* Send subscription to server */
    const token = getSessionToken();
    if (!token) return false;

    const postRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": token,
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    return postRes.ok;
  } catch (err) {
    console.warn("[WebPush] Subscribe failed:", err);
    return false;
  }
}

/* ── Unsubscribe from Web Push ──────────────────────────────── */
export async function unsubscribeWebPush(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    const token = getSessionToken();
    if (token) {
      await fetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": token,
        },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    }

    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/* ── Show a foreground notification (when app is open) ──────── */
export function showBrowserNotification(title: string, body: string, icon = "/logo.png") {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon,
          badge: "/favicon.svg",
          dir: "rtl",
          lang: "ar",
        });
      });
    } else {
      new Notification(title, { body, icon, badge: icon, dir: "rtl" });
    }
  } catch {}
}

/* ── Get current permission status ─────────────────────────── */
export function getPermissionStatus(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

/* ── Utility: base64url → Uint8Array (for VAPID) ─────────────── */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
