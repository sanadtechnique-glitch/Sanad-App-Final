import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

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

  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const stored: Notification[] = JSON.parse(localStorage.getItem(KEY) || "[]");
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
