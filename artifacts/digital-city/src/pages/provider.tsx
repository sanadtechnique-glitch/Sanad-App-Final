import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Power, CheckCircle, XCircle, Clock, Truck, Star, Sun, Moon, RefreshCw, MessageCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, patch } from "@/lib/admin-api";

interface Supplier { id: number; name: string; nameAr: string; category: string; isAvailable: boolean; shift?: string; rating?: number; phone?: string; }
interface Order { id: number; customerName: string; customerPhone?: string; customerAddress: string; notes?: string; status: string; createdAt: string; deliveryFee?: number; }

const STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  pending:     { ar: "قيد الانتظار", fr: "En attente",  color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  accepted:    { ar: "مقبول",        fr: "Accepté",      color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  in_delivery: { ar: "في التوصيل",  fr: "En livraison", color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  delivered:   { ar: "تم التوصيل",  fr: "Livré",        color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  cancelled:   { ar: "ملغي",        fr: "Annulé",       color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

export default function ProviderDashboard() {
  const { lang, t, isRTL } = useLang();
  const [providers, setProviders] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<Supplier[]>("/admin/suppliers").then(setProviders).catch(() => {});
  }, []);

  const loadOrders = async (provider: Supplier) => {
    setLoading(true); setSelected(provider);
    const data = await get<Order[]>(`/provider/${provider.id}/orders`).catch(() => []);
    setOrders(data); setLoading(false);
  };

  const updateStatus = async (orderId: number, status: string) => {
    await patch(`/orders/${orderId}`, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const toggleAvailability = async () => {
    if (!selected) return;
    await patch(`/admin/suppliers/${selected.id}/toggle`, {});
    const updated = { ...selected, isAvailable: !selected.isAvailable };
    setSelected(updated);
    setProviders(prev => prev.map(p => p.id === selected.id ? updated : p));
  };

  const whatsapp = (phone?: string, name?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}`, "_blank");
  };

  if (!selected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-black text-[#D4AF37]">DC</span>
            </div>
            <h1 className="text-2xl font-black text-white mb-1">{t("لوحة المزود","Tableau Fournisseur")}</h1>
            <p className="text-white/40 text-sm">{t("اختر اسمك للمتابعة","Sélectionnez votre nom")}</p>
          </div>
          <div className="space-y-2">
            {providers.map(p => (
              <button key={p.id} onClick={() => loadOrders(p)}
                className="w-full glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-[#D4AF37]/30 transition-all group">
                <div className={cn("flex items-center gap-3", isRTL ? "flex-row" : "flex-row")}>
                  <div className={cn("w-2 h-2 rounded-full", p.isAvailable ? "bg-emerald-400" : "bg-red-400")} />
                  <div className="text-start">
                    <p className="font-bold text-white group-hover:text-[#D4AF37] transition-colors">{p.nameAr}</p>
                    <p className="text-xs text-white/30">{p.name}</p>
                  </div>
                </div>
                <ChevronRight size={16} className={cn("text-white/20 group-hover:text-[#D4AF37]", isRTL && "rotate-180")} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pending = orders.filter(o => o.status === "pending");
  const active = orders.filter(o => ["accepted","in_delivery"].includes(o.status));

  return (
    <div className="min-h-screen bg-background p-4 pb-20" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-white">{selected.nameAr}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-bold", selected.isAvailable ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-red-400 border-red-400/30 bg-red-400/10")}>
                  {selected.isAvailable ? t("متاح","Disponible") : t("غير متاح","Indisponible")}
                </span>
                {selected.category === "pharmacy" && selected.shift && (
                  <span className="text-xs text-white/40">
                    {selected.shift === "day" ? <><Sun size={10} className="inline mr-1"/>{t("نهاري","Jour")}</> : selected.shift === "night" ? <><Moon size={10} className="inline mr-1"/>{t("ليلي","Nuit")}</> : t("الكل","Tout")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <button onClick={() => loadOrders(selected)} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors"><RefreshCw size={16} /></button>
              <button onClick={toggleAvailability}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-all",
                  selected.isAvailable ? "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20" : "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20")}>
                <Power size={14} />
                {selected.isAvailable ? t("إيقاف","Désactiver") : t("تفعيل","Activer")}
              </button>
              <button onClick={() => setSelected(null)} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors text-xs font-bold">{t("تغيير","Changer")}</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
            <div className="text-center"><p className="text-2xl font-black text-amber-400">{pending.length}</p><p className="text-xs text-white/30">{t("انتظار","En attente")}</p></div>
            <div className="text-center"><p className="text-2xl font-black text-blue-400">{active.length}</p><p className="text-xs text-white/30">{t("نشط","En cours")}</p></div>
            <div className="text-center"><p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === "delivered").length}</p><p className="text-xs text-white/30">{t("منجز","Livré")}</p></div>
          </div>
        </div>

        {/* Pending Orders */}
        {pending.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">{t("طلبات جديدة","Nouvelles commandes")} ({pending.length})</h2>
            <div className="space-y-3">
              {pending.map(order => (
                <motion.div key={order.id} layout className="glass-panel rounded-2xl p-4 border border-amber-400/20">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-white">{order.customerName}</p>
                      <p className="text-xs text-white/40 mt-0.5">{order.customerAddress}</p>
                      {order.notes && <p className="text-xs text-[#D4AF37]/60 mt-1">"{order.notes}"</p>}
                    </div>
                    <span className="text-xs text-white/30 font-mono">#{order.id.toString().padStart(4,"0")}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(order.id, "accepted")}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-bold text-sm hover:bg-emerald-400/20 transition-colors">
                      <CheckCircle size={14} />{t("قبول","Accepter")}
                    </button>
                    <button onClick={() => updateStatus(order.id, "cancelled")}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-400/10 text-red-400 border border-red-400/20 font-bold text-sm hover:bg-red-400/20 transition-colors">
                      <XCircle size={14} />{t("رفض","Refuser")}
                    </button>
                    {order.customerPhone && (
                      <button onClick={() => whatsapp(order.customerPhone)}
                        className="p-2 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* All Orders */}
        <div>
          <h2 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-3">{t("كل الطلبات","Toutes les commandes")}</h2>
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" /></div>
          ) : orders.length === 0 ? (
            <p className="text-center text-white/20 py-10">{t("لا توجد طلبات","Aucune commande")}</p>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 20).map(order => {
                const s = STATUS[order.status];
                return (
                  <div key={order.id} className="glass-panel rounded-xl p-3 flex items-center gap-3">
                    <span className="font-mono text-xs text-white/20">#{order.id.toString().padStart(4,"0")}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-bold truncate">{order.customerName}</p>
                      <p className="text-xs text-white/30 truncate">{order.customerAddress}</p>
                    </div>
                    <span className={cn("text-xs px-2 py-1 rounded-full border font-bold whitespace-nowrap", s?.color)}>
                      {lang === "ar" ? s?.ar : s?.fr}
                    </span>
                    {order.status === "accepted" && (
                      <button onClick={() => updateStatus(order.id, "in_delivery")}
                        className="p-1.5 rounded-lg bg-purple-400/10 text-purple-400 border border-purple-400/20 hover:bg-purple-400/20">
                        <Truck size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
