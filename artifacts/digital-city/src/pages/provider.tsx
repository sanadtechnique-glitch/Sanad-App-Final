import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import {
  Power, Clock, Truck, Star, RefreshCw, MessageCircle, ChevronRight,
  Bell, LogOut, Package, Check, X, MapPin, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, patch } from "@/lib/admin-api";

interface Supplier { id: number; name: string; nameAr: string; category: string; isAvailable: boolean; shift?: string; rating?: number; phone?: string; }
interface Order { id: number; customerName: string; customerPhone?: string; customerAddress: string; notes?: string; status: string; createdAt: string; deliveryFee?: number; photoUrl?: string; }

const STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  pending:     { ar: "قيد الانتظار", fr: "En attente",       color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  accepted:    { ar: "مقبول",        fr: "Accepté",           color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  prepared:    { ar: "جاهز للتوصيل", fr: "Prêt à livrer",    color: "text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10" },
  in_delivery: { ar: "في التوصيل",  fr: "En livraison",      color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  delivered:   { ar: "تم التوصيل",  fr: "Livré",             color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  cancelled:   { ar: "ملغي",        fr: "Annulé",            color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

export default function ProviderDashboard() {
  const { lang, t, isRTL } = useLang();
  const [providers, setProviders] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [, navigate] = useLocation();

  useEffect(() => {
    get<Supplier[]>("/admin/suppliers").then(list => {
      setProviders(list);
      const session = getSession();
      if (session?.role === "provider" && session.supplierId) {
        const found = list.find(s => s.id === session.supplierId);
        if (found) selectProvider(found);
      }
    }).catch(() => {});
  }, []);

  const loadOrders = useCallback(async (provider: Supplier, silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await get<Order[]>(`/provider/${provider.id}/orders`);
      setOrders(data);
      const p = data.filter(o => o.status === "pending").length;
      setPendingCount(p);
    } catch {}
    if (!silent) setLoading(false); else setRefreshing(false);
  }, []);

  const startPolling = useCallback((provider: Supplier) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { count } = await get<{ count: number }>(`/provider/${provider.id}/pending-count`);
        setPendingCount(prev => {
          if (count > prev) { setHasNewOrder(true); setTimeout(() => setHasNewOrder(false), 4000); }
          return count;
        });
        await loadOrders(provider, true);
      } catch {}
    }, 30000);
  }, [loadOrders]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const selectProvider = async (provider: Supplier) => {
    setSelected(provider); setTab("pending");
    await loadOrders(provider);
    startPolling(provider);
  };

  const updateStatus = async (orderId: number, status: string) => {
    await patch(`/orders/${orderId}`, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (["accepted", "cancelled"].includes(status)) setPendingCount(prev => Math.max(0, prev - 1));
  };

  const toggleAvailability = async () => {
    if (!selected) return;
    const res = await patch<Supplier>(`/admin/suppliers/${selected.id}/toggle`, {});
    setSelected(res);
    setProviders(prev => prev.map(p => p.id === selected.id ? res : p));
  };

  const logout = () => {
    clearSession();
    setSelected(null); setOrders([]); setPendingCount(0);
    if (pollRef.current) clearInterval(pollRef.current);
    navigate("/login");
  };

  const openWhatsApp = (phone?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
  };

  const pendingOrders = orders.filter(o => o.status === "pending");
  const displayOrders = tab === "pending" ? pendingOrders : orders;

  /* ── Provider selection screen ── */
  if (!selected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#000" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/15 border-2 border-[#D4AF37]/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_-8px_rgba(212,175,55,0.5)]">
              <Package size={28} className="text-[#D4AF37]" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{t("لوحة المزود", "Tableau Fournisseur")}</h1>
            <p className="text-white/40">{t("اختر اسمك للدخول", "Sélectionnez votre profil")}</p>
          </motion.div>
          <div className="space-y-2">
            {providers.map((p, i) => (
              <motion.button key={p.id}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => selectProvider(p)}
                className="w-full rounded-[15px] p-4 flex items-center justify-between gap-3 border border-[#333] hover:border-[#D4AF37]/40 transition-all group card-hover"
                style={{ background: "#121212" }}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0",
                    p.isAvailable ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-400")} />
                  <div className="text-right">
                    <p className="font-black text-white group-hover:text-[#D4AF37] transition-colors">{p.nameAr}</p>
                    <p className="text-xs text-white/30">{p.isAvailable ? t("مفتوح", "Ouvert") : t("مغلق", "Fermé")}</p>
                  </div>
                </div>
                <ChevronRight size={16} className={cn("text-white/20 group-hover:text-[#D4AF37]", isRTL && "rotate-180")} />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */
  return (
    <div className="min-h-screen p-4 pb-8" style={{ background: "#000" }} dir={isRTL ? "rtl" : "ltr"}>

      {/* New order toast */}
      <AnimatePresence>
        {hasNewOrder && (
          <motion.div initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -60 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border border-[#D4AF37]/40 shadow-xl"
            style={{ background: "#1a1500" }}>
            <Bell size={18} className="text-[#D4AF37]" />
            <span className="text-white font-black text-sm">{t("🔔 طلب جديد وصل!", "🔔 Nouvelle commande!")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prescription photo modal */}
      <AnimatePresence>
        {photoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.92)" }} onClick={() => setPhotoModal(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={photoModal}
              className="max-w-sm w-full rounded-2xl border border-white/10" alt="prescription" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-[15px] p-5 border border-[#D4AF37]/25" style={{ background: "#121212" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-white">{selected.nameAr}</h1>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30">
                    <Bell size={10} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-400">{pendingCount}</span>
                  </span>
                )}
              </div>
              {selected.rating && (
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={11} className={i <= Math.round(selected.rating!) ? "text-[#D4AF37] fill-[#D4AF37]" : "text-white/20"} />)}
                  <span className="text-xs text-white/40 ml-1">{selected.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => loadOrders(selected, true)} disabled={refreshing}
                className="p-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              <button onClick={logout}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-sm transition-all"
                style={{ background: "#D4AF37", color: "#000" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#C09B28")}
                onMouseLeave={e => (e.currentTarget.style.background = "#D4AF37")}>
                <LogOut size={14} />
                <span>{t("خروج", "Déco.")}</span>
              </button>
            </div>
          </div>

          {/* Open / Closed toggle */}
          <button onClick={toggleAvailability}
            className={cn("w-full flex items-center justify-center gap-3 py-3 rounded-xl font-black text-base transition-all border",
              selected.isAvailable
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20")}>
            <Power size={18} />
            {selected.isAvailable
              ? t("المحل مفتوح ← اضغط للإغلاق", "Ouvert ← Cliquez pour fermer")
              : t("المحل مغلق ← اضغط للفتح", "Fermé ← Cliquez pour ouvrir")}
          </button>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
            <div className="text-center">
              <p className="text-2xl font-black text-amber-400">{pendingOrders.length}</p>
              <p className="text-xs text-white/30">{t("انتظار", "En attente")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-blue-400">{orders.filter(o => ["accepted","prepared","in_delivery"].includes(o.status)).length}</p>
              <p className="text-xs text-white/30">{t("نشط", "En cours")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === "delivered").length}</p>
              <p className="text-xs text-white/30">{t("منجز", "Livré")}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: "#121212" }}>
          {(["pending", "all"] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              className={cn("flex-1 py-2.5 rounded-lg font-black text-sm transition-all flex items-center justify-center gap-2",
                tab === tb ? "bg-[#D4AF37] text-black" : "text-white/40 hover:text-white")}>
              {tb === "pending"
                ? <>{t("جديد", "Nouvelles")} {pendingOrders.length > 0 && <span className={cn("px-1.5 py-0.5 rounded-full text-xs", tab === tb ? "bg-black/20 text-black" : "bg-amber-400/20 text-amber-400")}>{pendingOrders.length}</span>}</>
                : t("كل الطلبات", "Toutes")
              }
            </button>
          ))}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/25 font-bold">
              {tab === "pending" ? t("لا توجد طلبات جديدة", "Aucune nouvelle commande") : t("لا توجد طلبات", "Aucune commande")}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {displayOrders.map(order => {
                const s = STATUS[order.status] ?? STATUS.pending;
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
                    className={cn("rounded-[15px] border overflow-hidden",
                      order.status === "pending" ? "border-amber-400/25" : "border-[#333]")}
                    style={{ background: "#121212" }}>

                    {/* Order header */}
                    <div className={cn("px-4 py-2 flex items-center justify-between border-b border-[#2a2a2a]",
                      order.status === "pending" ? "bg-amber-400/5" : "")}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/25">#{order.id.toString().padStart(4, "0")}</span>
                        <span className="text-xs text-white/20">{timeAgo(order.createdAt, lang)}</span>
                      </div>
                      <span className={cn("text-xs px-2.5 py-1 rounded-full border font-black", s.color)}>
                        {lang === "ar" ? s.ar : s.fr}
                      </span>
                    </div>

                    {/* Order body */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-[#D4AF37]/40 flex-shrink-0" />
                            <p className="text-sm text-white/40 truncate">{order.customerAddress}</p>
                          </div>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-[#D4AF37] font-bold mt-1">{t("رسوم التوصيل", "Livraison")}: {order.deliveryFee} TND</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-white/30 mt-2 p-2 rounded-lg border border-white/5" style={{ background: "#1a1a1a" }}>{order.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {order.customerPhone && (
                            <button onClick={() => openWhatsApp(order.customerPhone)}
                              className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all" title="WhatsApp">
                              <MessageCircle size={14} />
                            </button>
                          )}
                          {order.photoUrl && (
                            <button onClick={() => setPhotoModal(order.photoUrl!)}
                              className="p-2.5 rounded-xl bg-blue-400/10 text-blue-400 border border-blue-400/20 hover:bg-blue-400/20 transition-all" title={t("وصفة طبية", "Ordonnance")}>
                              <ImageIcon size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {order.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(order.id, "accepted")}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-sm hover:bg-emerald-500/20 transition-all">
                            <Check size={14} />{t("قبول", "Accepter")}
                          </button>
                          <button onClick={() => updateStatus(order.id, "cancelled")}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-black text-sm hover:bg-red-500/20 transition-all">
                            <X size={14} />{t("رفض", "Refuser")}
                          </button>
                        </div>
                      )}
                      {order.status === "accepted" && (
                        <button onClick={() => updateStatus(order.id, "prepared")}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 font-black text-sm hover:bg-[#D4AF37]/20 transition-all"
                          style={{ color: "#D4AF37" }}>
                          <Truck size={15} />
                          {t("جاهز للتوصيل ✓", "Prêt pour livraison ✓")}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
