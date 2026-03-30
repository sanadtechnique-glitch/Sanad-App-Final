import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { playSanadSound, unlockAudio } from "./notification-sound";

export interface Notification {
  id: string;
  type: "accepted" | "delivered" | "driver_accepted" | "driver_picked_up" | "driver_coming" | "info";
  orderId: number;
  messageAr: string;
  messageFr: string;
  timestamp: number;
  read: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clearAll: () => void;
}

// Storage keys
export const CUSTOMER_KEY = "dc_notifications";
export const ADMIN_KEY    = "dc_admin_notif";
export const providerKey  = (id: number) => `dc_prov_notif_${id}`;

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "[]"); }
    catch { return []; }
  });

  const prevIdsRef = useRef<Set<string>>(
    new Set((notifications).map(n => n.id))
  );

  useEffect(() => {
    const unlock = () => { unlockAudio(); };
    window.addEventListener("click",      unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click",      unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const stored: Notification[] = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "[]");
        const newUnread = stored.filter(n => !n.read && !prevIdsRef.current.has(n.id));
        if (newUnread.length > 0) {
          playSanadSound();
          newUnread.forEach(n => prevIdsRef.current.add(n.id));
        }
        setNotifications(prev => {
          if (stored.length !== prev.length || stored[0]?.id !== prev[0]?.id) return stored;
          return prev;
        });
      } catch {}
    }, 2500);
    return () => clearInterval(poll);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.setItem(CUSTOMER_KEY, "[]");
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

// ── Generic push to any key ──────────────────────────────────────────────────
function pushToKey(key: string, n: Omit<Notification, "id" | "timestamp" | "read">) {
  try {
    const existing: Notification[] = JSON.parse(localStorage.getItem(key) || "[]");
    const item: Notification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      read: false,
    };
    localStorage.setItem(key, JSON.stringify([item, ...existing].slice(0, 30)));
  } catch {}
}

// ── Customer notification ────────────────────────────────────────────────────
export function pushNotification(n: Omit<Notification, "id" | "timestamp" | "read">) {
  pushToKey(CUSTOMER_KEY, n);
}

// ── Provider notification ────────────────────────────────────────────────────
export function pushProviderNotif(providerId: number, n: Omit<Notification, "id" | "timestamp" | "read">) {
  pushToKey(providerKey(providerId), n);
}

// ── Admin notification ───────────────────────────────────────────────────────
export function pushAdminNotif(n: Omit<Notification, "id" | "timestamp" | "read">) {
  pushToKey(ADMIN_KEY, n);
}

// ── Read notifications for a specific key (for polling hooks) ───────────────
export function readNotifKey(key: string): Notification[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}

export function markNotifKeyRead(key: string) {
  try {
    const existing = readNotifKey(key).map(n => ({ ...n, read: true }));
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}
