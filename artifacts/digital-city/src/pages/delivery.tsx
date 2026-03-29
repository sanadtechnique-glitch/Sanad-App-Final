import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import { Truck, CheckCircle, MapPin, RefreshCw, ChevronRight, MessageCircle, LogOut, Check, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, patch } from "@/lib/admin-api";

interface Staff { id: number; name: string; nameAr: string; phone: string; zone?: string; isAvailable: boolean; }
interface Order {
  id: number; customerName: string; customerPhone?: string;
  customerAddress: string; serviceProviderName: string; serviceType: string;
  status: string; deliveryFee?: number; createdAt: string; notes?: string;
}

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

export default function DeliveryDashboard() {
  const { lang, t, isRTL } = useLang();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [, navigate] = useLocation();

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
    } catch {}
    if (!silent) setLoading(false); else setRefreshing(false);
  }, []);

  const selectStaff = async (member: Staff) => {
    setSelected(member);
    await loadOrders();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadOrders(true), 30000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const updateStatus = async (orderId: number, status: string, staffId?: number) => {
    const body: Record<string, unknown> = { status };
    if (staffId) body.deliveryStaffId = staffId;
    await patch(`/orders/${orderId}`, body);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (status === "delivered") {
      setTimeout(() => setOrders(prev => prev.filter(o => o.id !== orderId)), 3000);
    }
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

  /* ── Staff selection screen ── */
  if (!selected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#000" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-full max-w-sm">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border-2 border-purple-500/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_-8px_rgba(168,85,247,0.4)]">
              <Truck size={26} className="text-purple-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{t("لوحة التوصيل", "Tableau Livreur")}</h1>
            <p className="text-white/40">{t("اختر اسمك للدخول", "Sélectionnez votre profil")}</p>
          </motion.div>
          <div className="space-y-2">
            {staff.map((s, i) => (
              <motion.button key={s.id}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => selectStaff(s)}
                className="w-full rounded-[15px] p-4 flex items-center justify-between gap-3 border border-[#333] hover:border-purple-400/30 transition-all group card-hover"
                style={{ background: "#121212" }}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full", s.isAvailable ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-400")} />
                  <div className="text-right">
                    <p className="font-black text-white group-hover:text-purple-400 transition-colors">{s.nameAr}</p>
                    {s.zone && <p className="text-xs text-white/30">{s.zone}</p>}
                  </div>
                </div>
                <ChevronRight size={16} className={cn("text-white/20 group-hover:text-purple-400", isRTL && "rotate-180")} />
              </motion.button>
            ))}
            {staff.length === 0 && (
              <p className="text-center text-white/20 py-8">{t("لم يتم إضافة سائقين بعد", "Aucun livreur configuré")}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const poolOrders = orders.filter(o => o.status === "prepared");
  const myOrders   = orders.filter(o => o.status === "in_delivery");

  /* ── Delivery Dashboard ── */
  return (
    <div className="min-h-screen p-4 pb-8" style={{ background: "#000" }} dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="rounded-[15px] p-5 border border-purple-500/20" style={{ background: "#121212" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-black text-white">{selected.nameAr}</h1>
              <p className="text-xs text-purple-400/50">{selected.phone}</p>
              {selected.zone && <p className="text-xs text-white/30 mt-0.5">{selected.zone}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => loadOrders(true)} disabled={refreshing}
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
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
            <div className="text-center">
              <p className="text-2xl font-black text-blue-400">{poolOrders.length}</p>
              <p className="text-xs text-white/30">{t("متاح", "Disponible")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-purple-400">{myOrders.length}</p>
              <p className="text-xs text-white/30">{t("في الطريق", "En route")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === "delivered").length}</p>
              <p className="text-xs text-white/30">{t("منجز", "Livré")}</p>
            </div>
          </div>
        </div>

        {/* My active deliveries */}
        {myOrders.length > 0 && (
          <div>
            <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">{t("في التوصيل الآن", "En cours de livraison")}</p>
            <div className="space-y-3">
              {myOrders.map(order => (
                <motion.div key={order.id} layout
                  className="rounded-[15px] border border-purple-500/25 overflow-hidden"
                  style={{ background: "#121212" }}>
                  <div className="px-4 py-2 border-b border-purple-500/10 flex items-center justify-between" style={{ background: "rgba(168,85,247,0.05)" }}>
                    <span className="font-mono text-xs text-white/25">#{order.id.toString().padStart(4, "0")}</span>
                    <span className="text-xs font-black text-purple-400">{t("في الطريق", "En route")}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white">{order.customerName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin size={10} className="text-purple-400/40" />
                          <p className="text-sm text-white/40 truncate">{order.customerAddress}</p>
                        </div>
                        <p className="text-xs text-[#D4AF37]/50 mt-1">{order.serviceProviderName}</p>
                        {order.deliveryFee && order.deliveryFee > 0 && (
                          <p className="text-sm text-emerald-400 font-bold mt-1">{t("رسوم", "Frais")}: {order.deliveryFee} TND</p>
                        )}
                      </div>
                      {order.customerPhone && (
                        <button onClick={() => openWhatsApp(order.customerPhone)}
                          className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                          <MessageCircle size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(order.id, "delivered")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-sm hover:bg-emerald-500/20 transition-all">
                        <Check size={15} />{t("تم التوصيل ✓", "Livré ✓")}
                      </button>
                      <button onClick={() => updateStatus(order.id, "prepared")}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-black text-sm hover:bg-red-500/20 transition-all">
                        <X size={14} />{t("رفض", "Refuser")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Order pool — available to claim */}
        <div>
          <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3">
            {t("طلبات جاهزة للتوصيل", "Commandes prêtes à livrer")}
            {poolOrders.length > 0 && <span className="mr-2 px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{poolOrders.length}</span>}
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-[3px] border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : poolOrders.length === 0 ? (
            <div className="text-center py-12 rounded-[15px] border border-[#333]" style={{ background: "#121212" }}>
              <Package size={36} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/25 font-bold">{t("لا توجد طلبات جاهزة للتوصيل", "Aucune commande à livrer")}</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="space-y-3">
                {poolOrders.map(order => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
                    className="rounded-[15px] border border-blue-400/20 overflow-hidden"
                    style={{ background: "#121212" }}>
                    <div className="px-4 py-2 border-b border-blue-400/10 flex items-center justify-between" style={{ background: "rgba(96,165,250,0.04)" }}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/25">#{order.id.toString().padStart(4, "0")}</span>
                        <span className="text-xs text-white/20">{timeAgo(order.createdAt, lang)}</span>
                      </div>
                      <span className="text-xs font-black text-blue-400">{t("جاهز", "Prêt")}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-blue-400/40" />
                            <p className="text-sm text-white/40 truncate">{order.customerAddress}</p>
                          </div>
                          <p className="text-xs text-[#D4AF37]/50 mt-1">{order.serviceProviderName}</p>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-emerald-400 font-bold mt-1">{t("رسوم", "Frais")}: {order.deliveryFee} TND</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-white/25 mt-1 line-clamp-1">{order.notes}</p>
                          )}
                        </div>
                        {order.customerPhone && (
                          <button onClick={() => openWhatsApp(order.customerPhone)}
                            className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                            <MessageCircle size={14} />
                          </button>
                        )}
                      </div>
                      <button onClick={() => updateStatus(order.id, "in_delivery", selected.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-400/10 text-purple-400 border border-purple-400/20 font-black text-sm hover:bg-purple-400/20 transition-all">
                        <Truck size={15} />{t("تسلم هذا الطلب", "Prendre en charge")}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
