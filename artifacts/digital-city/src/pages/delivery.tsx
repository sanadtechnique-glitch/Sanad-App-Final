import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, CheckCircle, MapPin, Phone, RefreshCw, ChevronRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, patch } from "@/lib/admin-api";

interface Staff { id: number; name: string; nameAr: string; phone: string; zone?: string; isAvailable: boolean; }
interface Order {
  id: number; customerName: string; customerPhone?: string;
  customerAddress: string; serviceProviderName: string; serviceType: string;
  status: string; deliveryFee?: number; createdAt: string; notes?: string;
}

export default function DeliveryDashboard() {
  const { lang, t, isRTL } = useLang();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<Staff[]>("/admin/delivery-staff").then(setStaff).catch(() => {});
  }, []);

  const loadOrders = async (member: Staff) => {
    setLoading(true); setSelected(member);
    const data = await get<Order[]>(`/delivery/${member.id}/orders`).catch(() => []);
    setOrders(data); setLoading(false);
  };

  const updateStatus = async (orderId: number, status: string) => {
    await patch(`/orders/${orderId}`, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const whatsapp = (phone?: string, name?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}`, "_blank");
  };

  if (!selected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
              <Truck size={28} className="text-purple-400" />
            </div>
            <h1 className="text-2xl font-black text-white mb-1">{t("لوحة التوصيل","Tableau Livreur")}</h1>
            <p className="text-white/40 text-sm">{t("اختر اسمك للمتابعة","Sélectionnez votre nom")}</p>
          </div>
          <div className="space-y-2">
            {staff.map(s => (
              <button key={s.id} onClick={() => loadOrders(s)}
                className="w-full glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-purple-400/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", s.isAvailable ? "bg-emerald-400" : "bg-red-400")} />
                  <div>
                    <p className="font-bold text-white group-hover:text-purple-400 transition-colors text-start">{s.nameAr}</p>
                    {s.zone && <p className="text-xs text-white/30 text-start">{s.zone}</p>}
                  </div>
                </div>
                <ChevronRight size={16} className={cn("text-white/20 group-hover:text-purple-400", isRTL && "rotate-180")} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const inDelivery = orders.filter(o => o.status === "in_delivery");
  const accepted = orders.filter(o => o.status === "accepted");

  return (
    <div className="min-h-screen bg-background p-4 pb-20" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-black text-white">{selected.nameAr}</h1>
              <p className="text-xs text-white/30">{selected.phone}</p>
              {selected.zone && <p className="text-xs text-purple-400/60 mt-0.5">{selected.zone}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => loadOrders(selected)} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white"><RefreshCw size={15} /></button>
              <button onClick={() => setSelected(null)} className="px-3 py-2 rounded-xl bg-white/5 text-white/40 hover:text-white text-xs font-bold">{t("تغيير","Changer")}</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
            <div className="text-center"><p className="text-2xl font-black text-blue-400">{accepted.length}</p><p className="text-xs text-white/30">{t("مقبول","Accepté")}</p></div>
            <div className="text-center"><p className="text-2xl font-black text-purple-400">{inDelivery.length}</p><p className="text-xs text-white/30">{t("في الطريق","En route")}</p></div>
            <div className="text-center"><p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === "delivered").length}</p><p className="text-xs text-white/30">{t("منجز","Livré")}</p></div>
          </div>
        </div>

        {/* Active deliveries */}
        {[...accepted, ...inDelivery].length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">{t("توصيلات نشطة","Livraisons actives")}</h2>
            <div className="space-y-3">
              {[...accepted, ...inDelivery].map(order => (
                <motion.div key={order.id} layout className={cn("glass-panel rounded-2xl p-4 border", order.status === "in_delivery" ? "border-purple-400/20" : "border-blue-400/20")}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white">{order.customerName}</p>
                        <span className="font-mono text-xs text-white/20">#{order.id.toString().padStart(4,"0")}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin size={11} className="text-white/30" />
                        <p className="text-xs text-white/40 truncate">{order.customerAddress}</p>
                      </div>
                      <p className="text-xs text-[#D4AF37]/60 mt-1">{order.serviceProviderName}</p>
                      {order.deliveryFee && order.deliveryFee > 0 && (
                        <p className="text-xs text-emerald-400 font-bold mt-1">{t("رسوم التوصيل","Frais")}: {order.deliveryFee} TND</p>
                      )}
                    </div>
                    {order.customerPhone && (
                      <button onClick={() => whatsapp(order.customerPhone)}
                        className="p-2 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 flex-shrink-0">
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {order.status === "accepted" && (
                      <button onClick={() => updateStatus(order.id, "in_delivery")}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-400/10 text-purple-400 border border-purple-400/20 font-bold text-sm hover:bg-purple-400/20 transition-colors">
                        <Truck size={14} />{t("بدء التوصيل","Démarrer la livraison")}
                      </button>
                    )}
                    {order.status === "in_delivery" && (
                      <button onClick={() => updateStatus(order.id, "delivered")}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-bold text-sm hover:bg-emerald-400/20 transition-colors">
                        <CheckCircle size={14} />{t("تم التوصيل","Livraison terminée")}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16">
            <Truck size={40} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/20">{t("لا توجد توصيلات مسندة لك","Aucune livraison assignée")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
