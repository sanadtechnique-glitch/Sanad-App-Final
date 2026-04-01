import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import {
  Power, Clock, Truck, Star, RefreshCw, MessageCircle, ChevronRight,
  Bell, LogOut, Package, Check, X, MapPin, Image as ImageIcon, History,
  Plus, Trash2, Pencil, Tag, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { NotificationBell } from "@/components/notification-bell";
import { get, patch, post, del } from "@/lib/admin-api";
import { pushNotification, readNotifKey, markNotifKeyRead, providerKey, type Notification } from "@/lib/notifications";
import { playSanadSound, unlockAudio } from "@/lib/notification-sound";

interface Supplier { id: number; name: string; nameAr: string; category: string; isAvailable: boolean; shift?: string; rating?: number; phone?: string; }
interface Order { id: number; customerName: string; customerPhone?: string; customerAddress: string; notes?: string; status: string; createdAt: string; deliveryFee?: number; photoUrl?: string; }

const STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  pending:         { ar: "قيد الانتظار",       fr: "En attente",          color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  accepted:        { ar: "مقبول",              fr: "Accepté",             color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  prepared:        { ar: "جاهز للتوصيل",      fr: "Prêt à livrer",       color: "text-[#1A4D1F] border-[#1A4D1F]/30 bg-[#1A4D1F]/10" },
  driver_accepted: { ar: "سائق في الطريق",    fr: "Livreur en route",    color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  in_delivery:     { ar: "تم الاستلام · في الطريق", fr: "Récupéré · En route", color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  delivered:       { ar: "تم التوصيل",         fr: "Livré",               color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  cancelled:       { ar: "ملغي",               fr: "Annulé",              color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

// ── Product type ──────────────────────────────────────────────────────────────
interface Product { id: number; providerId: number; title: string; description?: string; imageUrl?: string; category?: string; originalPrice?: string; salePrice?: string; isAvailable: boolean; createdAt: string; }

// ── Products Management Component ─────────────────────────────────────────────
function ProductsManager({ providerId, t, lang }: { providerId: number; t: (ar: string, fr: string) => string; lang: string }) {
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [saving, setSaving]       = useState(false);
  const EMPTY = { title: "", description: "", imageUrl: "", category: "", originalPrice: "", salePrice: "", isAvailable: true };
  const [form, setForm]           = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try { setProducts(await get<Product[]>(`/provider/${providerId}/products`)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [providerId]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description || "", imageUrl: p.imageUrl || "", category: p.category || "", originalPrice: p.originalPrice || "", salePrice: p.salePrice || "", isAvailable: p.isAvailable });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, originalPrice: form.originalPrice ? Number(form.originalPrice) : null, salePrice: form.salePrice ? Number(form.salePrice) : null };
      if (editing) await patch(`/provider/${providerId}/products/${editing.id}`, payload);
      else await post(`/provider/${providerId}/products`, payload);
      await load(); setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف المنتج؟", "Supprimer le produit?"))) return;
    await del(`/provider/${providerId}/products/${id}`); await load();
  };

  const toggleAvail = async (p: Product) => {
    await patch(`/provider/${providerId}/products/${p.id}`, { isAvailable: !p.isAvailable });
    await load();
  };

  const hasSale = (p: Product) => {
    const o = parseFloat(p.originalPrice ?? "0");
    const s = parseFloat(p.salePrice ?? "0");
    return o > 0 && s > 0 && s < o;
  };

  const pct = (p: Product) => {
    const o = parseFloat(p.originalPrice ?? "0");
    const s = parseFloat(p.salePrice ?? "0");
    return o > 0 && s > 0 ? Math.round(((o - s) / o) * 100) : 0;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-[#1A4D1F]">{t("منتجاتي", "Mes produits")}</h3>
          <p className="text-xs text-[#1A4D1F]/40">{products.length} {t("منتج", "produit(s)")}</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-black" style={{ background: "#1A4D1F" }}>
          <Plus size={13} /> {t("إضافة", "Ajouter")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#1A4D1F] border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package size={32} className="mx-auto mb-2 text-[#1A4D1F]/20" />
          <p className="text-sm font-black text-[#1A4D1F]/30">{t("لم تضف منتجات بعد", "Aucun produit")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <motion.div key={p.id} layout className="rounded-2xl border overflow-hidden" style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.15)" }}>
              <div className="flex gap-3 p-3" dir="rtl">
                {/* Image */}
                <div className="w-14 h-14 rounded-xl flex-shrink-0 border border-[#1A4D1F]/10 bg-[#1A4D1F]/5 flex items-center justify-center overflow-hidden relative">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                    : <ImageIcon size={18} className="text-[#1A4D1F]/20" />
                  }
                  {hasSale(p) && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded-bl-lg rounded-tr-lg">
                      -{pct(p)}%
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-black text-sm text-[#1A4D1F] truncate flex-1">{p.title}</p>
                  </div>
                  {p.category && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1A4D1F]/40 bg-[#1A4D1F]/5 px-1.5 py-0.5 rounded-full">
                      <Tag size={8} />{p.category}
                    </span>
                  )}
                  {/* Prices */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {p.salePrice && (
                      <span className="text-sm font-black text-[#1A4D1F]">{parseFloat(p.salePrice).toFixed(3)} TND</span>
                    )}
                    {p.originalPrice && hasSale(p) && (
                      <span className="text-xs font-bold line-through" style={{ color: "#9CA3AF" }}>{parseFloat(p.originalPrice).toFixed(3)}</span>
                    )}
                    {p.originalPrice && !hasSale(p) && !p.salePrice && (
                      <span className="text-sm font-black text-[#1A4D1F]">{parseFloat(p.originalPrice).toFixed(3)} TND</span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleAvail(p)}>
                    {p.isAvailable
                      ? <ToggleRight size={20} className="text-green-500" />
                      : <ToggleLeft size={20} className="text-[#1A4D1F]/20" />
                    }
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1 rounded-lg hover:bg-[#1A4D1F]/10 transition-all">
                    <Pencil size={13} className="text-[#1A4D1F]/40" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
              {p.description && (
                <p className="px-3 pb-3 text-xs text-[#1A4D1F]/50 font-bold leading-relaxed border-t border-[#1A4D1F]/5 pt-2" dir="rtl">
                  {p.description}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ background: "#FFF3E0" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4" dir="rtl">
                <h3 className="font-black text-[#1A4D1F]">{editing ? t("تعديل المنتج", "Modifier") : t("منتج جديد", "Nouveau produit")}</h3>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-[#1A4D1F]/40" /></button>
              </div>
              <div className="space-y-3" dir="rtl">
                {[
                  { key: "title", label: t("اسم المنتج *", "Nom *"), ph: t("مثال: برغر لحم", "Ex: Burger boeuf") },
                  { key: "description", label: t("الوصف", "Description"), ph: t("وصف مختصر...", "Description courte...") },
                  { key: "imageUrl", label: t("رابط الصورة", "URL image"), ph: "https://..." },
                  { key: "category", label: t("الفئة", "Catégorie"), ph: t("مثال: مأكولات", "Ex: Alimentaire") },
                ].map(({ key, label, ph }) => (
                  <div key={key}>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{label}</label>
                    <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={ph}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                ))}
                {/* Prices */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الثمن القديم (TND)", "Prix original")}</label>
                    <input type="number" step="0.001" value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                      placeholder="0.000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الثمن الجديد (TND)", "Prix soldé")}</label>
                    <input type="number" step="0.001" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))}
                      placeholder="0.000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                </div>
                {/* Sale preview */}
                {form.originalPrice && form.salePrice && parseFloat(form.salePrice) < parseFloat(form.originalPrice) && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <span className="text-sm font-black text-red-600">-{Math.round(((parseFloat(form.originalPrice) - parseFloat(form.salePrice)) / parseFloat(form.originalPrice)) * 100)}%</span>
                    <span className="text-sm font-bold line-through text-gray-400">{parseFloat(form.originalPrice).toFixed(3)}</span>
                    <span className="text-base font-black text-[#1A4D1F]">{parseFloat(form.salePrice).toFixed(3)} TND</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-black text-[#1A4D1F]">{t("متاح للبيع", "Disponible")}</span>
                  <button onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}>
                    {form.isAvailable
                      ? <ToggleRight size={26} className="text-green-500" />
                      : <ToggleLeft size={26} className="text-[#1A4D1F]/20" />
                    }
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={save} disabled={saving || !form.title}
                  className="flex-1 py-2.5 rounded-xl text-white font-black text-sm disabled:opacity-40"
                  style={{ background: "#1A4D1F" }}>
                  {saving ? <RefreshCw size={14} className="animate-spin mx-auto" /> : t("حفظ المنتج", "Enregistrer")}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-black text-[#1A4D1F]/50 border border-[#1A4D1F]/15">
                  {t("إلغاء", "Annuler")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [tab, setTab] = useState<"pending" | "all" | "products">("pending");
  const [driverNotif, setDriverNotif] = useState<Notification | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const providerNotifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          if (count > prev) {
            setHasNewOrder(true);
            setTimeout(() => setHasNewOrder(false), 4000);
            playSanadSound();
          }
          return count;
        });
        await loadOrders(provider, true);
      } catch {}
    }, 30000);
  }, [loadOrders]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (providerNotifPollRef.current) clearInterval(providerNotifPollRef.current);
  }, []);

  const startProviderNotifPolling = useCallback((provider: Supplier) => {
    if (providerNotifPollRef.current) clearInterval(providerNotifPollRef.current);
    providerNotifPollRef.current = setInterval(() => {
      const notifs = readNotifKey(providerKey(provider.id));
      const unread = notifs.filter(n => !n.read);
      if (unread.length > 0) {
        setDriverNotif(unread[0]);
        playSanadSound();
        markNotifKeyRead(providerKey(provider.id));
        setTimeout(() => setDriverNotif(null), 6000);
      }
    }, 5000);
  }, []);

  const selectProvider = async (provider: Supplier) => {
    setSelected(provider); setTab("pending");
    await loadOrders(provider);
    startPolling(provider);
    startProviderNotifPolling(provider);
  };

  const updateStatus = async (orderId: number, status: string) => {
    await patch(`/orders/${orderId}`, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (["accepted", "cancelled"].includes(status)) setPendingCount(prev => Math.max(0, prev - 1));
    if (status === "accepted") {
      pushNotification({
        type: "accepted",
        orderId,
        messageAr: `تم قبول طلبك رقم #${orderId.toString().padStart(4, "0")} ✅`,
        messageFr: `Votre commande #${orderId.toString().padStart(4, "0")} a été acceptée ✅`,
      });
    }
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#1A4D1F]/15 border-2 border-[#1A4D1F]/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_-8px_rgba(46,125,50,0.5)]">
              <Package size={28} className="text-[#1A4D1F]" />
            </div>
            <h1 className="text-3xl font-black text-[#1A4D1F] mb-2">{t("لوحة المزود", "Tableau Fournisseur")}</h1>
            <p className="text-[#1A4D1F]/40">{t("اختر اسمك للدخول", "Sélectionnez votre profil")}</p>
          </motion.div>
          <div className="space-y-2">
            {providers.map((p, i) => (
              <motion.button key={p.id}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => selectProvider(p)}
                className="w-full rounded-[15px] p-4 flex items-center justify-between gap-3 border border-[#1A4D1F]/30 hover:border-[#1A4D1F]/40 transition-all group card-hover"
                style={{ background: "#FFFDE7" }}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0",
                    p.isAvailable ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-400")} />
                  <div className="text-right">
                    <p className="font-black text-[#1A4D1F] group-hover:text-[#1A4D1F] transition-colors">{p.nameAr}</p>
                    <p className="text-xs text-[#1A4D1F]/30">{p.isAvailable ? t("مفتوح", "Ouvert") : t("مغلق", "Fermé")}</p>
                  </div>
                </div>
                <ChevronRight size={16} className={cn("text-[#1A4D1F]/20 group-hover:text-[#1A4D1F]", isRTL && "rotate-180")} />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */
  return (
    <div className="min-h-screen p-4 pb-8" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>

      {/* New order toast */}
      <AnimatePresence>
        {hasNewOrder && (
          <motion.div initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -60 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border border-[#1A4D1F]/40 shadow-xl"
            style={{ background: "#D4A800" }}>
            <Bell size={18} className="text-[#1A4D1F]" />
            <span className="text-[#1A4D1F] font-black text-sm">{t("🔔 طلب جديد وصل!", "🔔 Nouvelle commande!")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver notification toast */}
      <AnimatePresence>
        {driverNotif && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-4 flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-xl"
            style={{ background: "#FFFDE7", borderColor: "#FFA500" }}>
            <Truck size={18} className="text-[#FFA500] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[#1A4D1F] font-black text-sm">
                {lang === "ar" ? driverNotif.messageAr : driverNotif.messageFr}
              </p>
            </div>
            <button onClick={() => setDriverNotif(null)} className="text-[#1A4D1F]/30 hover:text-[#1A4D1F] flex-shrink-0 mt-0.5">
              <X size={14} />
            </button>
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
              className="max-w-sm w-full rounded-2xl border border-[#1A4D1F]/10" alt="prescription" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-[15px] p-5 border border-[#1A4D1F]/25" style={{ background: "#FFFDE7" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-[#1A4D1F]">{selected.nameAr}</h1>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30">
                    <Bell size={10} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-400">{pendingCount}</span>
                  </span>
                )}
              </div>
              {selected.rating && (
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={11} className={i <= Math.round(selected.rating!) ? "text-[#1A4D1F] fill-[#1A4D1F]" : "text-[#1A4D1F]/20"} />)}
                  <span className="text-xs text-[#1A4D1F]/40 ml-1">{selected.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <NotificationBell lang={lang} role="provider" providerId={selected.id} />
              <button
                onClick={() => navigate("/orders/history")}
                className="p-2.5 rounded-xl border border-[#1A4D1F]/20 text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:border-[#1A4D1F]/50 transition-all"
                title={t("سجل الطلبات", "Historique")}
              >
                <History size={14} />
              </button>
              <button onClick={() => loadOrders(selected, true)} disabled={refreshing}
                className="p-2.5 rounded-xl border border-[#1A4D1F]/10 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-all">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              <button onClick={logout}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-sm transition-all"
                style={{ background: "#1A4D1F", color: "#000" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1A4D1F")}
                onMouseLeave={e => (e.currentTarget.style.background = "#1A4D1F")}>
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
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1A4D1F]/5">
            <div className="text-center">
              <p className="text-2xl font-black text-amber-400">{pendingOrders.length}</p>
              <p className="text-xs text-[#1A4D1F]/30">{t("انتظار", "En attente")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-blue-400">{orders.filter(o => ["accepted","prepared","in_delivery"].includes(o.status)).length}</p>
              <p className="text-xs text-[#1A4D1F]/30">{t("نشط", "En cours")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === "delivered").length}</p>
              <p className="text-xs text-[#1A4D1F]/30">{t("منجز", "Livré")}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "#FFFDE7" }}>
          {(["pending", "all", "products"] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              className={cn("flex-1 py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5",
                tab === tb ? "bg-[#1A4D1F] text-black" : "text-[#1A4D1F]/40 hover:text-[#1A4D1F]")}>
              {tb === "pending"
                ? <>{t("جديد", "Nouv.")} {pendingOrders.length > 0 && <span className={cn("px-1.5 py-0.5 rounded-full text-xs", tab === tb ? "bg-[#FFA500]/20 text-black" : "bg-amber-400/20 text-amber-400")}>{pendingOrders.length}</span>}</>
                : tb === "all"
                  ? t("الطلبات", "Commandes")
                  : <><Package size={11} />{t("المنتجات", "Produits")}</>
              }
            </button>
          ))}
        </div>

        {/* Products Manager */}
        {tab === "products" && (
          <ProductsManager providerId={selected.id} t={t} lang={lang} />
        )}

        {/* Orders */}
        {tab !== "products" && (loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="text-[#1A4D1F]/10 mx-auto mb-3" />
            <p className="text-[#1A4D1F]/25 font-bold">
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
                      order.status === "pending" ? "border-amber-400/25" : "border-[#1A4D1F]/30")}
                    style={{ background: "#FFFDE7" }}>

                    {/* Order header */}
                    <div className={cn("px-4 py-2 flex items-center justify-between border-b border-[#1A4D1F]/20",
                      order.status === "pending" ? "bg-amber-400/5" : "")}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#1A4D1F]/25">#{order.id.toString().padStart(4, "0")}</span>
                        <span className="text-xs text-[#1A4D1F]/20">{timeAgo(order.createdAt, lang)}</span>
                      </div>
                      <span className={cn("text-xs px-2.5 py-1 rounded-full border font-black", s.color)}>
                        {lang === "ar" ? s.ar : s.fr}
                      </span>
                    </div>

                    {/* Order body */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1A4D1F]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-[#1A4D1F]/40 flex-shrink-0" />
                            <p className="text-sm text-[#1A4D1F]/40 truncate">{order.customerAddress}</p>
                          </div>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-[#1A4D1F] font-bold mt-1">{t("رسوم التوصيل", "Livraison")}: {order.deliveryFee} TND</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-[#1A4D1F]/30 mt-2 p-2 rounded-lg border border-[#1A4D1F]/5" style={{ background: "#D4A800" }}>{order.notes}</p>
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
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/30 font-black text-sm hover:bg-[#1A4D1F]/20 transition-all"
                          style={{ color: "#1A4D1F" }}>
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
        ))}
      </div>
    </div>
  );
}
