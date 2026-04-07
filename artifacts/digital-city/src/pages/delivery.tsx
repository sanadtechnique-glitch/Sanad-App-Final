import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import {
  Truck, CheckCircle, MapPin, RefreshCw, ChevronRight, MessageCircle,
  LogOut, Check, Package, X, Map, Bell, Clock, AlertCircle, History,
  CalendarCheck, Banknote, ChevronDown, ChevronUp, Wifi, WifiOff, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { NotificationBell } from "@/components/notification-bell";
import { get, patch } from "@/lib/admin-api";
import { getSessionToken } from "@/lib/auth";
import {
  pushNotification, pushProviderNotif, pushAdminNotif,
} from "@/lib/notifications";
import { playSanadSound, unlockAudio } from "@/lib/notification-sound";
import { io, type Socket } from "socket.io-client";

const DeliveryMap = lazy(() => import("@/components/delivery-map"));

interface Staff {
  id: number; name: string; nameAr: string; phone: string;
  zone?: string; isAvailable: boolean;
}
interface Order {
  id: number; customerName: string; customerPhone?: string;
  customerAddress: string; serviceProviderName: string; serviceType: string;
  status: string; deliveryFee?: number; createdAt: string; notes?: string;
  serviceProviderId?: number; deliveryStaffId?: number;
  customerLat?: number | null; customerLng?: number | null;
  distanceKm?: number | null; etaMinutes?: number | null;
}

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

// ── Incoming order notification popup ────────────────────────────────────────
function IncomingOrderPopup({
  order, onAccept, onReject, lang, isAccepting,
}: {
  order: Order;
  onAccept: () => void;
  onReject: () => void;
  lang: string;
  isAccepting?: boolean;
}) {
  const t = (ar: string, fr: string) => lang === "ar" ? ar : fr;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        className="w-full max-w-sm rounded-[20px] overflow-hidden shadow-2xl"
        style={{ background: "#FFFDE7" }}
      >
        {/* Header pulse */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: "#1A4D1F" }}>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-base">{t("طلب جديد للتوصيل!", "Nouvelle commande!")}</p>
            <p className="text-white/60 text-xs">{t("اختر القبول أو الرفض", "Accepter ou refuser")}</p>
          </div>
          <div className="mr-auto ml-0">
            <span className="text-white/50 font-mono text-xs">#{order.id.toString().padStart(4, "0")}</span>
          </div>
        </div>

        {/* Order details */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1A4D1F]/10 flex items-center justify-center flex-shrink-0">
              <Package size={14} className="text-[#1A4D1F]" />
            </div>
            <div>
              <p className="font-black text-[#1A4D1F] text-sm">{order.customerName}</p>
              <p className="text-xs text-[#1A4D1F]/40">{order.serviceProviderName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-[#FFA500] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[#1A4D1F]/70">{order.customerAddress}</p>
          </div>

          {order.deliveryFee && order.deliveryFee > 0 && (
            <div className="rounded-xl px-4 py-2.5 border border-emerald-400/30 bg-emerald-400/10">
              <p className="text-emerald-600 font-black text-sm">
                {t("رسوم التوصيل", "Frais livraison")}: {order.deliveryFee} TND
              </p>
            </div>
          )}

          {order.notes && (
            <p className="text-xs text-[#1A4D1F]/40 border border-[#1A4D1F]/10 rounded-xl px-3 py-2">
              {order.notes}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-400/30 bg-red-400/10 text-red-500 font-black text-sm hover:bg-red-400/20 transition-all"
          >
            <X size={16} />
            {t("رفض", "Refuser")}
          </button>
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all disabled:opacity-70"
            style={{ background: "#1A4D1F" }}
          >
            {isAccepting
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />{t("جارٍ القبول…", "En cours…")}</>
              : <><Zap size={16} />{t("قبول الطلب الآن", "Accepter maintenant")}</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DeliveryDashboard() {
  const { lang, t, isRTL } = useLang();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistId, setExpandedHistId] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  // Incoming notifications queue
  const [incomingQueue, setIncomingQueue] = useState<Order[]>([]);
  const seenOrderIds = useRef<Set<number>>(new Set());
  const rejectedIds = useRef<Set<number>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedRef = useRef<Staff | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("click",      unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click",      unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    get<Staff[]>("/admin/delivery-staff").then(list => {
      setStaff(list);
      const session = getSession();
      if ((session?.role === "delivery" || session?.role === "driver") && session.staffId) {
        const found = list.find(s => s.id === session.staffId);
        if (found) selectStaff(found);
      }
    }).catch(() => {});
  }, []);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await get<Order[]>("/delivery/orders");
      setOrders(data);
      // Detect newly available orders (fallback for when socket misses an event)
      const fresh = data.filter(
        o => (o.status === "searching_for_driver" || o.status === "prepared")
           && !seenOrderIds.current.has(o.id)
           && !rejectedIds.current.has(o.id)
      );
      if (fresh.length > 0) {
        playSanadSound();
        fresh.forEach(o => seenOrderIds.current.add(o.id));
        setIncomingQueue(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          return [...prev, ...fresh.filter(o => !existingIds.has(o.id))];
        });
      }
    } catch {}
    if (!silent) setLoading(false); else setRefreshing(false);
  }, []);

  const loadHistory = useCallback(async (staffId: number) => {
    setHistoryLoading(true);
    try {
      const data = await get<Order[]>(`/delivery/staff/${staffId}/orders`);
      setHistory(data.filter(o => o.status === "delivered"));
    } catch {}
    setHistoryLoading(false);
  }, []);

  // ── Socket.io connection + event handlers ───────────────────────────────────
  const connectSocket = useCallback((member: Staff) => {
    if (socketRef.current?.connected) socketRef.current.disconnect();

    const socket = io(window.location.origin, {
      query: { role: "driver", userId: String(member.id) },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on("connect",    () => setWsConnected(true));
    socket.on("disconnect", () => setWsConnected(false));

    // New order broadcast from server → add to popup queue + play sound
    socket.on("new_order", (order: Order) => {
      if (rejectedIds.current.has(order.id)) return;
      if (seenOrderIds.current.has(order.id)) return;
      seenOrderIds.current.add(order.id);
      playSanadSound();
      // Also add to orders list so it shows in active tab
      setOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        return exists ? prev : [order, ...prev];
      });
      setIncomingQueue(prev => {
        const exists = prev.some(o => o.id === order.id);
        return exists ? prev : [order, ...prev];
      });
    });

    // Order taken by another driver → remove immediately from all lists
    socket.on("order_taken", ({ orderId }: { orderId: number; driverName: string }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setIncomingQueue(prev => prev.filter(o => o.id !== orderId));
      seenOrderIds.current.add(orderId);
    });

    // Generic status update
    socket.on("order_status", ({ orderId, status, order: updatedOrder }: any) => {
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status, ...(updatedOrder || {}) } : o
      ));
    });

    return socket;
  }, []);

  const selectStaff = async (member: Staff) => {
    selectedRef.current = member;
    setSelected(member);
    await loadOrders();
    loadHistory(member.id);
    // Connect Socket.io for real-time updates
    connectSocket(member);
    // Keep polling as fallback (30s instead of 10s — socket handles the real-time)
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadOrders(true), 30000);
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    socketRef.current?.disconnect();
  }, []);

  // ── Accept incoming order (ATOMIC — first come, first served) ───────────────
  const handleAcceptIncoming = async (order: Order) => {
    if (!selected || acceptingId === order.id) return;
    setAcceptingId(order.id);
    try {
      // Atomic DB transaction — only ONE driver can win
      const token = getSessionToken();
      const res = await fetch(`/api/orders/${order.id}/driver-accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        body: JSON.stringify({ staffId: selected.id }),
      });

      if (res.status === 401) {
        clearSession();
        navigate("/login");
        return;
      }
      if (res.status === 409) {
        // Another driver was faster — remove from our queue silently
        setIncomingQueue(prev => prev.filter(o => o.id !== order.id));
        setOrders(prev => prev.filter(o => o.id !== order.id));
        setAcceptingId(null);
        return;
      }
      if (!res.ok) throw new Error("accept_failed");

      // WON — update local state
      setOrders(prev => prev.map(o =>
        o.id === order.id ? { ...o, status: "driver_accepted", deliveryStaffId: selected.id } : o
      ));
      setIncomingQueue(prev => prev.filter(o => o.id !== order.id));

      // Socket.io will handle notifying other drivers (order_taken event)

      // ── Notify customer ──
      pushNotification({
        type: "driver_coming",
        orderId: order.id,
        messageAr: `السائق ${selected.nameAr} في طريقه لاستلام طلبك رقم #${order.id.toString().padStart(4, "0")} من المزود 🚗`,
        messageFr: `Le livreur ${selected.name} est en route vers le prestataire pour votre commande #${order.id.toString().padStart(4, "0")} 🚗`,
      });

      // ── Notify provider ──
      if (order.serviceProviderId) {
        pushProviderNotif(order.serviceProviderId, {
          type: "driver_coming",
          orderId: order.id,
          messageAr: `السائق ${selected.nameAr} في طريقه إليك لاستلام الطلب #${order.id.toString().padStart(4, "0")} 🚗`,
          messageFr: `Le livreur ${selected.name} arrive chez vous pour la commande #${order.id.toString().padStart(4, "0")} 🚗`,
        });
      }

      // ── Notify admin ──
      pushAdminNotif({
        type: "driver_accepted",
        orderId: order.id,
        messageAr: `السائق ${selected.nameAr} قبل الطلب #${order.id.toString().padStart(4, "0")} وفي الطريق لاستلامه`,
        messageFr: `Le livreur ${selected.name} a accepté la commande #${order.id.toString().padStart(4, "0")}`,
      });
    } catch {
      setIncomingQueue(prev => prev.filter(o => o.id !== order.id));
    } finally {
      setAcceptingId(null);
    }
  };

  // ── Reject incoming order ──────────────────────────────────────────────────
  const handleRejectIncoming = (order: Order) => {
    rejectedIds.current.add(order.id);
    setIncomingQueue(prev => prev.filter(o => o.id !== order.id));
  };

  // ── Confirm physical pickup from provider ──────────────────────────────────
  const confirmPickup = async (order: Order) => {
    await patch(`/orders/${order.id}`, { status: "in_delivery" });
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "in_delivery" } : o));

    // ── Notify customer ──
    pushNotification({
      type: "driver_picked_up",
      orderId: order.id,
      messageAr: `السائق استلم طلبك رقم #${order.id.toString().padStart(4, "0")} وهو في طريقه إليك الآن 📦🚗`,
      messageFr: `Le livreur a récupéré votre commande #${order.id.toString().padStart(4, "0")} et arrive chez vous 📦🚗`,
    });

    // ── Notify provider ──
    if (order.serviceProviderId) {
      pushProviderNotif(order.serviceProviderId, {
        type: "driver_picked_up",
        orderId: order.id,
        messageAr: `السائق استلم الطلب #${order.id.toString().padStart(4, "0")} فعلياً من متجرك ✅`,
        messageFr: `Le livreur a pris la commande #${order.id.toString().padStart(4, "0")} chez vous ✅`,
      });
    }
  };

  // ── Confirm delivery ───────────────────────────────────────────────────────
  const confirmDelivery = async (order: Order) => {
    await patch(`/orders/${order.id}`, { status: "delivered" });
    const deliveredOrder = { ...order, status: "delivered" };
    setOrders(prev => prev.map(o => o.id === order.id ? deliveredOrder : o));

    // Add immediately to history list
    setHistory(prev => {
      const exists = prev.some(o => o.id === order.id);
      return exists ? prev : [deliveredOrder, ...prev];
    });

    pushNotification({
      type: "delivered",
      orderId: order.id,
      messageAr: `تم توصيل طلبك رقم #${order.id.toString().padStart(4, "0")} بنجاح 🎉`,
      messageFr: `Votre commande #${order.id.toString().padStart(4, "0")} a été livrée avec succès 🎉`,
    });

    setTimeout(() => setOrders(prev => prev.filter(o => o.id !== order.id)), 3000);
  };

  const openWhatsApp = (phone?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
  };

  const openNavToProvider = (order: Order) => {
    const dest = encodeURIComponent(`${order.serviceProviderName}, بن قردان، تونس`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, "_blank");
  };

  const openNavToCustomer = (order: Order) => {
    if (order.customerLat && order.customerLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.customerLat},${order.customerLng}&travelmode=driving`, "_blank");
    } else {
      const dest = encodeURIComponent(`${order.customerAddress}, بن قردان، تونس`);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, "_blank");
    }
  };

  const logout = () => {
    clearSession();
    setSelected(null); setOrders([]);
    if (pollRef.current) clearInterval(pollRef.current);
    navigate("/login");
  };

  // ── If not linked to a staff record → send back to login ──────────────────
  if (!selected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-[20px] p-8 text-center"
          style={{ background: "#FFFDE7", border: "1px solid rgba(26,77,31,0.1)" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-center justify-center mx-auto mb-5">
            <Truck size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-black text-[#1A4D1F] mb-2">{t("غير مرتبط بحساب سائق", "Compte non lié")}</h2>
          <p className="text-sm text-[#1A4D1F]/40 mb-6">
            {t("حسابك غير مرتبط بأي سائق. تواصل مع المسؤول.", "Votre compte n'est pas lié à un livreur. Contactez l'admin.")}
          </p>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl font-black text-white text-sm"
            style={{ background: "#1A4D1F" }}
          >
            {t("العودة لتسجيل الدخول", "Retour à la connexion")}
          </button>
        </motion.div>
      </div>
    );
  }

  const waitingPickupOrders = orders.filter(o => o.status === "driver_accepted" && o.deliveryStaffId === selected.id);
  const inDeliveryOrders   = orders.filter(o => o.status === "in_delivery"      && o.deliveryStaffId === selected.id);
  const deliveredOrders    = orders.filter(o => o.status === "delivered"         && o.deliveryStaffId === selected.id);
  // Pool: orders available for acceptance (not yet assigned to any driver, or prepared with no driver)
  const poolOrders = orders.filter(o =>
    (o.status === "searching_for_driver" || o.status === "prepared") &&
    !o.deliveryStaffId &&
    !rejectedIds.current.has(o.id)
  );
  const currentIncoming    = incomingQueue[0] ?? null;

  return (
    <>
      {/* ── Incoming order notification popup ── */}
      <AnimatePresence>
        {currentIncoming && (
          <IncomingOrderPopup
            key={currentIncoming.id}
            order={currentIncoming}
            lang={lang}
            isAccepting={acceptingId === currentIncoming.id}
            onAccept={() => handleAcceptIncoming(currentIncoming)}
            onReject={() => handleRejectIncoming(currentIncoming)}
          />
        )}
      </AnimatePresence>

      {/* ── Main dashboard ── */}
      <div className="min-h-screen p-4 pb-8" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Header */}
          <div className="rounded-[15px] p-5 border border-[#1A4D1F]/30" style={{ background: "#FFFDE7" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-black text-[#1A4D1F]">{selected.nameAr}</h1>
                <p className="text-xs text-[#1A4D1F]/50">{selected.phone}</p>
                {selected.zone && <p className="text-xs text-[#1A4D1F]/30 mt-0.5">{selected.zone}</p>}
              </div>
              <div className="flex gap-2 items-center">
                <NotificationBell lang={lang} role="delivery" />
                {/* Real-time connection badge */}
                <div className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all",
                  wsConnected
                    ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-500"
                    : "bg-red-400/10 border-red-400/20 text-red-400"
                )}>
                  {wsConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {wsConnected ? t("مباشر","Live") : t("انتظار","...") }
                </div>
                {incomingQueue.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20">
                    <Bell size={13} className="text-[#1A4D1F] animate-bounce" />
                    <span className="text-xs font-black text-[#1A4D1F]">{incomingQueue.length}</span>
                  </div>
                )}
                <button onClick={() => loadOrders(true)} disabled={refreshing}
                  className="p-2.5 rounded-xl border border-[#1A4D1F]/10 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-all">
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                </button>
                <button onClick={logout}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-sm text-white transition-all"
                  style={{ background: "#1A4D1F" }}>
                  <LogOut size={14} />
                  <span>{t("خروج", "Déco.")}</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1A4D1F]/5">
              <div className="text-center">
                <p className="text-2xl font-black text-amber-500">{waitingPickupOrders.length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("انتظار الاستلام", "À récupérer")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-[#1A4D1F]">{inDeliveryOrders.length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("في الطريق", "En route")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{history.length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("منجز", "Livré")}</p>
              </div>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex rounded-[14px] p-1 gap-1" style={{ background: "rgba(46,125,50,0.10)" }}>
            <button
              onClick={() => setTab("active")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] font-black text-sm transition-all",
                tab === "active"
                  ? "text-white shadow-sm"
                  : "text-[#1A4D1F]/50 hover:text-[#1A4D1F]"
              )}
              style={tab === "active" ? { background: "#1A4D1F" } : {}}
            >
              <Truck size={14} />
              {t("الطلبات النشطة", "Commandes actives")}
              {(waitingPickupOrders.length + inDeliveryOrders.length) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
                  style={{
                    background: tab === "active" ? "rgba(255,255,255,0.25)" : "rgba(46,125,50,0.15)",
                    color: tab === "active" ? "#fff" : "#1A4D1F",
                  }}>
                  {waitingPickupOrders.length + inDeliveryOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setTab("history"); if (selected) loadHistory(selected.id); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] font-black text-sm transition-all",
                tab === "history"
                  ? "text-white shadow-sm"
                  : "text-[#1A4D1F]/50 hover:text-[#1A4D1F]"
              )}
              style={tab === "history" ? { background: "#1A4D1F" } : {}}
            >
              <History size={14} />
              {t("سجل التوصيلات", "Historique livraisons")}
              {history.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
                  style={{
                    background: tab === "history" ? "rgba(255,255,255,0.25)" : "rgba(46,125,50,0.15)",
                    color: tab === "history" ? "#fff" : "#1A4D1F",
                  }}>
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* ══════════════════════════════════════════════
              TAB: ACTIVE ORDERS
          ══════════════════════════════════════════════ */}
          {tab === "active" && (<>

          {/* ── Section 1: Waiting for physical pickup ── */}
          {waitingPickupOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={13} className="text-amber-500" />
                <p className="text-xs font-black text-amber-500 uppercase tracking-widest">
                  {t("في انتظار الاستلام من المزود", "À récupérer chez le prestataire")}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-500 text-xs font-black">{waitingPickupOrders.length}</span>
              </div>
              <div className="space-y-3">
                {waitingPickupOrders.map(order => (
                  <motion.div key={order.id} layout
                    className="rounded-[15px] border border-amber-400/30 overflow-hidden"
                    style={{ background: "#FFFDE7" }}>
                    <div className="px-4 py-2 border-b border-amber-400/10 flex items-center justify-between" style={{ background: "rgba(251,191,36,0.06)" }}>
                      <span className="font-mono text-xs text-[#1A4D1F]/25">#{order.id.toString().padStart(4, "0")}</span>
                      <span className="text-xs font-black text-amber-500">{t("في الطريق للمزود", "En route prestataire")}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1A4D1F]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-amber-500/60" />
                            <p className="text-sm text-[#1A4D1F]/40">{order.customerAddress}</p>
                          </div>
                          <p className="text-xs text-[#1A4D1F]/50 mt-1">{t("من", "De")} {order.serviceProviderName}</p>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-emerald-500 font-bold mt-1">{t("رسوم", "Frais")}: {order.deliveryFee} TND</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-[#1A4D1F]/25 mt-1">{order.notes}</p>
                          )}
                        </div>
                        {order.customerPhone && (
                          <button onClick={() => openWhatsApp(order.customerPhone)}
                            className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={() => openNavToProvider(order)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all border border-blue-400/30"
                          style={{ background: "rgba(59,130,246,0.08)", color: "#1A4D1F" }}
                        >
                          <MapPin size={13} className="text-blue-400" />
                          {t("الملاحة إلى المزود 🗺️", "Naviguer vers prestataire 🗺️")}
                        </button>
                        <button onClick={() => confirmPickup(order)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all"
                          style={{ background: "#FFA500" }}>
                          <CheckCircle size={15} />
                          {t("تأكيد الاستلام من المزود ✓", "Confirmer récupération ✓")}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 2: In delivery (heading to customer) ── */}
          {inDeliveryOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Truck size={13} className="text-[#1A4D1F]" />
                <p className="text-xs font-black text-[#1A4D1F] uppercase tracking-widest">
                  {t("في التوصيل الآن", "En cours de livraison")}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-[#1A4D1F]/10 text-[#1A4D1F] text-xs font-black">{inDeliveryOrders.length}</span>
              </div>
              <div className="space-y-3">
                {inDeliveryOrders.map(order => (
                  <motion.div key={order.id} layout
                    className="rounded-[15px] border border-[#1A4D1F]/25 overflow-hidden"
                    style={{ background: "#FFFDE7" }}>
                    <div className="px-4 py-2 border-b border-[#1A4D1F]/10 flex items-center justify-between" style={{ background: "rgba(46,125,50,0.05)" }}>
                      <span className="font-mono text-xs text-[#1A4D1F]/25">#{order.id.toString().padStart(4, "0")}</span>
                      <span className="text-xs font-black text-[#1A4D1F]">{t("في الطريق للعميل", "En route client")}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1A4D1F]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-[#1A4D1F]/40" />
                            <p className="text-sm text-[#1A4D1F]/40">{order.customerAddress}</p>
                          </div>
                          <p className="text-xs text-[#1A4D1F]/50 mt-1">{order.serviceProviderName}</p>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-emerald-500 font-bold mt-1">{t("رسوم", "Frais")}: {order.deliveryFee} TND</p>
                          )}
                        </div>
                        {order.customerPhone && (
                          <button onClick={() => openWhatsApp(order.customerPhone)}
                            className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>

                      {/* ETA display if available */}
                      {order.etaMinutes && (
                        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 w-fit">
                          <Clock size={11} className="text-emerald-500" />
                          <span className="text-xs font-black text-emerald-600">
                            {t(`يصل خلال ~${order.etaMinutes} دقيقة`, `Arrivée estimée: ~${order.etaMinutes} min`)}
                          </span>
                        </div>
                      )}
                      {order.distanceKm && (
                        <p className="text-xs text-[#1A4D1F]/30 mt-1">{order.distanceKm.toFixed(1)} km</p>
                      )}

                      {/* Navigation buttons */}
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={() => openNavToCustomer(order)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all border border-[#FFA500]/40"
                          style={{ background: "rgba(255,165,0,0.10)", color: "#1A4D1F" }}
                        >
                          <MapPin size={13} className="text-[#FFA500]" />
                          {t("الملاحة إلى العميل 🗺️", "Naviguer vers le client 🗺️")}
                        </button>

                        {/* GPS Map */}
                        <Suspense fallback={
                          <div className="h-10 rounded-[12px] border border-[#1A4D1F]/20 flex items-center justify-center gap-2 text-[#1A4D1F]/40 text-xs font-bold" style={{ background: "#FFFDE7" }}>
                            <Map size={13} />{t("تحميل الخريطة...", "Chargement carte...")}
                          </div>
                        }>
                          <DeliveryMap address={order.customerAddress} customerName={order.customerName} />
                        </Suspense>

                        <button onClick={() => confirmDelivery(order)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border transition-all"
                          style={{ background: "rgba(52,211,153,0.1)", color: "#10b981", borderColor: "rgba(52,211,153,0.3)" }}>
                          <Check size={15} />
                          {t("تم التسليم للعميل ✓", "Livré au client ✓")}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 3: Available Pool — orders waiting for any driver ── */}
          {poolOrders.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} className="text-[#FFA500]" />
                <p className="text-xs font-black text-[#FFA500] uppercase tracking-widest">
                  {t("طلبات متاحة للقبول", "Commandes disponibles")}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-[#FFA500]/20 text-[#FFA500] text-xs font-black">{poolOrders.length}</span>
              </div>
              <div className="space-y-3">
                {poolOrders.map(order => (
                  <motion.div key={order.id} layout
                    className="rounded-[15px] border border-[#FFA500]/40 overflow-hidden"
                    style={{ background: "#FFFDE7" }}>
                    <div className="px-4 py-2 border-b border-[#FFA500]/10 flex items-center justify-between" style={{ background: "rgba(255,165,0,0.06)" }}>
                      <span className="font-mono text-xs text-[#1A4D1F]/25">#{order.id.toString().padStart(4, "0")}</span>
                      <span className="text-xs font-black text-[#FFA500]">
                        {order.status === "prepared" ? t("📦 جاهز للاستلام", "📦 Prêt à récupérer") : t("🔔 بحث عن سائق", "🔔 Cherche livreur")}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1A4D1F]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-[#FFA500]/60" />
                            <p className="text-sm text-[#1A4D1F]/40 truncate">{order.customerAddress}</p>
                          </div>
                          <p className="text-xs text-[#1A4D1F]/50 mt-1">{t("من", "De")} {order.serviceProviderName}</p>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-emerald-500 font-bold mt-1">{t("رسوم التوصيل", "Frais de livraison")}: {order.deliveryFee} TND</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-[#1A4D1F]/30 mt-1 italic">{order.notes}</p>
                          )}
                          <p className="text-xs text-[#1A4D1F]/20 mt-1">{timeAgo(order.createdAt, lang)}</p>
                        </div>
                        {order.customerPhone && (
                          <button onClick={() => openWhatsApp(order.customerPhone)}
                            className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { rejectedIds.current.add(order.id); setOrders(prev => [...prev]); }}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm transition-all border border-red-400/30"
                          style={{ background: "rgba(239,68,68,0.07)", color: "#ef4444" }}
                        >
                          <X size={13} />
                          {t("تجاهل", "Ignorer")}
                        </button>
                        <button
                          onClick={() => handleAcceptIncoming(order)}
                          disabled={acceptingId === order.id}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-60"
                          style={{ background: "#1A4D1F" }}
                        >
                          {acceptingId === order.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <><CheckCircle size={13} />{t("قبول", "Accepter")}</>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {waitingPickupOrders.length === 0 && inDeliveryOrders.length === 0 && poolOrders.length === 0 && !loading && (
            <div className="text-center py-14 rounded-[15px] border border-[#1A4D1F]/20" style={{ background: "#FFFDE7" }}>
              <div className="w-16 h-16 rounded-2xl bg-[#1A4D1F]/5 flex items-center justify-center mx-auto mb-4">
                <Package size={28} className="text-[#1A4D1F]/15" />
              </div>
              <p className="text-[#1A4D1F]/20 font-bold text-sm">{t("لا توجد طلبات نشطة", "Aucune commande active")}</p>
              <p className="text-[#1A4D1F]/10 text-xs mt-1">{t("ستظهر إشعار عند وصول طلب جديد", "Une notification apparaîtra à la réception d'une commande")}</p>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-[3px] border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          </>)}

          {/* ══════════════════════════════════════════════
              TAB: DELIVERY HISTORY
          ══════════════════════════════════════════════ */}
          {tab === "history" && (
            <div>
              {/* Summary bar */}
              {history.length > 0 && (
                <div
                  className="rounded-[14px] px-4 py-3 mb-4 flex items-center justify-between"
                  style={{ background: "rgba(46,125,50,0.10)", border: "1px solid rgba(46,125,50,0.15)" }}
                >
                  <div className="flex items-center gap-2" dir="rtl">
                    <CalendarCheck size={15} className="text-[#1A4D1F]" />
                    <span className="text-sm font-black text-[#1A4D1F]">
                      {t(`إجمالي التوصيلات: ${history.length}`, `Total livraisons: ${history.length}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <Banknote size={14} />
                    <span className="text-sm font-black">
                      {history.reduce((sum, o) => sum + (o.deliveryFee ?? 0), 0).toFixed(2)} TND
                    </span>
                  </div>
                </div>
              )}

              {/* History loading */}
              {historyLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-[3px] border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Empty history */}
              {!historyLoading && history.length === 0 && (
                <div className="text-center py-14 rounded-[15px] border border-[#1A4D1F]/20" style={{ background: "#FFFDE7" }}>
                  <div className="w-16 h-16 rounded-2xl bg-[#1A4D1F]/5 flex items-center justify-center mx-auto mb-4">
                    <History size={28} className="text-[#1A4D1F]/15" />
                  </div>
                  <p className="text-[#1A4D1F]/30 font-bold text-sm">{t("لا يوجد سجل توصيلات بعد", "Aucun historique de livraison")}</p>
                  <p className="text-[#1A4D1F]/15 text-xs mt-1">{t("ستظهر هنا توصيلاتك المنجزة", "Vos livraisons effectuées apparaîtront ici")}</p>
                </div>
              )}

              {/* History list */}
              {!historyLoading && history.length > 0 && (
                <AnimatePresence>
                  <div className="space-y-2">
                    {history.map((order, idx) => {
                      const isExpanded = expandedHistId === order.id;
                      const dateStr = new Date(order.createdAt).toLocaleDateString(
                        lang === "ar" ? "ar-TN" : "fr-TN",
                        { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
                      );
                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="rounded-[14px] border border-emerald-400/25 overflow-hidden"
                          style={{ background: "#FFFDE7" }}
                        >
                          {/* Row — always visible */}
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-right"
                            dir="rtl"
                            onClick={() => setExpandedHistId(isExpanded ? null : order.id)}
                          >
                            {/* Green check badge */}
                            <div className="w-9 h-9 rounded-xl bg-emerald-400/15 flex items-center justify-center flex-shrink-0">
                              <CheckCircle size={16} className="text-emerald-500" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-right">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-[#1A4D1F] text-sm truncate">{order.customerName}</span>
                                <span className="font-mono text-[10px] text-[#1A4D1F]/25 flex-shrink-0">
                                  #{order.id.toString().padStart(4, "0")}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <span className="text-xs text-[#1A4D1F]/40 truncate">{order.serviceProviderName}</span>
                                {order.deliveryFee && order.deliveryFee > 0 && (
                                  <span className="text-xs font-black text-emerald-500 flex-shrink-0">
                                    +{order.deliveryFee} TND
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[#1A4D1F]/25 mt-0.5">{dateStr}</p>
                            </div>

                            {/* Expand chevron */}
                            {isExpanded
                              ? <ChevronUp size={14} className="text-[#1A4D1F]/30 flex-shrink-0" />
                              : <ChevronDown size={14} className="text-[#1A4D1F]/30 flex-shrink-0" />}
                          </button>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="px-4 pb-4 pt-1 space-y-2 border-t border-[#1A4D1F]/8"
                                  dir="rtl"
                                >
                                  <div className="flex items-start gap-2">
                                    <MapPin size={12} className="text-[#1A4D1F]/30 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-[#1A4D1F]/50">{order.customerAddress}</p>
                                  </div>
                                  {order.notes && (
                                    <div className="rounded-lg px-3 py-2 text-xs text-[#1A4D1F]/40 border border-[#1A4D1F]/8"
                                      style={{ background: "rgba(46,125,50,0.03)" }}>
                                      {order.notes}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                                      style={{ background: "#0D3311" }}>
                                      {t("تم التسليم", "Livré")} ✓
                                    </span>
                                    {order.customerPhone && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openWhatsApp(order.customerPhone); }}
                                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black text-white bg-green-500"
                                      >
                                        <MessageCircle size={9} />
                                        WhatsApp
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
