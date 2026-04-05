import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import {
  Power, Clock, Truck, Star, RefreshCw, MessageCircle, ChevronRight,
  Bell, LogOut, Package, Check, X, MapPin, Image as ImageIcon, History,
  Plus, Trash2, Pencil, ToggleLeft, ToggleRight, AlertTriangle, KeyRound, Calendar, Phone, Scale, FileText,
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

// ── Article type (stored in articlesTable, visible to customers) ───────────────
interface Article {
  id: number; supplierId: number;
  nameAr: string; nameFr: string;
  descriptionAr: string; descriptionFr: string;
  price: number; originalPrice?: number | null;
  photoUrl?: string | null; isAvailable: boolean; createdAt: string;
}

// ── Products Management Component ─────────────────────────────────────────────
function ProductsManager({ providerId, t, lang }: { providerId: number; t: (ar: string, fr: string) => string; lang: string }) {
  const [products, setProducts]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Article | null>(null);
  const [saving, setSaving]       = useState(false);
  const EMPTY = { nameAr: "", nameFr: "", descriptionAr: "", photoUrl: "", price: "", originalPrice: "", isAvailable: true };
  const [form, setForm]           = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try { setProducts(await get<Article[]>(`/provider/${providerId}/articles`)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [providerId]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (p: Article) => {
    setEditing(p);
    setForm({
      nameAr: p.nameAr, nameFr: p.nameFr || "",
      descriptionAr: p.descriptionAr || "", photoUrl: p.photoUrl || "",
      price: p.price ? String(p.price) : "",
      originalPrice: p.originalPrice ? String(p.originalPrice) : "",
      isAvailable: p.isAvailable,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        nameAr: form.nameAr,
        nameFr: form.nameFr || form.nameAr,
        descriptionAr: form.descriptionAr,
        descriptionFr: form.descriptionAr,
        photoUrl: form.photoUrl || null,
        price: form.price ? Number(form.price) : 0,
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        isAvailable: form.isAvailable,
      };
      if (editing) await patch(`/provider/${providerId}/articles/${editing.id}`, payload);
      else await post(`/provider/${providerId}/articles`, payload);
      await load(); setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف المنتج؟", "Supprimer le produit?"))) return;
    await del(`/provider/${providerId}/articles/${id}`); await load();
  };

  const toggleAvail = async (p: Article) => {
    await patch(`/provider/${providerId}/articles/${p.id}`, { isAvailable: !p.isAvailable });
    await load();
  };

  const hasSale = (p: Article) => {
    const o = p.originalPrice ?? 0;
    const s = p.price ?? 0;
    return o > 0 && s > 0 && s < o;
  };

  const pct = (p: Article) => {
    const o = p.originalPrice ?? 0;
    const s = p.price ?? 0;
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
                  {p.photoUrl
                    ? <img src={p.photoUrl} alt={p.nameAr} className="w-full h-full object-cover" />
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
                  <p className="font-black text-sm text-[#1A4D1F] truncate">{lang === "ar" ? p.nameAr : (p.nameFr || p.nameAr)}</p>
                  {/* Prices */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-black text-[#1A4D1F]">{p.price.toFixed(3)} TND</span>
                    {hasSale(p) && p.originalPrice && (
                      <span className="text-xs font-bold line-through" style={{ color: "#9CA3AF" }}>{p.originalPrice.toFixed(3)}</span>
                    )}
                  </div>
                  {!p.isAvailable && (
                    <span className="text-[10px] font-bold text-red-400">{t("غير متاح", "Indisponible")}</span>
                  )}
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
                {/* Arabic name (required) */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("اسم المنتج بالعربية *", "Nom en arabe *")}</label>
                  <input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                    placeholder={t("مثال: برغر لحم", "Ex: Burger boeuf")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                </div>
                {/* French name (optional) */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الاسم بالفرنسية (اختياري)", "Nom en français (opt.)")}</label>
                  <input value={form.nameFr} onChange={e => setForm(f => ({ ...f, nameFr: e.target.value }))}
                    placeholder={t("يُكمل تلقائياً من الاسم العربي", "Auto-rempli si vide")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" dir="ltr" />
                </div>
                {/* Description */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الوصف", "Description")}</label>
                  <input value={form.descriptionAr} onChange={e => setForm(f => ({ ...f, descriptionAr: e.target.value }))}
                    placeholder={t("وصف مختصر...", "Description courte...")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                </div>
                {/* Photo URL */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("رابط الصورة", "URL image")}</label>
                  <input value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" dir="ltr" />
                </div>
                {/* Prices */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الثمن (TND) *", "Prix (TND) *")}</label>
                    <input type="number" step="0.001" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الثمن الأصلي (للتخفيض)", "Prix original (promo)")}</label>
                    <input type="number" step="0.001" value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                      placeholder="0.000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                </div>
                {/* Discount preview */}
                {form.price && form.originalPrice && parseFloat(form.price) < parseFloat(form.originalPrice) && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <span className="text-sm font-black text-red-600">-{Math.round(((parseFloat(form.originalPrice) - parseFloat(form.price)) / parseFloat(form.originalPrice)) * 100)}%</span>
                    <span className="text-sm font-bold line-through text-gray-400">{parseFloat(form.originalPrice).toFixed(3)}</span>
                    <span className="text-base font-black text-[#1A4D1F]">{parseFloat(form.price).toFixed(3)} TND</span>
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
                <button onClick={save} disabled={saving || !form.nameAr || !form.price}
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
  const [tab, setTab] = useState<"pending" | "all" | "products" | "bookings" | "sos" | "lawyer">("pending");
  const [driverNotif, setDriverNotif] = useState<Notification | null>(null);
  const [carBookings, setCarBookings]       = useState<any[]>([]);
  const [sosRequests, setSosRequests]       = useState<any[]>([]);
  const [sosLoading, setSosLoading]         = useState(false);
  const [lawyerRequests, setLawyerRequests] = useState<any[]>([]);
  const [lawyerLoading, setLawyerLoading]   = useState(false);
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
    get<Supplier[]>("/suppliers").then(list => {
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

  const loadCarBookings = async (provider: Supplier) => {
    try {
      const session = getSession();
      const res = await fetch(`/api/car-rental/bookings?agencyId=${provider.id}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setCarBookings(data);
    } catch {}
  };

  const loadSosRequests = async (provider: Supplier) => {
    setSosLoading(true);
    try {
      const session = getSession();
      const lat = provider.latitude ?? "";
      const lng = provider.longitude ?? "";
      const res = await fetch(`/api/sos/nearby?lat=${lat}&lng=${lng}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setSosRequests(data);
    } catch {}
    setSosLoading(false);
  };

  const loadLawyerRequests = async (provider: Supplier) => {
    setLawyerLoading(true);
    try {
      const session = getSession();
      const res = await fetch(`/api/lawyer-requests/my/${provider.id}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setLawyerRequests(data);
    } catch {}
    setLawyerLoading(false);
  };

  const updateLawyerRequest = async (requestId: number, status: "accepted" | "rejected") => {
    const session = getSession();
    try {
      const res = await fetch(`/api/lawyer-requests/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      setLawyerRequests(prev => prev.map(r => r.id === requestId ? data : r));
    } catch {}
  };

  const acceptSos = async (sosId: number, provider: Supplier) => {
    const session = getSession();
    try {
      const res = await fetch(`/api/sos/${sosId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
        body: JSON.stringify({ providerId: provider.id, providerName: lang === "ar" ? provider.nameAr : provider.name }),
      });
      if (res.status === 409) return alert(t("تم قبول هذا الطلب مسبقاً", "Déjà accepté par un autre"));
      setSosRequests(prev => prev.map(s => s.id === sosId ? { ...s, status: "accepted", assignedProviderId: provider.id } : s));
    } catch {}
  };

  const updateCarBooking = async (bookingId: number, status: string) => {
    const session = getSession();
    await fetch(`/api/car-rental/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
      body: JSON.stringify({ status }),
    });
    setCarBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  };

  const selectProvider = async (provider: Supplier) => {
    setSelected(provider); setTab("pending");
    await loadOrders(provider);
    startPolling(provider);
    startProviderNotifPolling(provider);
    if (provider.category === "car_rental") loadCarBookings(provider);
    if (provider.category === "lawyer") loadLawyerRequests(provider);
    else loadSosRequests(provider);
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
    const res = await patch<Supplier>(`/provider/${selected.id}/toggle`, {});
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

  /* ── If not linked to a supplier → send back to login ── */
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
            <Package size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-black text-[#1A4D1F] mb-2">{t("غير مرتبط بمتجر", "Compte non lié")}</h2>
          <p className="text-sm text-[#1A4D1F]/40 mb-6">
            {t("حسابك غير مرتبط بأي متجر. تواصل مع المسؤول.", "Votre compte n'est pas lié à un magasin. Contactez l'admin.")}
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
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "#FFFDE7" }}>
          {[
            { id: "pending",  label: t("جديد","Nouv."), badge: pendingOrders.length },
            { id: "all",      label: t("الطلبات","Cmds") },
            { id: "products", label: t("منتجات","Produits"), icon: <Package size={10} /> },
            ...(selected.category === "car_rental" ? [{ id: "bookings", label: t("حجوزات","Réserv."), icon: <KeyRound size={10} /> }] : []),
            ...(selected.category === "lawyer"
              ? [{ id: "lawyer", label: t("قضايا","Dossiers"), icon: <Scale size={10} />, badge: lawyerRequests.filter(r=>r.status==="pending").length }]
              : [{ id: "sos", label: "SOS", icon: <AlertTriangle size={10} />, badge: sosRequests.filter(s=>s.status==="pending").length, danger: true }]
            ),
          ].map((tb: any) => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={cn("flex-shrink-0 flex-1 py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1",
                tab === tb.id
                  ? tb.danger ? "bg-red-500 text-white" : "bg-[#1A4D1F] text-white"
                  : tb.danger ? "text-red-400 hover:text-red-500" : "text-[#1A4D1F]/40 hover:text-[#1A4D1F]")}>
              {tb.icon}{tb.label}
              {tb.badge > 0 && (
                <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-black",
                  tab === tb.id ? "bg-white/20 text-white" : tb.danger ? "bg-red-400/20 text-red-400" : "bg-amber-400/20 text-amber-400")}>
                  {tb.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Products Manager */}
        {tab === "products" && (
          <ProductsManager providerId={selected.id} t={t} lang={lang} />
        )}

        {/* Car Rental Bookings */}
        {tab === "bookings" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("حجوزات السيارات", "Réservations voitures")}</p>
              <button onClick={() => loadCarBookings(selected)} className="p-1.5 rounded-lg" style={{ background: "#1A4D1F22" }}>
                <RefreshCw size={12} style={{ color: "#1A4D1F" }} />
              </button>
            </div>
            {carBookings.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <KeyRound size={32} style={{ color: "#1A4D1F" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد حجوزات", "Aucune réservation")}</p>
              </div>
            ) : carBookings.map(b => {
              const statusColors: Record<string, { bg: string; color: string }> = {
                pending:   { bg: "#FEF3C7", color: "#92400E" },
                confirmed: { bg: "#DBEAFE", color: "#1D4ED8" },
                rejected:  { bg: "#FEE2E2", color: "#DC2626" },
                active:    { bg: "#D1FAE5", color: "#059669" },
                completed: { bg: "#EDE9FE", color: "#6D28D9" },
                cancelled: { bg: "#F3F4F6", color: "#6B7280" },
              };
              const sc = statusColors[b.status] || statusColors.pending;
              const statusLabel: Record<string, { ar: string; fr: string }> = {
                pending:   { ar: "في الانتظار", fr: "En attente" },
                confirmed: { ar: "مؤكد",        fr: "Confirmé" },
                rejected:  { ar: "مرفوض",       fr: "Refusé" },
                active:    { ar: "نشط",         fr: "Actif" },
                completed: { ar: "مكتمل",       fr: "Terminé" },
                cancelled: { ar: "ملغي",        fr: "Annulé" },
              };
              return (
                <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1A4D1F08" }}>
                    <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>#{b.id} · سيارة #{b.carId}</span>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>
                      {lang === "ar" ? statusLabel[b.status]?.ar : statusLabel[b.status]?.fr}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{b.customerName}</p>
                    <p className="text-xs opacity-50 flex items-center gap-1" style={{ color: "#1A4D1F" }}><Phone size={10} />{b.customerPhone}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs font-bold" style={{ color: "#1A4D1F" }}>
                      <Calendar size={11} />{b.startDate} → {b.endDate} ({b.durationDays} {t("يوم", "j")})
                    </div>
                    <p className="text-sm font-black mt-1" style={{ color: "#FFA500" }}>{b.totalPrice} {t("د.ت", "TND")}</p>
                    {b.notes && <p className="text-xs mt-1 opacity-40" style={{ color: "#1A4D1F" }}>{b.notes}</p>}
                    {b.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => updateCarBooking(b.id, "confirmed")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                          style={{ background: "#1A4D1F", color: "#fff" }}>
                          <Check size={12} /> {t("تأكيد", "Confirmer")}
                        </button>
                        <button onClick={() => updateCarBooking(b.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}>
                          <X size={12} /> {t("رفض", "Refuser")}
                        </button>
                      </div>
                    )}
                    {b.status === "confirmed" && (
                      <button onClick={() => updateCarBooking(b.id, "active")}
                        className="mt-3 w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                        style={{ background: "#D1FAE5", color: "#059669" }}>
                        {t("تأكيد الاستلام → نشط", "Confirmer remise → Actif")}
                      </button>
                    )}
                    {b.status === "active" && (
                      <button onClick={() => updateCarBooking(b.id, "completed")}
                        className="mt-3 w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                        style={{ background: "#EDE9FE", color: "#6D28D9" }}>
                        {t("إنهاء الكراء ✓", "Terminer ✓")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SOS requests */}
        {tab === "sos" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("طلبات SOS القريبة", "Demandes SOS proches")}</p>
              <button onClick={() => loadSosRequests(selected)} className="p-1.5 rounded-lg" style={{ background: "#EF444422" }}>
                <RefreshCw size={12} style={{ color: "#EF4444" }} />
              </button>
            </div>
            {sosLoading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-red-400/20 border-t-red-400 animate-spin" /></div>
            ) : sosRequests.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <AlertTriangle size={32} style={{ color: "#EF4444" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد طلبات SOS", "Aucune demande SOS")}</p>
              </div>
            ) : sosRequests.map(sos => {
              const CAT_LABELS: Record<string, { ar: string; fr: string; color: string }> = {
                mechanic:  { ar: "ميكانيكي", fr: "Mécanicien", color: "#F59E0B" },
                doctor:    { ar: "طبيب",     fr: "Médecin",    color: "#3B82F6" },
                emergency: { ar: "طوارئ",    fr: "Urgence",    color: "#EF4444" },
                other:     { ar: "أخرى",     fr: "Autre",      color: "#6B7280" },
              };
              const cat = CAT_LABELS[sos.category] || CAT_LABELS.other;
              const mine = sos.assignedProviderId === selected.id;
              return (
                <div key={sos.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${cat.color}33` }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: cat.color + "15" }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} style={{ color: cat.color }} />
                      <span className="text-xs font-black" style={{ color: cat.color }}>{lang === "ar" ? cat.ar : cat.fr}</span>
                    </div>
                    <span className="text-xs font-black" style={{ color: sos.status === "accepted" ? "#059669" : "#92400E" }}>
                      {sos.status === "accepted" ? t("مقبول ✓", "Accepté ✓") : t("في الانتظار", "En attente")}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{sos.customerName}</p>
                    <p className="text-xs flex items-center gap-1 opacity-50" style={{ color: "#1A4D1F" }}><Phone size={10} />{sos.customerPhone}</p>
                    <p className="text-xs flex items-center gap-1 mt-1 opacity-50" style={{ color: "#1A4D1F" }}><MapPin size={10} />{sos.lat.toFixed(4)}, {sos.lng.toFixed(4)}</p>
                    {sos.description && <p className="text-xs mt-2 p-2 rounded-lg opacity-70" style={{ color: "#1A4D1F", background: "#FFF3E0" }}>{sos.description}</p>}
                    {sos.status === "pending" && (
                      <button onClick={() => acceptSos(sos.id, selected)}
                        className="mt-3 w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                        style={{ background: "#EF4444", color: "#fff" }}>
                        <Check size={14} /> {t("قبول الطلب", "Accepter")}
                      </button>
                    )}
                    {mine && sos.status === "accepted" && (
                      <div className="mt-2 text-center text-xs font-black text-emerald-500">{t("أنت تتكفل بهذا الطلب", "Vous gérez cette demande")}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lawyer Requests */}
        {tab === "lawyer" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("طلبات الاستشارة القانونية", "Demandes de consultation")}</p>
              <button onClick={() => loadLawyerRequests(selected)} className="p-1.5 rounded-lg" style={{ background: "#1A4D1F22" }}>
                <RefreshCw size={12} style={{ color: "#1A4D1F" }} />
              </button>
            </div>
            {lawyerLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-[#1A4D1F]/20 border-t-[#1A4D1F] animate-spin" />
              </div>
            ) : lawyerRequests.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <Scale size={32} style={{ color: "#1A4D1F" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد طلبات بعد", "Aucune demande pour l'instant")}</p>
              </div>
            ) : lawyerRequests.map(req => {
              const CASE_LABELS: Record<string, { ar: string; fr: string }> = {
                criminal:       { ar: "جنائي",  fr: "Pénal" },
                civil:          { ar: "مدني",   fr: "Civil" },
                administrative: { ar: "إداري",  fr: "Administratif" },
                commercial:     { ar: "تجاري",  fr: "Commercial" },
                family:         { ar: "أسري",   fr: "Familial" },
                real_estate:    { ar: "عقاري",  fr: "Immobilier" },
                other:          { ar: "أخرى",   fr: "Autre" },
              };
              const STATUS_LAWYER: Record<string, { ar: string; fr: string; bg: string; color: string }> = {
                pending:  { ar: "في الانتظار", fr: "En attente",  bg: "#FEF3C7", color: "#92400E" },
                accepted: { ar: "مقبول",       fr: "Accepté",     bg: "#D1FAE5", color: "#059669" },
                rejected: { ar: "مرفوض",       fr: "Refusé",      bg: "#FEE2E2", color: "#DC2626" },
              };
              const ct = CASE_LABELS[req.caseType] || CASE_LABELS.other;
              const st = STATUS_LAWYER[req.status] || STATUS_LAWYER.pending;
              const reqPhotos = (() => { try { return JSON.parse(req.photos || "[]"); } catch { return []; } })();
              return (
                <div key={req.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1A4D1F08" }}>
                    <div className="flex items-center gap-2">
                      <Scale size={11} style={{ color: "#1A4D1F" }} />
                      <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>
                        #{req.id.toString().padStart(4, "0")} · {lang === "ar" ? ct.ar : ct.fr}
                      </span>
                    </div>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {lang === "ar" ? st.ar : st.fr}
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{req.customerName}</p>
                    <p className="text-xs flex items-center gap-1 opacity-50" style={{ color: "#1A4D1F" }}>
                      <Phone size={10} />{req.customerPhone}
                    </p>
                    <p className="text-xs flex items-center gap-1 opacity-60" style={{ color: "#1A4D1F" }}>
                      <FileText size={10} />
                      {t("المحكمة:", "Tribunal:")} {req.court}
                    </p>
                    {req.notes && (
                      <p className="text-xs p-2.5 rounded-xl opacity-70" style={{ color: "#1A4D1F", background: "#FFF3E0" }}>
                        {req.notes}
                      </p>
                    )}
                    {reqPhotos.length > 0 && (
                      <div className="flex gap-2 flex-wrap pt-1">
                        {reqPhotos.map((url: string, i: number) => (
                          <button
                            key={i}
                            onClick={() => setPhotoModal(url)}
                            className="w-16 h-16 rounded-xl overflow-hidden border border-[#1A4D1F]/10"
                          >
                            <img src={url} alt="doc" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs opacity-30 flex items-center gap-1" style={{ color: "#1A4D1F" }}>
                      <Clock size={10} />{timeAgo(req.createdAt, lang)}
                    </p>
                    {req.status === "pending" && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => updateLawyerRequest(req.id, "accepted")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm"
                          style={{ background: "#1A4D1F", color: "white" }}
                        >
                          <Check size={14} /> {t("قبول", "Accepter")}
                        </button>
                        <button
                          onClick={() => updateLawyerRequest(req.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}
                        >
                          <X size={14} /> {t("رفض", "Refuser")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Orders */}
        {(tab === "pending" || tab === "all") && (loading ? (
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
