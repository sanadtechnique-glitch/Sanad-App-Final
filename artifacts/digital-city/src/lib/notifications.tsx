import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { playSanadSound, unlockAudio } from "./notification-sound";

export interface Notification {
  id: string;
  type: "accepted" | "delivered";
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

const KEY = "dc_notifications";

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
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
        const stored: Notification[] = JSON.parse(localStorage.getItem(KEY) || "[]");

        const newUnread = stored.filter(
          n => !n.read && !prevIdsRef.current.has(n.id)
        );

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
      localStorage.setItem(KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.setItem(KEY, "[]");
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

export function pushNotification(n: Omit<Notification, "id" | "timestamp" | "read">) {
  try {
    const existing: Notification[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    const item: Notification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      read: false,
    };
    localStorage.setItem(KEY, JSON.stringify([item, ...existing].slice(0, 30)));
  } catch {}
}
