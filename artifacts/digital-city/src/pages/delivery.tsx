import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import {
  Truck, CheckCircle, MapPin, RefreshCw, ChevronRight, MessageCircle,
  LogOut, Check, Package, X, Map, Bell, Clock, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, patch } from "@/lib/admin-api";
import {
  pushNotification, pushProviderNotif, pushAdminNotif,
} from "@/lib/notifications";
import { playSanadSound, unlockAudio } from "@/lib/notification-sound";

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
}

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

// ── Incoming order notification popup ────────────────────────────────────────
function IncomingOrderPopup({
  order, onAccept, onReject, lang,
}: {
  order: Order;
  onAccept: () => void;
  onReject: () => void;
  lang: string;
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
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: "#2E7D32" }}>
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
            <div className="w-8 h-8 rounded-xl bg-[#2E7D32]/10 flex items-center justify-center flex-shrink-0">
              <Package size={14} className="text-[#2E7D32]" />
            </div>
            <div>
              <p className="font-black text-[#2E7D32] text-sm">{order.customerName}</p>
              <p className="text-xs text-[#2E7D32]/40">{order.serviceProviderName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-[#FFA500] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[#2E7D32]/70">{order.customerAddress}</p>
          </div>

          {order.deliveryFee && order.deliveryFee > 0 && (
            <div className="rounded-xl px-4 py-2.5 border border-emerald-400/30 bg-emerald-400/10">
              <p className="text-emerald-600 font-black text-sm">
                {t("رسوم التوصيل", "Frais livraison")}: {order.deliveryFee} TND
              </p>
            </div>
          )}

          {order.notes && (
            <p className="text-xs text-[#2E7D32]/40 border border-[#2E7D32]/10 rounded-xl px-3 py-2">
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
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all"
            style={{ background: "#2E7D32" }}
          >
            <Check size={16} />
            {t("قبول الطلب", "Accepter")}
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

  // Incoming notifications queue
  const [incomingQueue, setIncomingQueue] = useState<Order[]>([]);
  const seenPreparedIds = useRef<Set<number>>(new Set());
  const rejectedIds = useRef<Set<number>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      if (session?.role === "delivery" && session.staffId) {
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

      // Detect NEW prepared orders → show notification popup
      const freshPrepared = data.filter(
        o => o.status === "prepared"
           && !seenPreparedIds.current.has(o.id)
           && !rejectedIds.current.has(o.id)
      );
      if (freshPrepared.length > 0) {
        playSanadSound();
        freshPrepared.forEach(o => seenPreparedIds.current.add(o.id));
        setIncomingQueue(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          return [...prev, ...freshPrepared.filter(o => !existingIds.has(o.id))];
        });
      }
    } catch {}
    if (!silent) setLoading(false); else setRefreshing(false);
  }, []);

  const selectStaff = async (member: Staff) => {
    setSelected(member);
    await loadOrders();
    if (pollRef.current) clearInterval(pollRef.current);
    // Poll every 10s for faster notification delivery
    pollRef.current = setInterval(() => loadOrders(true), 10000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Accept incoming order ──────────────────────────────────────────────────
  const handleAcceptIncoming = async (order: Order) => {
    if (!selected) return;
    try {
      await patch(`/orders/${order.id}`, {
        status: "driver_accepted",
        deliveryStaffId: selected.id,
      });

      // Update local state
      setOrders(prev => prev.map(o =>
        o.id === order.id ? { ...o, status: "driver_accepted", deliveryStaffId: selected.id } : o
      ));
      setIncomingQueue(prev => prev.filter(o => o.id !== order.id));

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
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "delivered" } : o));

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

  const logout = () => {
    clearSession();
    setSelected(null); setOrders([]);
    if (pollRef.current) clearInterval(pollRef.current);
    navigate("/login");
  };

  // ── Staff selection screen ─────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-full max-w-sm">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2E7D32]/15 border-2 border-[#2E7D32]/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_-8px_rgba(46,125,50,0.4)]">
              <Truck size={26} className="text-[#2E7D32]" />
            </div>
            <h1 className="text-3xl font-black text-[#2E7D32] mb-2">{t("لوحة التوصيل", "Tableau Livreur")}</h1>
            <p className="text-[#2E7D32]/40">{t("اختر اسمك للدخول", "Sélectionnez votre profil")}</p>
          </motion.div>
          <div className="space-y-2">
            {staff.map((s, i) => (
              <motion.button key={s.id}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => selectStaff(s)}
                className="w-full rounded-[15px] p-4 flex items-center justify-between gap-3 border border-[#2E7D32]/30 hover:border-[#2E7D32]/40 transition-all group card-hover"
                style={{ background: "#FFFDE7" }}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full", s.isAvailable ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-400")} />
                  <div className="text-right">
                    <p className="font-black text-[#2E7D32] group-hover:text-[#2E7D32] transition-colors">{s.nameAr}</p>
                    {s.zone && <p className="text-xs text-[#2E7D32]/30">{s.zone}</p>}
                  </div>
                </div>
                <ChevronRight size={16} className={cn("text-[#2E7D32]/20 group-hover:text-[#2E7D32]", isRTL && "rotate-180")} />
              </motion.button>
            ))}
            {staff.length === 0 && (
              <p className="text-center text-[#2E7D32]/20 py-8">{t("لم يتم إضافة سائقين بعد", "Aucun livreur configuré")}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const waitingPickupOrders = orders.filter(o => o.status === "driver_accepted" && o.deliveryStaffId === selected.id);
  const inDeliveryOrders   = orders.filter(o => o.status === "in_delivery"      && o.deliveryStaffId === selected.id);
  const deliveredOrders    = orders.filter(o => o.status === "delivered"         && o.deliveryStaffId === selected.id);
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
            onAccept={() => handleAcceptIncoming(currentIncoming)}
            onReject={() => handleRejectIncoming(currentIncoming)}
          />
        )}
      </AnimatePresence>

      {/* ── Main dashboard ── */}
      <div className="min-h-screen p-4 pb-8" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Header */}
          <div className="rounded-[15px] p-5 border border-[#2E7D32]/30" style={{ background: "#FFFDE7" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-black text-[#2E7D32]">{selected.nameAr}</h1>
                <p className="text-xs text-[#2E7D32]/50">{selected.phone}</p>
                {selected.zone && <p className="text-xs text-[#2E7D32]/30 mt-0.5">{selected.zone}</p>}
              </div>
              <div className="flex gap-2">
                {incomingQueue.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E7D32]/10 border border-[#2E7D32]/20">
                    <Bell size={13} className="text-[#2E7D32] animate-bounce" />
                    <span className="text-xs font-black text-[#2E7D32]">{incomingQueue.length}</span>
                  </div>
                )}
                <button onClick={() => loadOrders(true)} disabled={refreshing}
                  className="p-2.5 rounded-xl border border-[#2E7D32]/10 text-[#2E7D32]/40 hover:text-[#2E7D32] transition-all">
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                </button>
                <button onClick={logout}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-sm text-white transition-all"
                  style={{ background: "#2E7D32" }}>
                  <LogOut size={14} />
                  <span>{t("خروج", "Déco.")}</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#2E7D32]/5">
              <div className="text-center">
                <p className="text-2xl font-black text-amber-500">{waitingPickupOrders.length}</p>
                <p className="text-xs text-[#2E7D32]/30">{t("انتظار الاستلام", "À récupérer")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-[#2E7D32]">{inDeliveryOrders.length}</p>
                <p className="text-xs text-[#2E7D32]/30">{t("في الطريق", "En route")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{deliveredOrders.length}</p>
                <p className="text-xs text-[#2E7D32]/30">{t("منجز", "Livré")}</p>
              </div>
            </div>
          </div>

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
                      <span className="font-mono text-xs text-[#2E7D32]/25">#{order.id.toString().padStart(4, "0")}</span>
                      <span className="text-xs font-black text-amber-500">{t("في الطريق للمزود", "En route prestataire")}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#2E7D32]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-amber-500/60" />
                            <p className="text-sm text-[#2E7D32]/40">{order.customerAddress}</p>
                          </div>
                          <p className="text-xs text-[#2E7D32]/50 mt-1">{t("من", "De")} {order.serviceProviderName}</p>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-emerald-500 font-bold mt-1">{t("رسوم", "Frais")}: {order.deliveryFee} TND</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-[#2E7D32]/25 mt-1">{order.notes}</p>
                          )}
                        </div>
                        {order.customerPhone && (
                          <button onClick={() => openWhatsApp(order.customerPhone)}
                            className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>
                      <button onClick={() => confirmPickup(order)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all"
                        style={{ background: "#FFA500" }}>
                        <CheckCircle size={15} />
                        {t("تأكيد الاستلام من المزود ✓", "Confirmer récupération ✓")}
                      </button>
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
                <Truck size={13} className="text-[#2E7D32]" />
                <p className="text-xs font-black text-[#2E7D32] uppercase tracking-widest">
                  {t("في التوصيل الآن", "En cours de livraison")}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-[#2E7D32]/10 text-[#2E7D32] text-xs font-black">{inDeliveryOrders.length}</span>
              </div>
              <div className="space-y-3">
                {inDeliveryOrders.map(order => (
                  <motion.div key={order.id} layout
                    className="rounded-[15px] border border-[#2E7D32]/25 overflow-hidden"
                    style={{ background: "#FFFDE7" }}>
                    <div className="px-4 py-2 border-b border-[#2E7D32]/10 flex items-center justify-between" style={{ background: "rgba(46,125,50,0.05)" }}>
                      <span className="font-mono text-xs text-[#2E7D32]/25">#{order.id.toString().padStart(4, "0")}</span>
                      <span className="text-xs font-black text-[#2E7D32]">{t("في الطريق للعميل", "En route client")}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#2E7D32]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-[#2E7D32]/40" />
                            <p className="text-sm text-[#2E7D32]/40">{order.customerAddress}</p>
                          </div>
                          <p className="text-xs text-[#2E7D32]/50 mt-1">{order.serviceProviderName}</p>
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

                      {/* GPS Map */}
                      <Suspense fallback={
                        <div className="mt-3 h-10 rounded-[12px] border border-[#2E7D32]/20 flex items-center justify-center gap-2 text-[#2E7D32]/40 text-xs font-bold" style={{ background: "#FFFDE7" }}>
                          <Map size={13} />{t("تحميل الخريطة...", "Chargement carte...")}
                        </div>
                      }>
                        <DeliveryMap address={order.customerAddress} customerName={order.customerName} />
                      </Suspense>

                      <button onClick={() => confirmDelivery(order)}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border transition-all"
                        style={{ background: "rgba(52,211,153,0.1)", color: "#10b981", borderColor: "rgba(52,211,153,0.3)" }}>
                        <Check size={15} />
                        {t("تم التسليم للعميل ✓", "Livré au client ✓")}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {waitingPickupOrders.length === 0 && inDeliveryOrders.length === 0 && !loading && (
            <div className="text-center py-14 rounded-[15px] border border-[#2E7D32]/20" style={{ background: "#FFFDE7" }}>
              <div className="w-16 h-16 rounded-2xl bg-[#2E7D32]/5 flex items-center justify-center mx-auto mb-4">
                <Package size={28} className="text-[#2E7D32]/15" />
              </div>
              <p className="text-[#2E7D32]/20 font-bold text-sm">{t("لا توجد طلبات نشطة", "Aucune commande active")}</p>
              <p className="text-[#2E7D32]/10 text-xs mt-1">{t("ستظهر إشعار عند وصول طلب جديد", "Une notification apparaîtra à la réception d'une commande")}</p>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-[3px] border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

        </div>
      </div>
    </>
  );
}
