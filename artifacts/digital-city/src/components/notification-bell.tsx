import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, Megaphone, Truck, Package, Check, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { get } from "@/lib/admin-api";
import {
  readNotifKey, markNotifKeyRead, CUSTOMER_KEY, ADMIN_KEY, providerKey,
  type Notification,
} from "@/lib/notifications";
import { playSanadSound, playBroadcastSound, unlockAudio } from "@/lib/notification-sound";
import { showBrowserNotification, requestNotificationPermission, getPermissionStatus } from "@/lib/push-notifications";

// ── Broadcast from server ─────────────────────────────────────────────────────
interface BroadcastRow {
  id: number; message: string; messageAr?: string;
  targetRole: string; createdAt: string;
}

// ── Unified notification item ─────────────────────────────────────────────────
interface UiNotif {
  id: string;
  kind: "order" | "broadcast";
  messageAr: string;
  messageFr: string;
  timestamp: number;
  read: boolean;
  type?: string;
}

function timeAgo(ts: number, lang: string) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  if (diff < 1440) return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
  return lang === "ar" ? `${Math.floor(diff / 1440)} ي` : `${Math.floor(diff / 1440)}j`;
}

function getIcon(n: UiNotif) {
  if (n.kind === "broadcast") return <Megaphone size={14} className="text-[#FFA500]" />;
  if (n.type === "accepted")  return <CheckCheck size={14} className="text-blue-400" />;
  if (n.type === "delivered") return <Check size={14} className="text-emerald-400" />;
  if (n.type === "driver_coming" || n.type === "driver_accepted") return <Truck size={14} className="text-orange-400" />;
  if (n.type === "driver_picked_up") return <Package size={14} className="text-purple-400" />;
  return <Bell size={14} className="text-[#1A4D1F]" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  lang: string;
  role: "client" | "provider" | "delivery" | "admin" | "super_admin" | "manager";
  providerId?: number;
  staffId?: number;
  theme?: "light" | "dark";
}

// ─────────────────────────────────────────────────────────────────────────────
export function NotificationBell({ lang, role, providerId, theme = "light" }: Props) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<UiNotif[]>([]);
  const [permDenied, setPermDenied] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const seenBroadcastIds = useRef<Set<number>>(
    new Set(JSON.parse(localStorage.getItem("dc_seen_broadcasts") || "[]"))
  );

  // Persist seen broadcast IDs
  const markBroadcastSeen = (id: number) => {
    seenBroadcastIds.current.add(id);
    localStorage.setItem("dc_seen_broadcasts", JSON.stringify([...seenBroadcastIds.current]));
  };

  // ── Storage key for this role ──────────────────────────────────────────────
  const storageKey =
    role === "client" ? CUSTOMER_KEY :
    role === "provider" && providerId ? providerKey(providerId) :
    (role === "admin" || role === "super_admin" || role === "manager") ? ADMIN_KEY :
    null;

  // ── Merge local storage notifs + broadcasts ────────────────────────────────
  const loadNotifs = useCallback(async () => {
    const localItems: UiNotif[] = storageKey
      ? readNotifKey(storageKey).map(n => ({
          id: n.id, kind: "order" as const,
          messageAr: n.messageAr, messageFr: n.messageFr,
          timestamp: n.timestamp, read: n.read, type: n.type,
        }))
      : [];

    // Fetch broadcasts from server for this role
    let broadcasts: UiNotif[] = [];
    try {
      const apiRole =
        role === "super_admin" || role === "manager" ? "admin" : role;
      const rows = await get<BroadcastRow[]>(
        `/notifications/broadcast?role=${apiRole}&since=${Date.now() - 7 * 24 * 60 * 60 * 1000}`
      );
      broadcasts = rows.map(b => ({
        id: `bc-${b.id}`, kind: "broadcast" as const,
        messageAr: b.messageAr || b.message,
        messageFr: b.message,
        timestamp: new Date(b.createdAt).getTime(),
        read: seenBroadcastIds.current.has(b.id),
        type: "broadcast",
      }));

      // Detect new broadcasts
      const newBroadcasts = rows.filter(b => !seenBroadcastIds.current.has(b.id));
      if (newBroadcasts.length > 0) {
        if (!soundMuted) playBroadcastSound();
        newBroadcasts.forEach(b => {
          showBrowserNotification(
            lang === "ar" ? "إشعار من سند" : "Notification Sanad",
            lang === "ar" ? (b.messageAr || b.message) : b.message
          );
        });
        newBroadcasts.forEach(b => markBroadcastSeen(b.id));
      }
    } catch {}

    // Detect new local notifs
    const newLocal = localItems.filter(n => !n.read && !prevIdsRef.current.has(n.id));
    if (newLocal.length > 0) {
      if (!soundMuted) playSanadSound();
      newLocal.forEach(n => {
        showBrowserNotification(
          lang === "ar" ? "سند - إشعار جديد" : "Sanad - Nouvelle notification",
          lang === "ar" ? n.messageAr : n.messageFr
        );
        prevIdsRef.current.add(n.id);
      });
    }

    // Merge + sort
    const all = [...localItems, ...broadcasts]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);
    setNotifs(all);
  }, [storageKey, role, lang, soundMuted]);

  // ── Poll every 8s ──────────────────────────────────────────────────────────
  useEffect(() => {
    unlockAudio();
    loadNotifs();
    const t = setInterval(loadNotifs, 8000);
    return () => clearInterval(t);
  }, [loadNotifs]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Check browser permission ───────────────────────────────────────────────
  useEffect(() => {
    setPermDenied(getPermissionStatus() === "denied");
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  const markAllRead = () => {
    if (storageKey) markNotifKeyRead(storageKey);
    notifs.filter(n => n.kind === "broadcast" && !n.read).forEach(n => {
      const id = parseInt(n.id.replace("bc-", ""));
      if (!isNaN(id)) markBroadcastSeen(id);
    });
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, "[]"); } catch {}
    }
    setNotifs(prev => prev.filter(n => n.kind === "broadcast"));
    setOpen(false);
  };

  const requestPerm = async () => {
    const result = await requestNotificationPermission();
    setPermDenied(result === "denied");
  };

  const textColor   = theme === "dark" ? "text-white" : "text-[#1A4D1F]";
  const borderColor = theme === "dark" ? "border-white/20" : "border-[#1A4D1F]/20";
  const bgHover     = theme === "dark" ? "hover:bg-white/10" : "hover:bg-[#1A4D1F]/10";

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open && unread > 0) markAllRead();
        }}
        className={cn(
          "relative p-2.5 rounded-xl border transition-all",
          unread > 0
            ? `${borderColor} bg-[#1A4D1F]/20 ${bgHover}`
            : `${borderColor} bg-transparent ${bgHover}`
        )}
      >
        <Bell size={18} className={unread > 0 ? "text-[#1A4D1F]" : cn(textColor, "opacity-50")} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white"
            style={{ background: "#E53935" }}
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      {/* Popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-80 rounded-2xl shadow-2xl border z-[200] overflow-hidden"
            style={{
              background: "#FFA500",
              borderColor: "rgba(46,125,50,0.3)",
              insetInlineEnd: 0,
            }}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A4D1F]/10">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-[#1A4D1F]" />
                <span className="font-black text-[#1A4D1F] text-sm">
                  {lang === "ar" ? "الإشعارات" : "Notifications"}
                </span>
                {notifs.length > 0 && (
                  <span className="text-[10px] font-bold text-[#1A4D1F]/40">({notifs.length})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Sound toggle */}
                <button
                  onClick={() => setSoundMuted(m => !m)}
                  className="p-1 rounded-lg text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors"
                  title={lang === "ar" ? (soundMuted ? "تفعيل الصوت" : "كتم الصوت") : (soundMuted ? "Activer son" : "Couper son")}
                >
                  {soundMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
                {notifs.filter(n => n.kind === "order").length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] font-bold text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    {lang === "ar" ? "مسح" : "Effacer"}
                  </button>
                )}
              </div>
            </div>

            {/* Browser permission banner */}
            {permDenied && (
              <div className="px-4 py-2 bg-red-400/10 border-b border-red-400/20 flex items-center justify-between gap-2">
                <span className="text-xs text-red-400 font-bold">
                  {lang === "ar" ? "الإشعارات محجوبة في المتصفح" : "Notifications bloquées"}
                </span>
                <button
                  onClick={requestPerm}
                  className="text-[10px] font-black text-red-400 border border-red-400/30 px-2 py-0.5 rounded-full hover:bg-red-400/10 transition-all"
                >
                  {lang === "ar" ? "تفعيل" : "Activer"}
                </button>
              </div>
            )}

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#1A4D1F]/5 border border-[#1A4D1F]/10 flex items-center justify-center">
                    <Bell size={18} className="text-[#1A4D1F]/20" />
                  </div>
                  <p className="text-[#1A4D1F]/30 text-sm font-bold">
                    {lang === "ar" ? "لا توجد إشعارات" : "Aucune notification"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#1A4D1F]/5">
                  {notifs.map(n => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "px-4 py-3 flex items-start gap-3 transition-colors",
                        !n.read ? "bg-[#1A4D1F]/8" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border",
                        n.kind === "broadcast" ? "bg-[#FFA500]/20 border-[#FFA500]/30" :
                        n.type === "accepted" ? "bg-blue-400/15 border-blue-400/20" :
                        n.type === "delivered" ? "bg-emerald-400/15 border-emerald-400/20" :
                        "bg-[#1A4D1F]/10 border-[#1A4D1F]/20"
                      )}>
                        {getIcon(n)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {n.kind === "broadcast" && (
                          <span className="text-[9px] font-black text-[#FFA500] uppercase tracking-wider block mb-0.5">
                            {lang === "ar" ? "إشعار عام" : "Broadcast"}
                          </span>
                        )}
                        <p className="text-sm font-bold text-[#1A4D1F] leading-snug">
                          {lang === "ar" ? n.messageAr : n.messageFr}
                        </p>
                        <p className="text-[10px] text-[#1A4D1F]/30 mt-0.5">{timeAgo(n.timestamp, lang)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-[#1A4D1F]/5 text-center">
              <p className="text-[10px] text-[#1A4D1F]/25">
                {lang === "ar" ? "إشعارات سند · Sanad" : "Notifications Sanad"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
