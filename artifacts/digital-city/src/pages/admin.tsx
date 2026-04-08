import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { compressImage } from "@/lib/compress-image";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession, isAdminRole, isSuperAdmin, ROLE_META, ROLE_SECTIONS, type AppRole } from "@/lib/auth";
import {
  LayoutDashboard, Package, Tag, Users, ShoppingBag,
  Truck, Map, Megaphone, RefreshCw, Plus, Pencil, Trash2,
  X, Check, Clock, CheckCircle, AlertCircle, Star,
  ChevronRight, ChevronDown, Power, MessageCircle, Moon, Sun, Hotel, Car, ExternalLink,
  UserCog, Shield, Search, Eye, EyeOff, UserCheck, UserX, Send, Radio, Bell,
  Image, ImageIcon, Calendar, MousePointer, ToggleLeft, ToggleRight, Database, Wifi, WifiOff,
  Settings, Sliders, DollarSign, Zap, TrendingUp, Upload, AlertTriangle, KeyRound, Stethoscope, Scale, FileText, Phone,
  Camera, Bed, Wrench,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, post, patch, del } from "@/lib/admin-api";
import { getSessionToken } from "@/lib/auth";
import { format } from "date-fns";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type OrderStatus = "pending" | "accepted" | "in_delivery" | "delivered" | "cancelled" | "confirmed" | "in_progress";

interface Order {
  id: number; customerName: string; customerPhone?: string;
  customerAddress: string; serviceProviderName: string; serviceType: string;
  status: OrderStatus; deliveryFee?: number; deliveryStaffId?: number;
  createdAt: string; notes?: string; delegationId?: number;
}
interface Supplier { id: number; name: string; nameAr: string; category: string; description: string; descriptionAr: string; address: string; phone?: string; photoUrl?: string; shift?: string; rating?: number; isAvailable: boolean; latitude?: number | null; longitude?: number | null; }
interface Article { id: number; supplierId: number; nameAr: string; nameFr: string; descriptionAr: string; descriptionFr: string; price: number; originalPrice?: number; discountedPrice?: number; photoUrl?: string | null; isAvailable: boolean; supplierName?: string; }
interface DeliveryStaff { id: number; name: string; nameAr: string; phone: string; zone?: string; isAvailable: boolean; }
interface Delegation { id: number; name: string; nameAr: string; deliveryFee: number; }
interface PromoBanner {
  id: number; titleAr: string; titleFr: string;
  subtitleAr?: string; subtitleFr?: string;
  imageUrl?: string; link?: string;
  bgColor?: string; bgFrom?: string; bgTo?: string; accent?: string;
  isActive: boolean; startsAt?: string; endsAt?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Status config
// ──────────────────────────────────────────────────────────────────────────────
const STATUS: Record<string, { ar: string; fr: string; color: string; icon: React.FC<any> }> = {
  pending:         { ar: "قيد الانتظار",       fr: "En attente",        color: "text-amber-400 bg-amber-400/10 border-amber-400/30",     icon: Clock },
  accepted:        { ar: "مقبول",              fr: "Accepté",           color: "text-blue-400 bg-blue-400/10 border-blue-400/30",         icon: CheckCircle },
  prepared:        { ar: "جاهز للتوصيل",      fr: "Prêt à livrer",     color: "text-[#1A4D1F] bg-[#1A4D1F]/10 border-[#1A4D1F]/30",     icon: Package },
  driver_accepted: { ar: "سائق في الطريق",    fr: "Livreur en route",  color: "text-orange-400 bg-orange-400/10 border-orange-400/30",   icon: Truck },
  in_delivery:     { ar: "تم الاستلام · في الطريق", fr: "Récupéré · En route", color: "text-purple-400 bg-purple-400/10 border-purple-400/30", icon: Truck },
  delivered:       { ar: "تم التوصيل",         fr: "Livré",             color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: Check },
  cancelled:       { ar: "ملغي",               fr: "Annulé",            color: "text-red-400 bg-red-400/10 border-red-400/30",             icon: X },
  confirmed:       { ar: "مؤكد",               fr: "Confirmé",          color: "text-blue-400 bg-blue-400/10 border-blue-400/30",         icon: CheckCircle },
  in_progress:     { ar: "جاري",               fr: "En cours",          color: "text-purple-400 bg-purple-400/10 border-purple-400/30",   icon: Truck },
};

const CATEGORY_LABELS: Record<string, { ar: string; fr: string }> = {
  // ── مزودو المنتجات (توصيل) ──
  restaurant: { ar: "مطعم",    fr: "Restaurant" },
  grocery:    { ar: "بقالة",   fr: "Épicerie"   },
  pharmacy:   { ar: "صيدلية",  fr: "Pharmacie"  },
  bakery:     { ar: "مخبزة",   fr: "Boulangerie"},
  butcher:    { ar: "ملّاح",   fr: "Boucherie"  },
  cafe:       { ar: "مقهى",    fr: "Café"       },
  sweets:     { ar: "حلويات",  fr: "Pâtisserie" },
  clothing:   { ar: "ملابس",   fr: "Vêtements"  },
  // ── مزودو الخدمات ──
  hotel:      { ar: "فندق",    fr: "Hôtel"      },
  car_rental: { ar: "كراء سيارات", fr: "Location auto" },
  sos:        { ar: "SOS · إنقاذ", fr: "SOS · Dépannage" },
  lawyer:     { ar: "محامي",   fr: "Avocat"     },
};

const PRODUCT_CATS = ["restaurant","grocery","pharmacy","bakery","butcher","cafe","sweets","clothing"] as const;
const SERVICE_CATS = ["hotel","car_rental","sos","lawyer"] as const;

function supplierType(cat: string): "product" | "service" {
  return (PRODUCT_CATS as readonly string[]).includes(cat) ? "product" : "service";
}

// ──────────────────────────────────────────────────────────────────────────────
// Reusable mini-components
// ──────────────────────────────────────────────────────────────────────────────
function GoldBtn({ onClick, children, variant = "primary", disabled, className }: {
  onClick?: () => void; children: React.ReactNode; variant?: "primary" | "ghost" | "danger";
  disabled?: boolean; className?: string;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40";
  const v = {
    primary: "bg-[#1A4D1F] text-black hover:bg-[#1A4D1F]",
    ghost: "border border-[#1A4D1F]/20 text-[#1A4D1F]/70 hover:text-[#1A4D1F] hover:border-[#1A4D1F]/40 bg-transparent",
    danger: "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
  };
  return <button onClick={onClick} disabled={disabled} className={cn(base, v[variant], className)}>{children}</button>;
}

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-[#FFFDE7] border border-[#1A4D1F]/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A4D1F]/10">
          <h3 className="font-bold text-[#1A4D1F] text-lg">{title}</h3>
          <button onClick={onClose} className="text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">{children}</div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#1A4D1F]/50 mb-1 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-[#FFA500]/50 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/20 focus:outline-none focus:border-[#1A4D1F]/50 transition-colors" />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-[#FFA500]/50 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 text-sm text-[#1A4D1F] focus:outline-none focus:border-[#1A4D1F]/50 transition-colors">
      {options.map(o => <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string; }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div onClick={() => onChange(!checked)} className={cn("w-11 h-6 rounded-full relative transition-colors duration-300 cursor-pointer", checked ? "bg-[#1A4D1F]" : "bg-[#1A4D1F]/10")}>
        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300", checked ? "left-6" : "left-1")} />
      </div>
      {label && <span className="text-sm text-[#1A4D1F]/60">{label}</span>}
    </label>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs text-[#1A4D1F]/40 mb-1 font-bold uppercase tracking-wider">{label}</p>
      <p className={cn("text-3xl font-black", color)}>{value}</p>
    </div>
  );
}

function Stars({ rating }: { rating?: number | null }) {
  const r = rating ?? 0;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} size={12} className={i <= r ? "text-[#1A4D1F] fill-[#1A4D1F]" : "text-[#1A4D1F]/20"} />)}
      <span className="ml-1 text-xs text-[#1A4D1F]/40">{r.toFixed(1)}</span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Overview
// ──────────────────────────────────────────────────────────────────────────────
interface DbStats {
  database: string; status: string; timestamp: string;
  tables: { users: number; providers: number; articles: number; orders: number;
    banners: number; ads: number; delivery_staff: number;
    broadcasts: number; ratings: number; };
}

function OverviewSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  const loadDbStats = () => {
    setDbLoading(true);
    get<DbStats>("/admin/db-stats")
      .then(s => { setDbStats(s); setDbLoading(false); })
      .catch(() => setDbLoading(false));
  };

  useEffect(() => {
    get<Order[]>("/orders").then(setOrders).catch(() => {});
    get<Supplier[]>("/admin/suppliers").then(setSuppliers).catch(() => {});
    loadDbStats();
    const iv = setInterval(loadDbStats, 20_000);
    return () => clearInterval(iv);
  }, []);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    inDelivery: orders.filter(o => o.status === "in_delivery").length,
    delivered: orders.filter(o => o.status === "delivered").length,
    activeSuppliers: suppliers.filter(s => s.isAvailable).length,
  };

  const dbRows: { ar: string; fr: string; key: keyof DbStats["tables"]; icon: string }[] = [
    { ar: "المستخدمون",    fr: "Utilisateurs",   key: "users",          icon: "👤" },
    { ar: "المزودون",      fr: "Prestataires",    key: "providers",      icon: "🏪" },
    { ar: "المقالات",      fr: "Articles",        key: "articles",       icon: "📦" },
    { ar: "الطلبات",       fr: "Commandes",       key: "orders",         icon: "🛒" },
    { ar: "البنرات",       fr: "Bannières",       key: "banners",        icon: "🖼️" },
    { ar: "الإعلانات",     fr: "Annonces",        key: "ads",            icon: "📢" },
    { ar: "موظفو التوصيل", fr: "Livreurs",        key: "delivery_staff", icon: "🚴" },
    { ar: "الإذاعات",      fr: "Broadcasts",      key: "broadcasts",     icon: "📡" },
    { ar: "التقييمات",     fr: "Avis",            key: "ratings",        icon: "⭐" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-[#1A4D1F]">{t("نظرة عامة", "Vue d'ensemble")}</h2>

      {/* ── Database Status Panel ─────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-[#1A4D1F]/20 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-[#1A4D1F] text-white">
          <div className="flex items-center gap-2">
            <Database size={16} />
            <span className="font-bold text-sm">{t("قاعدة البيانات · PostgreSQL", "Base de données · PostgreSQL")}</span>
          </div>
          <div className="flex items-center gap-3">
            {dbStats?.status === "connected"
              ? <span className="flex items-center gap-1 text-emerald-300 text-xs font-bold"><Wifi size={12}/> {t("متصل","Connecté")}</span>
              : <span className="flex items-center gap-1 text-red-300 text-xs font-bold"><WifiOff size={12}/> {t("خطأ","Erreur")}</span>
            }
            <button onClick={loadDbStats} className="text-white/70 hover:text-white transition-colors">
              <RefreshCw size={13} className={dbLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        {dbLoading && !dbStats ? (
          <div className="flex items-center justify-center py-6 text-[#1A4D1F]/40 gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-[#1A4D1F]/20 border-t-[#1A4D1F] animate-spin" />
            <span className="text-xs">{t("جارٍ الاتصال بـ PostgreSQL…","Connexion à PostgreSQL…")}</span>
          </div>
        ) : dbStats ? (
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {dbRows.map(row => (
                <div key={row.key} className="flex flex-col items-center justify-center rounded-xl bg-[#FFF3E0] py-3 px-2 gap-1">
                  <span className="text-lg leading-none">{row.icon}</span>
                  <span className="text-2xl font-black text-[#1A4D1F]">{dbStats.tables[row.key]}</span>
                  <span className="text-[10px] text-[#1A4D1F]/50 text-center leading-tight">{t(row.ar, row.fr)}</span>
                </div>
              ))}
            </div>
            {dbStats.timestamp && (
              <p className="text-[10px] text-[#1A4D1F]/30 text-center mt-3">
                {t("آخر تحديث","Dernière màj")} · {new Date(dbStats.timestamp).toLocaleTimeString("ar-TN")}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 text-red-400 text-xs gap-2">
            <WifiOff size={14}/> {t("تعذّر الاتصال بقاعدة البيانات","Connexion échouée")}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("إجمالي الطلبات", "Total commandes")} value={stats.total} color="text-[#1A4D1F]" />
        <StatCard label={t("قيد الانتظار", "En attente")} value={stats.pending} color="text-amber-400" />
        <StatCard label={t("في التوصيل", "En livraison")} value={stats.inDelivery} color="text-indigo-500" />
        <StatCard label={t("تم التوصيل", "Livrés")} value={stats.delivered} color="text-emerald-400" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="font-bold text-[#1A4D1F]/60 text-sm mb-4 uppercase tracking-wider">{t("آخر الطلبات", "Dernières commandes")}</h3>
          <div className="space-y-2">
            {orders.slice(0, 5).map(o => {
              const s = STATUS[o.status];
              const Icon = s?.icon ?? Clock;
              return (
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-[#1A4D1F]/5">
                  <span className="text-xs text-[#1A4D1F]/30 font-mono">#{o.id.toString().padStart(4,"0")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1A4D1F] truncate">{o.customerName}</p>
                    <p className="text-xs text-[#1A4D1F]/40">{o.serviceProviderName}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border", s?.color)}>
                    <Icon size={10} />{t(s?.ar, s?.fr)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="font-bold text-[#1A4D1F]/60 text-sm mb-4 uppercase tracking-wider">{t("المزودون النشطون", "Prestataires actifs")}</h3>
          <div className="space-y-2">
            {suppliers.filter(s => s.isAvailable).slice(0,5).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-[#1A4D1F]/5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A4D1F]">{s.nameAr}</p>
                  <p className="text-xs text-[#1A4D1F]/40">{CATEGORY_LABELS[s.category]?.ar}</p>
                </div>
                <Stars rating={s.rating} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Orders
// ──────────────────────────────────────────────────────────────────────────────
function OrdersSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<DeliveryStaff[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, s] = await Promise.all([
      get<Order[]>("/orders").catch(() => []),
      get<DeliveryStaff[]>("/admin/delivery-staff").catch(() => []),
    ]);
    setOrders(o); setStaff(s); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => filter === "all" || o.status === filter);

  const updateStatus = async (id: number, status: string) => {
    await patch(`/orders/${id}`, { status });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as OrderStatus } : o));
  };

  const assignStaff = async (id: number, staffId: string) => {
    await patch(`/orders/${id}`, { deliveryStaffId: staffId || null, status: staffId ? "in_delivery" : undefined });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, deliveryStaffId: staffId ? parseInt(staffId) : undefined } : o));
  };

  const whatsapp = (phone?: string, name?: string, id?: number) => {
    if (!phone) return;
    const msg = encodeURIComponent(`مرحباً ${name}، طلبك رقم #${id} جاهز للتوصيل 🛵`);
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-2xl font-black text-[#1A4D1F]">{t("الطلبات", "Commandes")}</h2>
        <div className="flex items-center gap-2">
          <GoldBtn onClick={load} variant="ghost"><RefreshCw size={14} /></GoldBtn>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {["all", ...Object.keys(STATUS)].slice(0, 7).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
              filter === s ? "bg-[#1A4D1F] text-black border-[#1A4D1F]" : "border-[#1A4D1F]/10 text-[#1A4D1F]/40 hover:border-[#1A4D1F]/30")}>
            {s === "all" ? t("الكل","Tous") : t(STATUS[s]?.ar, STATUS[s]?.fr)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#1A4D1F] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-[#1A4D1F]/30 py-16">{t("لا توجد طلبات","Aucune commande")}</p>}
          {filtered.map(order => {
            const s = STATUS[order.status];
            const Icon = s?.icon ?? Clock;
            return (
              <motion.div key={order.id} layout className="glass-panel rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-[#1A4D1F]/30 block">#{order.id.toString().padStart(5,"0")}</span>
                    <p className="font-bold text-[#1A4D1F]">{order.customerName}</p>
                    {order.customerPhone && (
                      <span className="text-xs text-[#1A4D1F]/40">{order.customerPhone}</span>
                    )}
                    <p className="text-xs text-[#1A4D1F]/30 mt-0.5">{order.customerAddress}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border", s?.color)}>
                      <Icon size={12} /> {t(s?.ar, s?.fr)}
                    </span>
                    {order.customerPhone && (
                      <button onClick={() => whatsapp(order.customerPhone, order.customerName, order.id)}
                        className="p-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors">
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1A4D1F]/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#1A4D1F] font-bold">{order.serviceProviderName}</p>
                    <p className="text-xs text-[#1A4D1F]/30">{order.serviceType} {order.deliveryFee ? `· ${order.deliveryFee} TND` : ""}</p>
                  </div>
                  <select value={order.status} onChange={e => updateStatus(order.id, e.target.value)}
                    className="bg-[#FFA500]/50 border border-[#1A4D1F]/10 text-[#1A4D1F] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1A4D1F]/50">
                    {Object.entries(STATUS).slice(0,5).map(([v, c]) => (
                      <option key={v} value={v} className="bg-zinc-900">{t(c.ar, c.fr)}</option>
                    ))}
                  </select>
                  <select value={order.deliveryStaffId?.toString() || ""} onChange={e => assignStaff(order.id, e.target.value)}
                    className="bg-[#FFA500]/50 border border-[#1A4D1F]/10 text-[#1A4D1F] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1A4D1F]/50">
                    <option value="" className="bg-zinc-900">{t("اختر سائق","Choisir livreur")}</option>
                    {staff.map(s => <option key={s.id} value={s.id} className="bg-zinc-900">{s.nameAr}</option>)}
                  </select>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin Provider Management — Drawer + sub-components
// ──────────────────────────────────────────────────────────────────────────────

async function uploadImageFileAdmin(file: File, token: string): Promise<string> {
  const compressed = await compressImage(file).catch(() => file);
  const fd = new FormData();
  fd.append("image", compressed);
  const res = await fetch("/api/upload/image", {
    method: "POST",
    headers: { "X-Session-Token": token },
    body: fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json() as { url: string };
  return data.url;
}

function AdminImagePicker({ value, onChange, label, guideAr, guideFr, aspect = "16:9", accent = "#1A4D1F", t }: {
  value: string; onChange: (v: string) => void; label: string;
  guideAr: string; guideFr: string; aspect?: "16:9" | "4:3" | "1:1";
  accent?: string; t: (ar: string, fr: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [imgErr, setImgErr] = useState(false);
  const isCircle = aspect === "1:1";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadErr("");
    setImgErr(false);
    try {
      const token = getSessionToken() || "";
      const url = await uploadImageFileAdmin(file, token);
      onChange(url);
    } catch {
      setUploadErr(t("فشل الرفع، حاول مجدداً", "Échec du téléchargement, réessayez"));
    } finally {
      setUploading(false);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setUploadErr("");
    setImgErr(false);
  };

  /* ── Circle picker (1:1) ── */
  if (isCircle) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-black opacity-60" style={{ color: accent }}>{label}</label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="flex flex-col items-center gap-3">
          {/* Circle preview */}
          <div
            className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-dashed cursor-pointer transition-all flex items-center justify-center"
            style={{ borderColor: (value && !imgErr) ? accent + "80" : accent + "30", background: accent + "0A" }}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {(value && !imgErr) ? (
              <img
                src={value}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgErr(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Camera size={28} style={{ color: accent, opacity: 0.35 }} />
                <p className="text-[10px] font-black text-center px-2 opacity-40" style={{ color: accent }}>
                  {imgErr
                    ? t("فشل التحميل", "Erreur")
                    : t("اضغط لاختيار", "Appuyer")}
                </p>
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.85)" }}>
                <RefreshCw size={22} className="animate-spin" style={{ color: accent }} />
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-xl text-xs font-black border transition-all"
              style={{ borderColor: accent + "40", color: accent, background: accent + "0A" }}
            >
              <Camera size={11} className="inline me-1" />
              {(value && !imgErr) ? t("تغيير", "Changer") : t("اختر صورة", "Choisir")}
            </button>
            {(value && !imgErr) && (
              <button
                type="button"
                onClick={clear}
                className="px-3 py-1.5 rounded-xl text-xs font-black border border-red-400/30 text-red-500 bg-red-50 transition-all"
              >
                <X size={11} className="inline me-1" />
                {t("حذف", "Suppr.")}
              </button>
            )}
          </div>
        </div>

        {uploadErr && <p className="text-xs font-bold text-red-500 text-center">{uploadErr}</p>}
        <p className="text-[10px] font-bold opacity-25 text-center flex items-center justify-center gap-1" style={{ color: accent }}>
          <ImageIcon size={9} />{t("صورة مربعة 1:1 للحصول على دائرة مثالية", "Image carrée 1:1 pour un cercle parfait")}
        </p>
      </div>
    );
  }

  /* ── Rectangle picker (16:9 / 4:3) ── */
  const cls = aspect === "4:3" ? "aspect-[4/3]" : "aspect-video";
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-black opacity-60" style={{ color: accent }}>{label}</label>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div
        className={`relative w-full rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer transition-all ${cls}`}
        style={{ borderColor: (value && !imgErr) ? accent + "55" : accent + "22", background: accent + "08" }}
        onClick={() => !uploading && fileRef.current?.click()}>

        {(value && !imgErr) ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            {!uploading && (
              <div className="absolute top-2 end-2 flex gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="p-1.5 rounded-lg backdrop-blur-sm"
                  style={{ background: "rgba(0,0,0,0.55)" }}>
                  <Camera size={11} className="text-white" />
                </button>
                <button onClick={clear} className="p-1.5 rounded-lg backdrop-blur-sm" style={{ background: "rgba(239,68,68,0.7)" }}>
                  <X size={11} className="text-white" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Camera size={32} style={{ color: accent, opacity: 0.4 }} />
            <div className="text-center px-3 space-y-0.5">
              <p className="text-xs font-black opacity-50" style={{ color: accent }}>
                {imgErr ? t("فشل التحميل — اضغط لتغيير", "Erreur — appuyer pour changer") : t("اضغط لاختيار صورة", "Appuyer pour choisir")}
              </p>
              <p className="text-[10px] opacity-30 font-bold" style={{ color: accent }}>{t(guideAr, guideFr)}</p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.85)" }}>
            <RefreshCw size={22} className="animate-spin" style={{ color: accent }} />
            <p className="text-xs font-black" style={{ color: accent }}>{t("جارٍ الرفع...", "Téléchargement...")}</p>
          </div>
        )}
      </div>

      {uploadErr && <p className="text-xs font-bold text-red-500">{uploadErr}</p>}

      <p className="text-[10px] font-bold opacity-30 flex items-center gap-1" style={{ color: accent }}>
        <ImageIcon size={9} />{t(`من المعرض أو الكاميرا · نسبة ${aspect}`, `Galerie ou caméra · Ratio ${aspect}`)}
      </p>
    </div>
  );
}

function MultiImagePickerAdmin({
  images, onChange, accent = "#1565C0", t,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  accent?: string;
  t: (ar: string, fr: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setUploadErr("");
    try {
      const token = getSessionToken() || "";
      const uploaded = await Promise.all(files.map(f => uploadImageFileAdmin(f, token)));
      onChange([...images, ...uploaded]);
    } catch {
      setUploadErr(t("فشل رفع بعض الصور", "Échec du chargement"));
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-black opacity-60" style={{ color: accent }}>
        {t("صور السيارة", "Photos de la voiture")}
        <span className="ms-1 opacity-50 font-bold">({images.length} {t("صورة", "photo(s)")})</span>
      </label>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden group"
              style={{ border: `1.5px solid ${accent}22` }}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                <button type="button" onClick={() => remove(idx)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-full bg-red-500/90">
                  <X size={12} className="text-white" />
                </button>
              </div>
              {idx === 0 && (
                <div className="absolute top-1 start-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: accent, color: "#fff" }}>
                  {t("رئيسية", "Principale")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
        className="w-full py-3 rounded-2xl border-2 border-dashed flex flex-col items-center gap-1.5 disabled:opacity-50"
        style={{ borderColor: accent + "30", background: accent + "06" }}>
        {uploading
          ? <RefreshCw size={18} className="animate-spin" style={{ color: accent }} />
          : <Camera size={18} style={{ color: accent, opacity: 0.5 }} />}
        <span className="text-xs font-black" style={{ color: accent, opacity: 0.6 }}>
          {uploading ? t("جارٍ الرفع...", "Chargement...") : images.length === 0
            ? t("اضغط لاختيار صورة أو أكثر", "Choisir une ou plusieurs photos")
            : t("إضافة صور أخرى", "Ajouter d'autres photos")}
        </span>
        <span className="text-[10px] font-bold opacity-30" style={{ color: accent }}>
          {t("من المعرض أو الكاميرا", "Depuis la galerie ou l'appareil photo")}
        </span>
      </button>
      {uploadErr && <p className="text-xs font-bold text-red-500">{uploadErr}</p>}
    </div>
  );
}

/** Admin manages articles/rooms/specialties for any supplier */
function AdminArticlesManager({ supplierId, mode, t, lang }: {
  supplierId: number; mode: "product" | "room" | "specialty";
  t: (ar: string, fr: string) => string; lang: string;
}) {
  type Art = { id: number; nameAr: string; nameFr: string; descriptionAr: string; descriptionFr: string; price: number; photoUrl?: string | null; isAvailable: boolean; };
  const EMPTY = { nameAr: "", nameFr: "", descriptionAr: "", descriptionFr: "", price: "", photoUrl: "", isAvailable: true };
  const [items,   setItems]   = useState<Art[]>([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(EMPTY);
  const [editing, setEditing] = useState<Art | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [showF,   setShowF]   = useState(false);

  // Room-specific fields
  const [roomNum,   setRoomNum]   = useState("");
  const [roomFloor, setRoomFloor] = useState("0");
  const [roomType,  setRoomType]  = useState("single");
  const ROOM_TYPES = [
    { value:"single",  arLabel:"فردية",   frLabel:"Simple"  },
    { value:"double",  arLabel:"مزدوجة",  frLabel:"Double"  },
    { value:"suite",   arLabel:"جناح",    frLabel:"Suite"   },
    { value:"family",  arLabel:"عائلية",  frLabel:"Familiale"},
  ];
  const FLOORS = Array.from({length:11},(_,i)=>i);

  const load = async () => {
    setLoading(true);
    try { const r = await get<Art[]>(`/admin/articles?supplierId=${supplierId}`); setItems(r); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [supplierId]);

  const parseRoom = (a: Art) => {
    const floorM = (a.descriptionAr || "").match(/floor:(\d+)/);
    const typeM  = (a.descriptionAr || "").match(/type:(\w+)/);
    const numM   = (a.nameAr || "").match(/غرفة\s*(.+)/);
    return { floor: floorM?.[1] ?? "0", type: typeM?.[1] ?? "single", roomNumber: numM?.[1]?.trim() ?? a.nameAr };
  };

  const openAdd = () => {
    setEditing(null); setForm(EMPTY); setRoomNum(""); setRoomFloor("0"); setRoomType("single"); setShowF(true);
  };
  const openEdit = (a: Art) => {
    if (mode === "room") {
      const r = parseRoom(a);
      setRoomNum(r.roomNumber); setRoomFloor(r.floor); setRoomType(r.type);
      setForm({ ...EMPTY, price: String(a.price), photoUrl: a.photoUrl || "", isAvailable: a.isAvailable, nameAr: a.nameAr, nameFr: a.nameFr, descriptionAr: a.descriptionAr, descriptionFr: a.descriptionFr });
    } else {
      setForm({ nameAr: a.nameAr, nameFr: a.nameFr, descriptionAr: a.descriptionAr, descriptionFr: a.descriptionFr, price: String(a.price), photoUrl: a.photoUrl || "", isAvailable: a.isAvailable });
    }
    setEditing(a); setShowF(true);
  };

  const buildPayload = () => {
    if (mode === "room") {
      const typeObj = ROOM_TYPES.find(r => r.value === roomType) || ROOM_TYPES[0];
      const flLabelFr = roomFloor === "0" ? "Rez-de-chaussée" : `Étage ${roomFloor}`;
      return { supplierId, nameAr: `غرفة ${roomNum}`, nameFr: `Chambre ${roomNum}`, descriptionAr: `floor:${roomFloor}|type:${roomType}`, descriptionFr: `${flLabelFr} • ${typeObj.frLabel}`, price: Number(form.price) || 0, photoUrl: form.photoUrl || null, isAvailable: form.isAvailable };
    }
    return { supplierId, nameAr: form.nameAr, nameFr: form.nameFr || form.nameAr, descriptionAr: form.descriptionAr, descriptionFr: form.descriptionFr || form.descriptionAr, price: Number(form.price) || 0, photoUrl: form.photoUrl || null, isAvailable: form.isAvailable };
  };

  const save = async () => {
    if (mode === "room" && !roomNum) return;
    if (mode !== "room" && !form.nameAr) return;
    setSaving(true);
    try {
      if (editing) await patch(`/admin/articles/${editing.id}`, buildPayload());
      else await post("/admin/articles", buildPayload());
      setShowF(false); await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف العنصر؟","Supprimer ?"))) return;
    await del(`/admin/articles/${id}`); load();
  };

  const toggleAvail = async (a: Art) => {
    await patch(`/admin/articles/${a.id}`, { isAvailable: !a.isAvailable });
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, isAvailable: !x.isAvailable } : x));
  };

  const titleAr = mode === "room" ? "الغرف" : mode === "specialty" ? "التخصصات" : "المنتجات / الخدمات";
  const titleFr = mode === "room" ? "Chambres" : mode === "specialty" ? "Spécialités" : "Produits / Services";
  const addAr   = mode === "room" ? "غرفة جديدة" : mode === "specialty" ? "تخصص جديد" : "إضافة منتج";
  const addFr   = mode === "room" ? "Nouvelle chambre" : mode === "specialty" ? "Nouvelle spécialité" : "Ajouter produit";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black" style={{ color: "#1A4D1F" }}>{t(titleAr, titleFr)} <span className="opacity-40">({items.length})</span></p>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white" style={{ background: "#1A4D1F" }}>
          <Plus size={12} />{t(addAr, addFr)}
        </button>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-[#1A4D1F]/20 border-t-[#1A4D1F] animate-spin" /></div>
      : items.length === 0 ? <div className="flex flex-col items-center py-8 gap-2 opacity-30"><Package size={28} style={{ color: "#1A4D1F" }} /><p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا يوجد","Aucun")}</p></div>
      : <div className="space-y-2">
          {items.map(a => {
            const roomData = mode === "room" ? parseRoom(a) : null;
            const typeObj  = roomData ? (ROOM_TYPES.find(r => r.value === roomData.type) || ROOM_TYPES[0]) : null;
            return (
              <div key={a.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1.5px solid #1A4D1F11" }}>
                <div className="flex items-center gap-3 p-3">
                  {a.photoUrl
                    ? <img src={a.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1A4D1F08" }}>
                        {mode === "room" ? <Bed size={20} style={{ color: "#1A4D1F" }} className="opacity-30" /> : <Package size={20} style={{ color: "#1A4D1F" }} className="opacity-30" />}
                      </div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate" style={{ color: "#1A4D1F" }}>
                      {mode === "room" && roomData ? `غرفة ${roomData.roomNumber}` : a.nameAr}
                    </p>
                    <p className="text-xs opacity-50 truncate" style={{ color: "#1A4D1F" }}>
                      {mode === "room" && roomData
                        ? `${roomData.floor === "0" ? "ط. أرضي" : `ط. ${roomData.floor}`} • ${lang === "ar" ? typeObj?.arLabel : typeObj?.frLabel}`
                        : a.descriptionAr}
                    </p>
                    <p className="text-xs font-black mt-0.5" style={{ color: "#FFA500" }}>{a.price.toFixed(3)} TND</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleAvail(a)}
                      className={`p-1.5 rounded-lg border text-xs ${a.isAvailable ? "bg-emerald-400/10 text-emerald-500 border-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20"}`}>
                      <Power size={12} />
                    </button>
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg bg-[#1A4D1F]/5 border border-[#1A4D1F]/10"><Pencil size={12} style={{ color: "#1A4D1F" }} /></button>
                    <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg bg-red-400/5 border border-red-400/10"><Trash2 size={12} className="text-red-400" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>}

      {/* Form Modal */}
      <AnimatePresence>
        {showF && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowF(false)}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-3"
              style={{ background: "#FFF3E0" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between" dir="rtl">
                <h3 className="font-black text-[#1A4D1F] text-sm">{editing ? t("تعديل","Modifier") : t(addAr, addFr)}</h3>
                <button onClick={() => setShowF(false)}><X size={16} className="text-[#1A4D1F]/40" /></button>
              </div>
              <div className="space-y-3" dir="rtl">
                {mode === "room" ? (
                  <>
                    <div>
                      <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("رقم الغرفة *","Numéro *")}</label>
                      <input value={roomNum} onChange={e => setRoomNum(e.target.value)} placeholder="101"
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("الطابق","Étage")}</label>
                        <select value={roomFloor} onChange={e => setRoomFloor(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }}>
                          {FLOORS.map(f => <option key={f} value={String(f)}>{f === 0 ? t("أرضي","RDC") : `${t("طابق","Étage")} ${f}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("النوع","Type")}</label>
                        <select value={roomType} onChange={e => setRoomType(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }}>
                          {ROOM_TYPES.map(r => <option key={r.value} value={r.value}>{lang === "ar" ? r.arLabel : r.frLabel}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("السعر / ليلة (TND) *","Prix / nuit (TND) *")}</label>
                      <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="50.000"
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" dir="ltr" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("الاسم بالعربية *","Nom (arabe) *")}</label>
                      <input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }} />
                    </div>
                    <div>
                      <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("الاسم بالفرنسية","Nom (français)")}</label>
                      <input value={form.nameFr} onChange={e => setForm(f => ({ ...f, nameFr: e.target.value }))}
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" dir="ltr" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }} />
                    </div>
                    <div>
                      <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("الوصف","Description")}</label>
                      <input value={form.descriptionAr} onChange={e => setForm(f => ({ ...f, descriptionAr: e.target.value }))}
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }} />
                    </div>
                    <div>
                      <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1A4D1F" }}>{t("السعر (TND)","Prix (TND)")}</label>
                      <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.000"
                        className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border-2 outline-none" dir="ltr" style={{ background: "#fff", borderColor: "#1A4D1F22", color: "#1A4D1F" }} />
                    </div>
                  </>
                )}
                <AdminImagePicker
                  value={form.photoUrl}
                  onChange={v => setForm(f => ({ ...f, photoUrl: v }))}
                  label={mode === "room" ? t("صورة الغرفة","Photo chambre") : t("صورة المنتج","Photo produit")}
                  guideAr={mode === "room" ? "صورة داخلية للغرفة" : "صورة المنتج"}
                  guideFr={mode === "room" ? "Photo intérieure" : "Photo produit"}
                  aspect={mode === "room" ? "4:3" : "1:1"}
                  accent="#1A4D1F"
                  t={t}
                />
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving || (mode === "room" ? !roomNum || !form.price : !form.nameAr)}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: "#1A4D1F" }}>
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    {editing ? t("حفظ التعديل","Enregistrer") : t("إضافة","Ajouter")}
                  </button>
                  <button onClick={() => setShowF(false)} className="px-4 py-2.5 rounded-xl font-black text-sm border" style={{ color: "#1A4D1F", borderColor: "#1A4D1F22" }}>
                    {t("إلغاء","Annuler")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Admin manages cars for any car rental agency */
function AdminCarsManager({ agencyId, t, lang }: { agencyId: number; t: (ar: string, fr: string) => string; lang: string }) {
  type Car = { id: number; agencyId: number; make: string; model: string; year?: number; color: string; plateNumber: string; pricePerDay: number; seats: number; transmission: string; fuelType: string; imageUrl?: string | null; images?: string | null; isAvailable: boolean; };
  const EMPTY_CAR = { make:"", model:"", year:"", color:"", plateNumber:"", pricePerDay:"", seats:"5", transmission:"manual", fuelType:"essence", images:[] as string[], descriptionAr:"" };
  const [cars,   setCars]   = useState<Car[]>([]);
  const [loading,setLoading]= useState(true);
  const [form,   setForm]   = useState(EMPTY_CAR);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr,setSaveErr]= useState("");
  const [showF,  setShowF]  = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await get<Car[]>(`/car-rental/cars?agencyId=${agencyId}`); setCars(r); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [agencyId]);

  const openAdd  = () => { setEditId(null); setForm(EMPTY_CAR); setSaveErr(""); setShowF(true); };
  const openEdit = (c: Car) => {
    let imgs: string[] = [];
    try { imgs = c.images ? JSON.parse(c.images) : []; } catch {}
    setEditId(c.id);
    setForm({ make:c.make, model:c.model, year:c.year?.toString()||"", color:c.color, plateNumber:c.plateNumber, pricePerDay:c.pricePerDay.toString(), seats:c.seats.toString(), transmission:c.transmission, fuelType:c.fuelType, images:imgs, descriptionAr:"" });
    setSaveErr("");
    setShowF(true);
  };

  const saveCar = async () => {
    setSaveErr("");
    if (!form.make || !form.model || !form.pricePerDay) return;
    if (!form.plateNumber.trim()) { setSaveErr(t("رقم الترقيم المنجمي إجباري", "Le numéro d'immatriculation est obligatoire")); return; }
    setSaving(true);
    try {
      const payload = { ...form, agencyId, year: form.year ? Number(form.year) : null, pricePerDay: Number(form.pricePerDay), seats: Number(form.seats), images: form.images };
      let res: Response;
      if (editId) {
        res = await fetch(`/api/admin/car-rental/cars/${editId}`, { method:"PATCH", headers:{"Content-Type":"application/json","x-session-token":getSessionToken()||""}, body:JSON.stringify(payload) });
      } else {
        res = await fetch("/api/admin/car-rental/cars", { method:"POST", headers:{"Content-Type":"application/json","x-session-token":getSessionToken()||""}, body:JSON.stringify(payload) });
      }
      const data = await res.json();
      if (!res.ok) { setSaveErr(data.message || t("حدث خطأ", "Erreur")); return; }
      setShowF(false); await load();
    } finally { setSaving(false); }
  };

  const removeCar = async (id: number) => {
    if (!confirm(t("حذف السيارة؟","Supprimer ?!"))) return;
    await del(`/admin/car-rental/cars/${id}`); load();
  };
  const toggleCar = async (c: Car) => {
    await patch(`/admin/car-rental/cars/${c.id}`, { isAvailable: !c.isAvailable });
    setCars(prev => prev.map(x => x.id === c.id ? { ...x, isAvailable: !x.isAvailable } : x));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black" style={{ color: "#1565C0" }}>{t("السيارات","Voitures")} <span className="opacity-40">({cars.length})</span></p>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white" style={{ background: "#1565C0" }}>
          <Plus size={12}/>{t("سيارة جديدة","Nouvelle voiture")}
        </button>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-blue-400/20 border-t-blue-500 animate-spin" /></div>
      : cars.length === 0 ? <div className="flex flex-col items-center py-8 gap-2 opacity-30"><Car size={28} style={{ color: "#1565C0" }} /><p className="text-sm font-bold" style={{ color: "#1565C0" }}>{t("لا توجد سيارات","Aucune voiture")}</p></div>
      : <div className="space-y-2">
          {cars.map(c => (
            <div key={c.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1.5px solid #1565C011" }}>
              <div className="flex items-center gap-3 p-3">
                {(() => {
                  let imgs: string[] = [];
                  try { imgs = c.images ? JSON.parse(c.images) : []; } catch {}
                  const src = imgs[0] || c.imageUrl;
                  return src
                    ? <img src={src} alt="" className="w-16 h-12 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-16 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#1565C008" }}><Car size={20} style={{ color: "#1565C0" }} className="opacity-30" /></div>;
                })()}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm" style={{ color: "#1565C0" }}>{c.make} {c.model} {c.year || ""}</p>
                  <p className="text-xs opacity-50" style={{ color: "#1565C0" }}>{c.plateNumber} • {c.color} • {c.seats} {t("مقاعد","places")}</p>
                  <p className="text-xs font-black" style={{ color: "#FFA500" }}>{c.pricePerDay} TND/{t("يوم","j")}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleCar(c)} className={`p-1.5 rounded-lg border ${c.isAvailable ? "bg-emerald-400/10 text-emerald-500 border-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20"}`}><Power size={12}/></button>
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-[#1565C0]/5 border border-[#1565C0]/10"><Pencil size={12} style={{ color: "#1565C0" }}/></button>
                  <button onClick={() => removeCar(c.id)} className="p-1.5 rounded-lg bg-red-400/5 border border-red-400/10"><Trash2 size={12} className="text-red-400"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>}

      <AnimatePresence>
        {showF && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowF(false)}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-3"
              style={{ background: "#FFF3E0" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between" dir="rtl">
                <h3 className="font-black text-sm" style={{ color: "#1565C0" }}>{editId ? t("تعديل سيارة","Modifier voiture") : t("سيارة جديدة","Nouvelle voiture")}</h3>
                <button onClick={() => setShowF(false)}><X size={16} className="opacity-40" /></button>
              </div>
              <div className="space-y-3" dir="rtl">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("الماركة *","Marque *")}</label>
                    <input value={form.make} onChange={e => setForm(p => ({...p, make:e.target.value}))} placeholder="Toyota"
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("الموديل *","Modèle *")}</label>
                    <input value={form.model} onChange={e => setForm(p => ({...p, model:e.target.value}))} placeholder="Yaris"
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }} dir="ltr" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("السنة","Année")}</label>
                    <input type="number" value={form.year} onChange={e => setForm(p => ({...p, year:e.target.value}))} placeholder="2022"
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }} dir="ltr" />
                  </div>
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("اللون","Couleur")}</label>
                    <input value={form.color} onChange={e => setForm(p => ({...p, color:e.target.value}))} placeholder={t("أبيض","Blanc")}
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("رقم الترقيم المنجمي *","Immatriculation *")}</label>
                  <input value={form.plateNumber} onChange={e => setForm(p => ({...p, plateNumber:e.target.value}))} placeholder="123 TU 4567"
                    className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" dir="ltr" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("السعر/يوم (TND) *","Prix/jour (TND) *")}</label>
                    <input type="number" value={form.pricePerDay} onChange={e => setForm(p => ({...p, pricePerDay:e.target.value}))} placeholder="80"
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" dir="ltr" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }} />
                  </div>
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("المقاعد","Places")}</label>
                    <select value={form.seats} onChange={e => setForm(p => ({...p, seats:e.target.value}))}
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }}>
                      {[2,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("ناقل الحركة","Transmission")}</label>
                    <select value={form.transmission} onChange={e => setForm(p => ({...p, transmission:e.target.value}))}
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }}>
                      <option value="manual">{t("يدوي","Manuelle")}</option>
                      <option value="automatic">{t("أوتوماتيك","Automatique")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black opacity-60 block mb-1" style={{ color: "#1565C0" }}>{t("الوقود","Carburant")}</label>
                    <select value={form.fuelType} onChange={e => setForm(p => ({...p, fuelType:e.target.value}))}
                      className="w-full rounded-xl px-3 py-2 text-sm font-bold border outline-none" style={{ background: "#fff", borderColor: "#1565C033", color: "#1565C0" }}>
                      <option value="essence">{t("بنزين","Essence")}</option>
                      <option value="diesel">{t("ديزل","Diesel")}</option>
                      <option value="hybrid">{t("هجين","Hybride")}</option>
                      <option value="electrique">{t("كهربائي","Électrique")}</option>
                    </select>
                  </div>
                </div>
                <MultiImagePickerAdmin
                  images={form.images}
                  onChange={imgs => setForm(p => ({ ...p, images: imgs }))}
                  accent="#1565C0"
                  t={t}
                />
                {saveErr && (
                  <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-600">{saveErr}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={saveCar} disabled={saving || !form.make || !form.model || !form.pricePerDay || !form.plateNumber.trim()}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: "#1565C0" }}>
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    {editId ? t("حفظ","Enregistrer") : t("إضافة","Ajouter")}
                  </button>
                  <button onClick={() => { setShowF(false); setSaveErr(""); }} className="px-4 py-2.5 rounded-xl font-black text-sm border" style={{ color: "#1565C0", borderColor: "#1565C033" }}>{t("إلغاء","Annuler")}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Admin Provider Drawer — slides up and shows full provider management */
function AdminProviderDrawer({ supplier, t, lang, onClose }: { supplier: Supplier; t: (ar: string, fr: string) => string; lang: string; onClose: () => void; }) {
  const CAT = supplier.category;
  const isProductCat = ["restaurant","grocery","pharmacy","bakery","butcher","cafe","sweets","clothing"].includes(CAT);
  const isHotel     = CAT === "hotel";
  const isCarRental = CAT === "car_rental";
  const isSos       = CAT === "sos";
  const isLawyer    = CAT === "lawyer";

  type TabId = "content" | "cars" | "vehicle";
  const tabDefs: { id: TabId; ar: string; fr: string }[] = isCarRental
    ? [{ id:"cars", ar:"السيارات", fr:"Voitures" }]
    : isSos
    ? [{ id:"vehicle", ar:"الشاحنة", fr:"Véhicule" }]
    : [{ id:"content", ar: isHotel ? "الغرف" : isLawyer ? "التخصصات" : "المنتجات", fr: isHotel ? "Chambres" : isLawyer ? "Spécialités" : "Produits" }];

  const [tab, setTab] = useState<TabId>(tabDefs[0].id);

  // SOS photo state
  const [sosPhoto, setSosPhoto]   = useState(supplier.photoUrl || "");
  const [sosSaving, setSosSaving] = useState(false);
  const [sosSaved,  setSosSaved]  = useState(false);

  const saveSosPhoto = async () => {
    setSosSaving(true);
    try {
      await patch(`/provider/${supplier.id}/photo`, { photoUrl: sosPhoto });
      setSosSaved(true); setTimeout(() => setSosSaved(false), 2500);
    } finally { setSosSaving(false); }
  };

  const accentColor = isCarRental ? "#1565C0" : isSos ? "#EF4444" : "#1A4D1F";
  const catLabel = lang === "ar" ? CATEGORY_LABELS[CAT]?.ar : CATEGORY_LABELS[CAT]?.fr;

  return createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end" style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full max-h-[92vh] rounded-t-3xl overflow-y-auto"
          style={{ background: "#FFF3E0" }} onClick={e => e.stopPropagation()}>

          {/* ── Sticky Header ── */}
          <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b border-[#1A4D1F]/10" style={{ background: "#FFF3E0" }}>
            <div className="flex items-start justify-between" dir="rtl">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-[#1A4D1F]">{supplier.nameAr}</h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: accentColor + "20", color: accentColor }}>{catLabel}</span>
                </div>
                {supplier.phone && <p className="text-xs opacity-40 mt-0.5" style={{ color: "#1A4D1F" }}>{supplier.phone}</p>}
                {/* Admin badge */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Shield size={10} style={{ color: "#FFA500" }} />
                  <span className="text-[10px] font-black" style={{ color: "#FFA500" }}>{t("إدارة كصاحب الخدمة","Géré en tant que propriétaire")}</span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl bg-[#1A4D1F]/5 ms-2 flex-shrink-0"><X size={16} style={{ color: "#1A4D1F" }} /></button>
            </div>

            {/* Tabs */}
            {tabDefs.length > 1 && (
              <div className="flex gap-2 mt-3" dir="rtl">
                {tabDefs.map(td => (
                  <button key={td.id} onClick={() => setTab(td.id)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-black transition-all"
                    style={{ background: tab === td.id ? accentColor : accentColor + "15", color: tab === td.id ? "#fff" : accentColor }}>
                    {lang === "ar" ? td.ar : td.fr}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Content ── */}
          <div className="p-4 pb-10">
            {/* Products / Rooms / Specialties */}
            {tab === "content" && (
              <AdminArticlesManager
                supplierId={supplier.id}
                mode={isHotel ? "room" : isLawyer ? "specialty" : "product"}
                t={t}
                lang={lang}
              />
            )}

            {/* Cars */}
            {tab === "cars" && (
              <AdminCarsManager agencyId={supplier.id} t={t} lang={lang} />
            )}

            {/* SOS Vehicle Photo */}
            {tab === "vehicle" && (
              <div className="space-y-4">
                <AdminImagePicker
                  value={sosPhoto}
                  onChange={v => { setSosPhoto(v); setSosSaved(false); }}
                  label={t("صورة شاحنة الإنقاذ","Photo du véhicule")}
                  guideAr="صورة واضحة من الواجهة للشاحنة"
                  guideFr="Photo nette de face du camion"
                  aspect="16:9"
                  accent="#EF4444"
                  t={t}
                />
                <button onClick={saveSosPhoto}
                  disabled={sosSaving || sosPhoto === (supplier.photoUrl || "")}
                  className="w-full py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                  style={{ background: sosSaved ? "#059669" : "#EF4444" }}>
                  {sosSaving ? <RefreshCw size={13} className="animate-spin" /> : sosSaved ? <Check size={13} /> : <Camera size={13} />}
                  {sosSaving ? t("جارٍ الحفظ...","Enregistrement...") : sosSaved ? t("تم الحفظ ✓","Sauvegardé ✓") : t("حفظ صورة الشاحنة","Sauvegarder")}
                </button>
                <div className="rounded-xl p-3 border" style={{ background: "#EF444408", borderColor: "#EF444422" }}>
                  <p className="text-xs font-bold opacity-60" style={{ color: "#EF4444" }}>
                    {t("تظهر هذه الصورة للعملاء عند استجابة الشاحنة لطلب SOS","Cette photo est visible par les clients lors d'une intervention SOS")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Supplier Card — extracted for reuse in both product & service groups
// ──────────────────────────────────────────────────────────────────────────────
function SupplierCard({ s, t, lang, type, typeConfig, onManage, onToggle, onEdit, onDelete }: {
  s: Supplier;
  t: (ar: string, fr: string) => string;
  lang: string;
  type: "product" | "service";
  typeConfig: Record<string, { color: string; bg: string; border: string; ar: string; fr: string; icon: React.FC<any> }>;
  onManage: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = typeConfig[type];
  return (
    <div className="glass-panel rounded-2xl p-4" style={{ borderLeft: `3px solid ${cfg.color}30` }}>
      <div className="flex items-start gap-3 justify-between">
        {/* Logo */}
        {(s as any).photoUrl ? (
          <img src={(s as any).photoUrl} alt={s.nameAr}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#1A4D1F]/10" />
        ) : (
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
            <cfg.icon size={18} style={{ color: cfg.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-[#1A4D1F]">{s.nameAr}</p>
            {/* Category badge */}
            <span className="text-xs px-2 py-0.5 rounded-full font-black"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              {lang === "ar" ? CATEGORY_LABELS[s.category]?.ar : CATEGORY_LABELS[s.category]?.fr}
            </span>
            {/* Pharmacy shift badge */}
            {s.category === "pharmacy" && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full border",
                s.shift === "day"   ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                s.shift === "night" ? "bg-blue-400/10 text-blue-400 border-blue-400/20"   :
                                      "bg-[#1A4D1F]/5 text-[#1A4D1F]/40 border-[#1A4D1F]/10"
              )}>
                {s.shift === "day"   ? <><Sun size={10} className="inline mr-1"/>{t("نهاري","Jour")}</> :
                 s.shift === "night" ? <><Moon size={10} className="inline mr-1"/>{t("ليلي","Nuit")}</> :
                 t("الكل","Tout")}
              </span>
            )}
          </div>
          <p className="text-sm text-[#1A4D1F]/40 truncate">{s.address}</p>
          {s.phone && <p className="text-xs text-[#1A4D1F]/30">{s.phone}</p>}
          <Stars rating={s.rating} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Manage as provider */}
          <button onClick={onManage}
            title={lang === "ar" ? "إدارة كصاحب الخدمة" : "Gérer en tant que propriétaire"}
            className="p-2 rounded-xl border transition-all"
            style={{ background: "#FFA50015", borderColor: "#FFA50033", color: "#FFA500" }}>
            <Wrench size={14} />
          </button>
          {/* Toggle availability */}
          <button onClick={onToggle}
            className={cn("p-2 rounded-xl border transition-all",
              s.isAvailable
                ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20"
                : "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20")}>
            <Power size={14} />
          </button>
          <button onClick={onEdit} className="p-2 rounded-xl bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors border border-[#1A4D1F]/5">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-red-400 transition-colors border border-[#1A4D1F]/5">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Suppliers
// ──────────────────────────────────────────────────────────────────────────────
function SuppliersSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [items, setItems]       = useState<Supplier[]>([]);
  const [modal, setModal]       = useState<null | "add" | Supplier>(null);
  const [managing, setManaging] = useState<Supplier | null>(null);
  const [filter, setFilter]     = useState<"all" | "products" | "services">("all");
  const [formType, setFormType] = useState<"product" | "service">("product");
  const [createdCreds, setCreatedCreds] = useState<{ phone: string; password: string } | null>(null);
  const [form, setForm] = useState({ name:"", nameAr:"", category:"restaurant", description:"", descriptionAr:"", address:"", phone:"", photoUrl:"", shift:"all", isAvailable: true, latitude:"", longitude:"", providerPhone:"", providerPassword:"" });

  const load = () => get<Supplier[]>("/admin/suppliers").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const EMPTY_FORM = { name:"",nameAr:"",category:"restaurant",description:"",descriptionAr:"",address:"",phone:"",photoUrl:"",shift:"all",isAvailable:true,latitude:"",longitude:"",providerPhone:"",providerPassword:"" };

  const openAdd = () => {
    setFormType("product");
    setCreatedCreds(null);
    setForm(EMPTY_FORM);
    setModal("add");
  };
  const openEdit = (s: Supplier) => {
    setFormType(supplierType(s.category));
    setCreatedCreds(null);
    setForm({ name:s.name, nameAr:s.nameAr, category:s.category, description:s.description, descriptionAr:s.descriptionAr, address:s.address, phone:s.phone||"", photoUrl:(s as any).photoUrl||"", shift:s.shift||"all", isAvailable:s.isAvailable, latitude:s.latitude?.toString()||"", longitude:s.longitude?.toString()||"", providerPhone:"", providerPassword:"" });
    setModal(s);
  };

  const save = async () => {
    if (modal === "add") {
      const res = await post<{ supplier: Supplier; providerUser: { phone: string } | null }>("/admin/suppliers", form);
      if (form.providerPhone && res?.providerUser) {
        setCreatedCreds({ phone: form.providerPhone, password: form.providerPassword });
        // Keep modal open to show credentials
        load(); setModal(null);
        return;
      }
    } else {
      await patch(`/admin/suppliers/${(modal as Supplier).id}`, form);
    }
    setModal(null); load();
  };

  const toggle = async (id: number) => {
    await patch(`/admin/suppliers/${id}/toggle`, {});
    setItems(prev => prev.map(s => s.id === id ? {...s, isAvailable: !s.isAvailable} : s));
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل تريد الحذف؟","Confirmer ?"))) return;
    await del(`/admin/suppliers/${id}`); load();
  };

  // Category options grouped by type
  const productCatOptions = PRODUCT_CATS.map(v => ({ value: v, label: lang === "ar" ? CATEGORY_LABELS[v].ar : CATEGORY_LABELS[v].fr }));
  const serviceCatOptions = SERVICE_CATS.map(v => ({ value: v, label: lang === "ar" ? CATEGORY_LABELS[v].ar : CATEGORY_LABELS[v].fr }));
  const activeCatOptions  = formType === "product" ? productCatOptions : serviceCatOptions;

  // When switching form type, reset category to first of that group
  const switchFormType = (type: "product" | "service") => {
    setFormType(type);
    setForm(f => ({ ...f, category: type === "product" ? "restaurant" : "hotel" }));
  };

  // Filtered list
  const productCount = items.filter(s => supplierType(s.category) === "product").length;
  const serviceCount = items.filter(s => supplierType(s.category) === "service").length;
  const visible = filter === "all" ? items
    : items.filter(s => supplierType(s.category) === (filter === "products" ? "product" : "service"));

  // Type visual config
  const typeConfig = {
    product: { color: "#1A4D1F", bg: "#1A4D1F12", border: "#1A4D1F25", ar: "منتجات", fr: "Produits", icon: Package },
    service: { color: "#1565C0", bg: "#1565C012", border: "#1565C025", ar: "خدمات",  fr: "Services", icon: Zap },
  };

  const tabBtns: { key: "all" | "products" | "services"; arLabel: string; frLabel: string; count: number }[] = [
    { key: "all",      arLabel: "الكل",          frLabel: "Tous",      count: items.length    },
    { key: "products", arLabel: "مزودو المنتجات", frLabel: "Produits",  count: productCount    },
    { key: "services", arLabel: "مزودو الخدمات",  frLabel: "Services",  count: serviceCount    },
  ];

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-[#1A4D1F]">{t("المزودون","Fournisseurs")}</h2>
        <GoldBtn onClick={openAdd}><Plus size={14} />{t("إضافة","Ajouter")}</GoldBtn>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "#1A4D1F10" }} dir="rtl">
        {tabBtns.map(tb => (
          <button key={tb.key} onClick={() => setFilter(tb.key)}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
            style={{
              background: filter === tb.key ? "#1A4D1F" : "transparent",
              color: filter === tb.key ? "#FFA500" : "#1A4D1F",
              opacity: filter === tb.key ? 1 : 0.5,
            }}>
            {lang === "ar" ? tb.arLabel : tb.frLabel}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black"
              style={{ background: filter === tb.key ? "#FFA50030" : "#1A4D1F20" }}>
              {tb.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Products group ── */}
      {(filter === "all" || filter === "products") && (
        <div className="space-y-2">
          {filter === "all" && (
            <div className="flex items-center gap-2 px-1">
              <Package size={13} style={{ color: typeConfig.product.color }} />
              <span className="text-xs font-black opacity-60" style={{ color: typeConfig.product.color }}>
                {t("مزودو المنتجات · للتوصيل", "Fournisseurs de produits · Livraison")}
              </span>
              <div className="flex-1 h-px" style={{ background: typeConfig.product.color + "25" }} />
            </div>
          )}
          {visible.filter(s => supplierType(s.category) === "product").map(s => (
            <SupplierCard key={s.id} s={s} t={t} lang={lang} type="product" typeConfig={typeConfig}
              onManage={() => setManaging(s)}
              onToggle={() => toggle(s.id)}
              onEdit={() => openEdit(s)}
              onDelete={() => remove(s.id)} />
          ))}
          {visible.filter(s => supplierType(s.category) === "product").length === 0 && filter === "products" && (
            <p className="text-center text-xs opacity-40 py-6 text-[#1A4D1F]">{t("لا يوجد مزودو منتجات", "Aucun fournisseur de produits")}</p>
          )}
        </div>
      )}

      {/* ── Services group ── */}
      {(filter === "all" || filter === "services") && (
        <div className="space-y-2">
          {filter === "all" && (
            <div className="flex items-center gap-2 px-1 mt-3">
              <Zap size={13} style={{ color: typeConfig.service.color }} />
              <span className="text-xs font-black opacity-60" style={{ color: typeConfig.service.color }}>
                {t("مزودو الخدمات", "Fournisseurs de services")}
              </span>
              <div className="flex-1 h-px" style={{ background: typeConfig.service.color + "25" }} />
            </div>
          )}
          {visible.filter(s => supplierType(s.category) === "service").map(s => (
            <SupplierCard key={s.id} s={s} t={t} lang={lang} type="service" typeConfig={typeConfig}
              onManage={() => setManaging(s)}
              onToggle={() => toggle(s.id)}
              onEdit={() => openEdit(s)}
              onDelete={() => remove(s.id)} />
          ))}
          {visible.filter(s => supplierType(s.category) === "service").length === 0 && filter === "services" && (
            <p className="text-center text-xs opacity-40 py-6 text-[#1565C0]">{t("لا يوجد مزودو خدمات", "Aucun fournisseur de services")}</p>
          )}
        </div>
      )}

      {/* ── Form Modal ── */}
      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal === "add" ? t("إضافة مزود","Ajouter fournisseur") : t("تعديل مزود","Modifier fournisseur")}>

        {/* Type toggle — only in add mode */}
        {modal === "add" && (
          <div className="flex gap-2 p-1 rounded-xl mb-1" style={{ background: "#1A4D1F08" }}>
            {(["product","service"] as const).map(tp => {
              const cfg = typeConfig[tp];
              const Icon = cfg.icon;
              return (
                <button key={tp} onClick={() => switchFormType(tp)}
                  className="flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                  style={{
                    background: formType === tp ? cfg.color : "transparent",
                    color: formType === tp ? "#fff" : cfg.color,
                    opacity: formType === tp ? 1 : 0.5,
                  }}>
                  <Icon size={12} />
                  {lang === "ar" ? (tp === "product" ? "مزود منتجات" : "مزود خدمات") : (tp === "product" ? "Fournisseur produits" : "Fournisseur services")}
                </button>
              );
            })}
          </div>
        )}

        {/* Common fields */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="صيدلية الأمل" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Pharmacie Amal" /></Field>
        </div>

        {/* Category */}
        <Field label={t("الفئة","Catégorie")}>
          <Select value={form.category} onChange={v => setForm(f => ({...f, category: v}))} options={activeCatOptions} />
        </Field>
        {form.category === "pharmacy" && (
          <Field label={t("فترة العمل","Horaire")}>
            <Select value={form.shift} onChange={v => setForm(f => ({...f, shift: v}))} options={[
              { value: "all", label: t("كل اليوم","Toute la journée") },
              { value: "day", label: t("نهاري (06:00-22:00)","Jour (06:00-22:00)") },
              { value: "night", label: t("ليلي (22:00-06:00)","Nuit (22:00-06:00)") },
            ]} />
          </Field>
        )}

        {/* Supplier Logo / Photo */}
        <AdminImagePicker
          value={form.photoUrl}
          onChange={v => setForm(f => ({ ...f, photoUrl: v }))}
          label={t("شعار / صورة المحل", "Logo / Photo de l'établissement")}
          guideAr="شعار واضح على خلفية بيضاء أو بيضاوية"
          guideFr="Logo net sur fond blanc ou neutre"
          aspect="1:1"
          accent="#1A4D1F"
          t={t}
        />

        <Field label={t("العنوان","Adresse")}><Input value={form.address} onChange={v => setForm(f => ({...f, address: v}))} /></Field>
        <Field label={t("رقم WhatsApp","Numéro WhatsApp")}><Input value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} placeholder="21698..." /></Field>
        <Field label={t("الوصف عربي","Description arabe")}><Input value={form.descriptionAr} onChange={v => setForm(f => ({...f, descriptionAr: v}))} /></Field>
        <Field label={t("الوصف فرنسي","Description française")}><Input value={form.description} onChange={v => setForm(f => ({...f, description: v}))} /></Field>
        <Field label={t("متاح","Disponible")}><Toggle checked={form.isAvailable} onChange={v => setForm(f => ({...f, isAvailable: v}))} label={form.isAvailable ? t("نعم","Oui") : t("لا","Non")} /></Field>

        {/* GPS */}
        <div className="rounded-xl p-3 border border-[#FFA500]/30 bg-[#FFA500]/5">
          <p className="text-xs font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-2">
            {t("إحداثيات GPS (لحساب المسافة)","Coordonnées GPS (calcul distance)")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("خط العرض","Latitude")}>
              <Input value={form.latitude} onChange={v => setForm(f => ({...f, latitude: v}))} placeholder="33.1167" />
            </Field>
            <Field label={t("خط الطول","Longitude")}>
              <Input value={form.longitude} onChange={v => setForm(f => ({...f, longitude: v}))} placeholder="11.2167" />
            </Field>
          </div>
          <p className="text-[10px] text-[#1A4D1F]/30 mt-1">
            {t("اختياري · بن قردان: 33.1167, 11.2167","Optionnel · Ben Guerdane: 33.1167, 11.2167")}
          </p>
        </div>

        {/* Account creation — add mode only */}
        {modal === "add" && (
          <div className="rounded-xl p-3 border-2 space-y-3" style={{ borderColor: "#1565C030", background: "#1565C008" }}>
            <div className="flex items-center gap-2">
              <KeyRound size={13} style={{ color: "#1565C0" }} />
              <p className="text-xs font-black" style={{ color: "#1565C0" }}>
                {t("إنشاء حساب تسجيل دخول للمزود (اختياري)", "Créer un compte d'accès fournisseur (optionnel)")}
              </p>
            </div>
            <p className="text-[10px] opacity-50" style={{ color: "#1565C0" }}>
              {t("إذا أدخلت الرقم وكلمة المرور، سيتمكن المزود من تسجيل الدخول وإدارة محله مباشرة.",
                "Si vous renseignez le numéro et le mot de passe, le fournisseur pourra se connecter et gérer son établissement.")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("رقم الهاتف للحساب","Tél. du compte")}>
                <Input value={form.providerPhone} onChange={v => setForm(f => ({...f, providerPhone: v}))} placeholder="21698..." />
              </Field>
              <Field label={t("كلمة المرور","Mot de passe")}>
                <Input value={form.providerPassword} onChange={v => setForm(f => ({...f, providerPassword: v}))} placeholder="6+ أحرف" type="password" />
              </Field>
            </div>
          </div>
        )}

        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>

      {/* ── Credentials success dialog ── */}
      <Modal open={!!createdCreds} onClose={() => setCreatedCreds(null)}
        title={t("تم إنشاء المزود والحساب","Fournisseur et compte créés")}>
        {createdCreds && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 text-center" style={{ background: "#1A4D1F10", border: "1.5px solid #1A4D1F30" }}>
              <Check size={28} className="mx-auto mb-2" style={{ color: "#1A4D1F" }} />
              <p className="font-black text-[#1A4D1F] text-sm">{t("تم إنشاء حساب المزود بنجاح","Compte fournisseur créé avec succès")}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-[#1A4D1F]/60 uppercase tracking-widest">{t("بيانات الدخول","Identifiants de connexion")}</p>
              <div className="rounded-xl p-3 font-mono text-sm space-y-2" style={{ background: "#1A4D1F08", border: "1px solid #1A4D1F20" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[#1A4D1F]/50 text-xs">{t("رقم الهاتف","Téléphone")}</span>
                  <span className="font-black text-[#1A4D1F]">{createdCreds.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1A4D1F]/50 text-xs">{t("كلمة المرور","Mot de passe")}</span>
                  <span className="font-black text-[#FFA500]">{createdCreds.password}</span>
                </div>
              </div>
              <p className="text-[10px] opacity-40 text-[#1A4D1F]">
                {t("احتفظ بهذه البيانات — لن تظهر مرة أخرى","Conservez ces identifiants — ils ne seront plus affichés")}
              </p>
            </div>
            <GoldBtn onClick={() => setCreatedCreds(null)} className="w-full justify-center">{t("موافق","OK")}</GoldBtn>
          </div>
        )}
      </Modal>

      {/* ── Admin Provider Drawer ── */}
      <AnimatePresence>
        {managing && (
          <AdminProviderDrawer
            supplier={managing}
            t={t}
            lang={lang}
            onClose={() => setManaging(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Articles
// ──────────────────────────────────────────────────────────────────────────────
function ArticlesSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [items, setItems]       = useState<Article[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modal, setModal]       = useState<null | "add" | Article>(null);
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState("");
  const [filterSup, setFilterSup] = useState<string>("all");
  const EMPTY_FORM = { supplierId: "", nameAr: "", nameFr: "", descriptionAr: "", descriptionFr: "", price: "0", originalPrice: "", discountedPrice: "", photoUrl: "", isAvailable: true };
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    const [a, s] = await Promise.all([
      get<Article[]>("/admin/articles").catch(() => []),
      get<Supplier[]>("/admin/suppliers").catch(() => []),
    ]);
    setItems(a); setSuppliers(s);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setErrMsg("");
    setForm({ ...EMPTY_FORM, supplierId: suppliers[0]?.id?.toString() || "" });
    setModal("add");
  };
  const openEdit = (a: Article) => {
    setErrMsg("");
    setForm({
      supplierId: a.supplierId.toString(),
      nameAr: a.nameAr, nameFr: a.nameFr,
      descriptionAr: a.descriptionAr, descriptionFr: a.descriptionFr,
      price: a.price.toString(),
      originalPrice: a.originalPrice?.toString() || "",
      discountedPrice: a.discountedPrice?.toString() || "",
      photoUrl: (a as any).photoUrl || "",
      isAvailable: a.isAvailable,
    });
    setModal(a);
  };

  const save = async () => {
    setErrMsg("");
    if (!form.supplierId) { setErrMsg(t("الرجاء اختيار المزود","Veuillez choisir un fournisseur")); return; }
    if (!form.nameAr.trim()) { setErrMsg(t("اسم المنتج بالعربية مطلوب","Le nom en arabe est requis")); return; }
    setSaving(true);
    try {
      const payload = {
        supplierId: form.supplierId,
        nameAr: form.nameAr.trim(),
        nameFr: form.nameFr.trim() || form.nameAr.trim(),
        descriptionAr: form.descriptionAr,
        descriptionFr: form.descriptionFr || form.descriptionAr,
        price: parseFloat(form.price) || 0,
        originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : null,
        discountedPrice: form.discountedPrice ? parseFloat(form.discountedPrice) : null,
        photoUrl: form.photoUrl || null,
        isAvailable: form.isAvailable,
      };
      if (modal === "add") {
        await post("/admin/articles", payload);
      } else {
        await patch(`/admin/articles/${(modal as Article).id}`, payload);
      }
      setModal(null);
      await load();
    } catch (err: any) {
      setErrMsg(err?.message || t("حدث خطأ أثناء الحفظ","Erreur lors de la sauvegarde"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل تريد الحذف؟","Confirmer ?"))) return;
    await del(`/admin/articles/${id}`); load();
  };

  const toggleAvail = async (a: Article) => {
    await patch(`/admin/articles/${a.id}`, { isAvailable: !a.isAvailable });
    load();
  };

  /* Filter articles by selected supplier */
  const filtered = filterSup === "all" ? items : items.filter(a => String(a.supplierId) === filterSup);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("المنتجات","Articles")}</h2>
          <p className="text-xs text-[#1A4D1F]/40 mt-0.5">
            {filtered.length} {t("منتج","produit(s)")}
            {filterSup !== "all" && ` — ${suppliers.find(s => String(s.id) === filterSup)?.nameAr || ""}`}
          </p>
        </div>
        <GoldBtn onClick={openAdd}><Plus size={14} />{t("إضافة منتج","Ajouter")}</GoldBtn>
      </div>

      {/* Supplier filter tabs */}
      {suppliers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterSup("all")}
            className={cn("px-3 py-1 rounded-xl text-xs font-bold border transition-all",
              filterSup === "all"
                ? "bg-[#1A4D1F] text-white border-[#1A4D1F]"
                : "bg-transparent text-[#1A4D1F]/60 border-[#1A4D1F]/20 hover:border-[#1A4D1F]/40"
            )}
          >
            {t("الكل","Tous")}
          </button>
          {suppliers.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterSup(String(s.id))}
              className={cn("px-3 py-1 rounded-xl text-xs font-bold border transition-all",
                filterSup === String(s.id)
                  ? "bg-[#FFA500] text-white border-[#FFA500]"
                  : "bg-transparent text-[#1A4D1F]/60 border-[#1A4D1F]/20 hover:border-[#1A4D1F]/40"
              )}
            >
              {s.nameAr}
              <span className="mr-1 opacity-60">
                ({items.filter(a => a.supplierId === s.id).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      {filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <p className="text-[#1A4D1F]/30 font-bold">{t("لا توجد منتجات","Aucun article")}</p>
          <p className="text-xs text-[#1A4D1F]/20 mt-1">{t("اضغط إضافة لإضافة منتج للمزود","Cliquez Ajouter pour créer un article")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="glass-panel rounded-2xl p-4 flex flex-col gap-2">
              {/* Image */}
              {(a as any).photoUrl && (
                <img src={(a as any).photoUrl} alt={a.nameAr} className="w-full h-28 object-cover rounded-xl mb-1" />
              )}
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1A4D1F] truncate">{lang === "ar" ? a.nameAr : a.nameFr}</p>
                  {/* Supplier badge */}
                  {a.supplierName && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#FFA500] bg-[#FFA500]/10 border border-[#FFA500]/20 rounded-full px-2 py-0.5 mt-1 font-bold">
                      🏪 {a.supplierName}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleAvail(a)}
                    className={cn("p-1.5 rounded-lg border transition-all text-xs",
                      a.isAvailable ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20"
                    )}
                    title={a.isAvailable ? t("تعطيل","Désactiver") : t("تفعيل","Activer")}
                  >
                    <Power size={11} />
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors"><Pencil size={12} /></button>
                  <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                </div>
              </div>
              {/* Price */}
              <div className="flex items-center gap-2 flex-wrap">
                {a.discountedPrice ? (
                  <>
                    <span className="text-[#1A4D1F] font-black">{a.discountedPrice} TND</span>
                    <span className="text-[#1A4D1F]/30 line-through text-xs">{a.originalPrice || a.price} TND</span>
                    <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                      -{Math.round(((a.originalPrice || a.price) - a.discountedPrice) / (a.originalPrice || a.price) * 100)}%
                    </span>
                  </>
                ) : (
                  <span className="text-[#1A4D1F] font-black">{a.price} TND</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={!!modal}
        onClose={() => { setModal(null); setErrMsg(""); }}
        title={modal === "add" ? t("إضافة منتج للمزود","Ajouter un article") : t("تعديل منتج","Modifier l'article")}
      >
        {/* Supplier selector — prominent */}
        <div className="bg-[#FFA500]/10 border border-[#FFA500]/30 rounded-xl p-3 mb-2">
          <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1.5">
            🏪 {t("المزود (يظهر المنتج في حساب هذا المزود)","Fournisseur (l'article apparaît dans son compte)")}
          </label>
          <Select
            value={form.supplierId}
            onChange={v => setForm(f => ({...f, supplierId: v}))}
            options={suppliers.map(s => ({ value: s.id.toString(), label: `${s.nameAr} — ${s.name}` }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي *","Nom arabe *")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="مثال: برجر كلاسيك" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.nameFr} onChange={v => setForm(f => ({...f, nameFr: v}))} placeholder="Ex: Burger classique" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("السعر (TND)","Prix (TND)")}><Input type="number" value={form.price} onChange={v => setForm(f => ({...f, price: v}))} /></Field>
          <Field label={t("السعر الأصلي","Prix original")}><Input type="number" value={form.originalPrice} onChange={v => setForm(f => ({...f, originalPrice: v}))} placeholder="—" /></Field>
          <Field label={t("السعر المخفض","Prix réduit")}><Input type="number" value={form.discountedPrice} onChange={v => setForm(f => ({...f, discountedPrice: v}))} placeholder="—" /></Field>
        </div>
        <Field label={t("الوصف عربي","Description arabe")}><Input value={form.descriptionAr} onChange={v => setForm(f => ({...f, descriptionAr: v}))} /></Field>
        <Field label={t("الوصف فرنسي","Description française")}><Input value={form.descriptionFr} onChange={v => setForm(f => ({...f, descriptionFr: v}))} /></Field>
        <AdminImagePicker
          value={form.photoUrl}
          onChange={v => setForm(f => ({ ...f, photoUrl: v }))}
          label={t("صورة المنتج", "Photo du produit")}
          guideAr="صورة واضحة للمنتج على خلفية محايدة"
          guideFr="Photo nette du produit sur fond neutre"
          aspect="1:1"
          accent="#1A4D1F"
          t={t}
        />
        <Field label={t("متاح","Disponible")}><Toggle checked={form.isAvailable} onChange={v => setForm(f => ({...f, isAvailable: v}))} label={form.isAvailable ? t("نعم","Oui") : t("لا","Non")} /></Field>

        {errMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 font-bold text-center">
            ⚠️ {errMsg}
          </div>
        )}

        <GoldBtn onClick={save} disabled={saving} className="w-full justify-center">
          {saving ? <RefreshCw size={14} className="animate-spin mx-auto" /> : t("حفظ المنتج","Enregistrer")}
        </GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Delivery Staff
// ──────────────────────────────────────────────────────────────────────────────
function DeliveryStaffSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<DeliveryStaff[]>([]);
  const [modal, setModal] = useState<null | "add" | DeliveryStaff>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [form, setForm] = useState({ name:"", nameAr:"", phone:"", zone:"", isAvailable: true });
  const [acctForm, setAcctForm] = useState({ driverPhone:"", driverPassword:"", createAccount: false });

  const load = () => get<DeliveryStaff[]>("/admin/delivery-staff").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaveErr(""); setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (modal === "add" && acctForm.createAccount) {
        payload.driverPhone    = acctForm.driverPhone.trim();
        payload.driverPassword = acctForm.driverPassword;
      }
      if (modal === "add") await post("/admin/delivery-staff", payload);
      else await patch(`/admin/delivery-staff/${(modal as DeliveryStaff).id}`, payload);
      setModal(null); load();
    } catch (err: any) {
      setSaveErr(err?.message || t("حدث خطأ", "Erreur serveur"));
    } finally { setSaving(false); }
  };

  const toggle = async (id: number, current: boolean) => {
    await patch(`/admin/delivery-staff/${id}`, { isAvailable: !current });
    setItems(prev => prev.map(s => s.id === id ? {...s, isAvailable: !current} : s));
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف؟","Supprimer ?"))) return;
    await del(`/admin/delivery-staff/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-[#1A4D1F]">{t("عمال التوصيل","Livreurs")}</h2>
        <GoldBtn onClick={() => {
          setForm({name:"",nameAr:"",phone:"",zone:"",isAvailable:true});
          setAcctForm({driverPhone:"",driverPassword:"",createAccount:false});
          setSaveErr(""); setModal("add");
        }}><Plus size={14}/>{t("إضافة","Ajouter")}</GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(s => (
          <div key={s.id} className="glass-panel rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-[#1A4D1F]">{s.nameAr}</p>
                <p className="text-sm text-[#1A4D1F]/60">{s.name}</p>
                <p className="text-xs text-[#1A4D1F]/40">{s.phone}</p>
                {s.zone && <p className="text-xs text-[#FFA500] mt-1 font-bold">{s.zone}</p>}
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => toggle(s.id, s.isAvailable)}
                  className={cn("p-2 rounded-xl border transition-all", s.isAvailable ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20")}>
                  <Power size={14} />
                </button>
                <button onClick={() => {
                  setForm({name:s.name,nameAr:s.nameAr,phone:s.phone,zone:s.zone||"",isAvailable:s.isAvailable});
                  setAcctForm({driverPhone:"",driverPassword:"",createAccount:false});
                  setSaveErr(""); setModal(s);
                }} className="p-2 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors"><Pencil size={14} /></button>
                <button onClick={() => remove(s.id)} className="p-2 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-3 text-center py-8 text-[#1A4D1F]/30 text-sm">
            {t("لا يوجد عمال توصيل بعد", "Aucun livreur enregistré")}
          </div>
        )}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة سائق توصيل","Ajouter livreur") : t("تعديل سائق","Modifier livreur")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="أحمد" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Ahmed" /></Field>
        </div>
        <Field label={t("رقم الهاتف (WhatsApp)","Téléphone (WhatsApp)")}><Input value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} placeholder="+21698..." /></Field>
        <Field label={t("المنطقة / العمالة","Zone / Délégation")}><Input value={form.zone} onChange={v => setForm(f => ({...f, zone: v}))} placeholder={t("بن قردان الوسط","Centre BG")} /></Field>
        <Field label={t("متاح الآن","Disponible")}><Toggle checked={form.isAvailable} onChange={v => setForm(f => ({...f, isAvailable: v}))} /></Field>

        {/* ── Account creation (add mode only) ── */}
        {modal === "add" && (
          <div className="border border-[#1A4D1F]/10 rounded-xl p-4 space-y-3 mt-1" style={{ background: "rgba(26,77,31,0.03)" }}>
            <Field label={t("إنشاء حساب تسجيل دخول للسائق","Créer un compte de connexion")}>
              <Toggle checked={acctForm.createAccount} onChange={v => setAcctForm(f => ({...f, createAccount: v}))} />
            </Field>
            {acctForm.createAccount && (<>
              <Field label={t("هاتف تسجيل الدخول","Tél. connexion")}>
                <Input value={acctForm.driverPhone} onChange={v => setAcctForm(f => ({...f, driverPhone: v}))} placeholder="+21698..." />
              </Field>
              <Field label={t("كلمة المرور","Mot de passe")}>
                <Input value={acctForm.driverPassword} onChange={v => setAcctForm(f => ({...f, driverPassword: v}))} placeholder={t("6 أحرف على الأقل","6 caractères min.")} type="password" />
              </Field>
              <p className="text-xs text-[#1A4D1F]/40 text-center">{t("سيتم ربط الحساب تلقائياً بملف السائق","Le compte sera lié automatiquement au profil du livreur")}</p>
            </>)}
          </div>
        )}

        {saveErr && <p className="text-sm text-red-400 font-bold text-center">{saveErr}</p>}
        <GoldBtn onClick={save} disabled={saving} className="w-full justify-center">
          {saving ? <><div className="w-4 h-4 border-2 border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />{t("جارٍ الحفظ...","Sauvegarde...")}</> : t("حفظ","Enregistrer")}
        </GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Delegations
// ──────────────────────────────────────────────────────────────────────────────
function DelegationsSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<Delegation[]>([]);
  const [modal, setModal] = useState<null | "add" | Delegation>(null);
  const [form, setForm] = useState({ name: "", nameAr: "", deliveryFee: "0" });

  const load = () => get<Delegation[]>("/admin/delegations").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...form, deliveryFee: parseFloat(form.deliveryFee) || 0 };
    if (modal === "add") await post("/admin/delegations", payload);
    else await patch(`/admin/delegations/${(modal as Delegation).id}`, payload);
    setModal(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف؟","Supprimer ?"))) return;
    await del(`/admin/delegations/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-[#1A4D1F]">{t("المعتمديات","Délégations")}</h2>
        <GoldBtn onClick={() => { setForm({name:"",nameAr:"",deliveryFee:"0"}); setModal("add"); }}><Plus size={14}/>{t("إضافة","Ajouter")}</GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(d => (
          <div key={d.id} className="glass-panel rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-[#1A4D1F]">{d.nameAr}</p>
              <p className="text-sm text-[#1A4D1F]/40">{d.name}</p>
              <p className="text-[#1A4D1F] font-black mt-1">{d.deliveryFee} TND</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setForm({name:d.name,nameAr:d.nameAr,deliveryFee:d.deliveryFee.toString()}); setModal(d); }} className="p-2 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors"><Pencil size={14}/></button>
              <button onClick={() => remove(d.id)} className="p-2 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة معتمدية","Ajouter délégation") : t("تعديل","Modifier")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="بن قردان" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Ben Guerdane" /></Field>
        </div>
        <Field label={t("رسوم التوصيل (TND)","Frais de livraison (TND)")}><Input type="number" value={form.deliveryFee} onChange={v => setForm(f => ({...f, deliveryFee: v}))} /></Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Taxi Drivers
// ──────────────────────────────────────────────────────────────────────────────
interface TaxiDriver {
  id: number; userId: number; name: string; phone: string;
  carModel?: string | null; carColor?: string | null; carPlate?: string | null;
  isAvailable: boolean; isActive: boolean; createdAt: string;
}

const EMPTY_TAXI_FORM = { name: "", phone: "", password: "", carModel: "", carColor: "", carPlate: "", isAvailable: true, isActive: true };

function TaxiDriversSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems]   = useState<TaxiDriver[]>([]);
  const [modal, setModal]   = useState<null | "add" | TaxiDriver>(null);
  const [form, setForm]     = useState({ ...EMPTY_TAXI_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const load = () => get<TaxiDriver[]>("/admin/taxi/drivers").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(""); setSaving(true);
    try {
      if (modal === "add") {
        if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) {
          setErr(t("الاسم والهاتف وكلمة المرور مطلوبة", "Nom, téléphone et mot de passe requis")); setSaving(false); return;
        }
        await post("/admin/taxi/drivers", form);
      } else {
        await patch(`/admin/taxi/drivers/${(modal as TaxiDriver).id}`, {
          carModel: form.carModel, carColor: form.carColor, carPlate: form.carPlate,
          isAvailable: form.isAvailable, isActive: form.isActive,
        });
      }
      setModal(null); load();
    } catch (e: any) { setErr(e.message || t("خطأ في الحفظ", "Erreur")); }
    finally { setSaving(false); }
  };

  const toggleAvail = async (d: TaxiDriver) => {
    await patch(`/admin/taxi/drivers/${d.id}`, { isAvailable: !d.isAvailable });
    setItems(prev => prev.map(x => x.id === d.id ? { ...x, isAvailable: !d.isAvailable } : x));
  };

  const toggleActive = async (d: TaxiDriver) => {
    await patch(`/admin/taxi/drivers/${d.id}`, { isActive: !d.isActive });
    setItems(prev => prev.map(x => x.id === d.id ? { ...x, isActive: !d.isActive } : x));
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف هذا السائق؟ سيتم حذف حسابه أيضاً.", "Supprimer ce chauffeur ? Son compte sera aussi supprimé."))) return;
    await del(`/admin/taxi/drivers/${id}`); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("سائقو التاكسي", "Chauffeurs Taxi")}</h2>
          <p className="text-xs text-[#1A4D1F]/50 font-bold mt-0.5">
            {t(`${items.length} سائق مسجّل`, `${items.length} chauffeur(s) enregistré(s)`)}
          </p>
        </div>
        <GoldBtn onClick={() => { setForm({ ...EMPTY_TAXI_FORM }); setErr(""); setModal("add"); }}>
          <Plus size={14} /> {t("إضافة سائق تاكسي", "Ajouter chauffeur")}
        </GoldBtn>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 flex-wrap text-sm">
        <span className="px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-500 border border-emerald-400/20 font-bold">
          {items.filter(d => d.isAvailable && d.isActive).length} {t("متاح", "disponible(s)")}
        </span>
        <span className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-500 border border-amber-400/20 font-bold">
          {items.filter(d => !d.isAvailable && d.isActive).length} {t("مشغول", "occupé(s)")}
        </span>
        <span className="px-3 py-1 rounded-full bg-red-400/10 text-red-400 border border-red-400/20 font-bold">
          {items.filter(d => !d.isActive).length} {t("معطّل", "désactivé(s)")}
        </span>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#FFA500]/40 p-12 text-center bg-[#FFA500]/5">
          <div className="text-5xl mb-3">🚕</div>
          <p className="font-black text-[#1A4D1F]/60 text-base">{t("لا يوجد سائقو تاكسي مسجّلون بعد", "Aucun chauffeur taxi enregistré")}</p>
          <p className="text-xs text-[#1A4D1F]/30 mt-1 font-bold">
            {t("أضف سائقاً ليتلقى طلبات التاكسي من العملاء", "Ajoutez un chauffeur pour recevoir les demandes clients")}
          </p>
        </div>
      )}

      {/* Drivers grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(d => (
          <div key={d.id} className={cn(
            "rounded-2xl overflow-hidden border transition-all",
            d.isActive ? "border-[#1A4D1F]/10 bg-[#FFFDE7]" : "border-red-200 bg-red-50/50 opacity-70"
          )}>
            {/* Header strip */}
            <div className="flex items-center gap-3 px-4 py-3"
              style={{ background: d.isActive && d.isAvailable ? "rgba(26,77,31,0.06)" : d.isActive ? "rgba(255,165,0,0.08)" : "rgba(239,68,68,0.05)" }}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base shadow flex-shrink-0"
                style={{ background: d.isActive ? (d.isAvailable ? "#1A4D1F" : "#FFA500") : "#ef4444" }}>
                🚕
              </div>
              <div className="flex-1 min-w-0" dir="rtl">
                <p className="font-black text-[#1A4D1F] text-sm truncate">{d.name}</p>
                <p className="text-xs text-[#1A4D1F]/50 font-bold">{d.phone}</p>
              </div>
              {/* Status badge */}
              <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 border",
                !d.isActive ? "bg-red-100 text-red-500 border-red-200" :
                d.isAvailable ? "bg-emerald-400/15 text-emerald-500 border-emerald-400/25" :
                "bg-amber-400/15 text-amber-500 border-amber-400/25"
              )}>
                {!d.isActive ? t("● معطّل","● Désactivé") : d.isAvailable ? t("● متاح","● Disponible") : t("● مشغول","● Occupé")}
              </span>
            </div>

            {/* Car info */}
            {(d.carModel || d.carColor || d.carPlate) && (
              <div className="px-4 py-2 border-t border-[#1A4D1F]/5" dir="rtl">
                <p className="text-[11px] text-[#1A4D1F]/50 font-bold">
                  🚗 {[d.carModel, d.carColor, d.carPlate].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1A4D1F]/5 gap-2 flex-wrap">
              {/* Availability toggle */}
              <button
                onClick={() => toggleAvail(d)}
                disabled={!d.isActive}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-40",
                  d.isAvailable
                    ? "bg-emerald-400/10 text-emerald-500 border-emerald-400/25 hover:bg-amber-400/10 hover:text-amber-500 hover:border-amber-400/25"
                    : "bg-amber-400/10 text-amber-500 border-amber-400/25 hover:bg-emerald-400/10 hover:text-emerald-500 hover:border-emerald-400/25"
                )}
              >
                {d.isAvailable ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                {d.isAvailable ? t("متاح → مشغول", "Disponible") : t("مشغول → متاح", "Occupé")}
              </button>

              <div className="flex gap-2">
                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(d)}
                  className={cn("p-2 rounded-xl border transition-all text-xs",
                    d.isActive
                      ? "bg-[#1A4D1F]/8 text-[#1A4D1F]/50 border-[#1A4D1F]/10 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20"
                      : "bg-emerald-400/10 text-emerald-500 border-emerald-400/20 hover:bg-emerald-400/20"
                  )}
                  title={d.isActive ? t("تعطيل الحساب","Désactiver") : t("تفعيل الحساب","Activer")}
                >
                  <Power size={13} />
                </button>
                {/* Edit */}
                <button
                  onClick={() => {
                    setForm({ name: d.name, phone: d.phone, password: "", carModel: d.carModel || "", carColor: d.carColor || "", carPlate: d.carPlate || "", isAvailable: d.isAvailable, isActive: d.isActive });
                    setErr(""); setModal(d);
                  }}
                  className="p-2 rounded-xl bg-[#1A4D1F]/8 text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:bg-[#1A4D1F]/15 border border-[#1A4D1F]/10 transition-all"
                >
                  <Pencil size={13} />
                </button>
                {/* Delete */}
                <button
                  onClick={() => remove(d.id)}
                  className="p-2 rounded-xl bg-red-400/8 text-red-400/50 hover:text-red-400 hover:bg-red-400/15 border border-red-400/10 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "add" ? t("إضافة سائق تاكسي جديد", "Ajouter un chauffeur taxi") : t("تعديل معلومات السائق", "Modifier le chauffeur")}
      >
        {err && <div className="mb-3 p-3 rounded-xl bg-red-400/10 text-red-500 text-xs font-bold border border-red-400/20">{err}</div>}

        {/* Identity */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم الكامل", "Nom complet")}>
            <Input
              value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))}
              placeholder={t("محمد علي", "Mohamed Ali")}
            />
          </Field>
          <Field label={t("رقم الهاتف", "Téléphone")}>
            <Input
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))}
              placeholder="+21698..."
            />
          </Field>
        </div>

        {modal === "add" && (
          <Field label={t("كلمة المرور", "Mot de passe")}>
            <Input value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="..." />
          </Field>
        )}

        <div className="border-t border-[#1A4D1F]/10 my-1 pt-1">
          <p className="text-[11px] font-black text-[#1A4D1F]/40 mb-2">{t("معلومات السيارة (اختياري)", "Informations véhicule (optionnel)")}</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("موديل السيارة", "Modèle")}>
              <Input value={form.carModel} onChange={v => setForm(f => ({ ...f, carModel: v }))} placeholder="Clio" />
            </Field>
            <Field label={t("لون السيارة", "Couleur")}>
              <Input value={form.carColor} onChange={v => setForm(f => ({ ...f, carColor: v }))} placeholder={t("أبيض","Blanc")} />
            </Field>
            <Field label={t("رقم اللوحة", "Immatriculation")}>
              <Input value={form.carPlate} onChange={v => setForm(f => ({ ...f, carPlate: v }))} placeholder="123TN456" />
            </Field>
          </div>
        </div>

        <Field label={t("متاح لاستقبال الطلبات", "Disponible pour les courses")}>
          <Toggle checked={form.isAvailable} onChange={v => setForm(f => ({ ...f, isAvailable: v }))} />
        </Field>

        {modal !== "add" && (
          <Field label={t("الحساب مفعّل", "Compte actif")}>
            <Toggle checked={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} />
          </Field>
        )}

        <GoldBtn onClick={save} className="w-full justify-center mt-2" disabled={saving}>
          {saving ? t("جاري الحفظ...", "Enregistrement...") : modal === "add" ? t("إنشاء السائق", "Créer le chauffeur") : t("حفظ التعديلات", "Enregistrer")}
        </GoldBtn>

        {modal === "add" && (
          <div className="mt-3 p-3 rounded-xl bg-[#FFA500]/10 border border-[#FFA500]/20">
            <p className="text-[11px] font-bold text-[#FFA500]/80 text-center">
              {t("سيتمكن السائق من تسجيل الدخول برقم هاتفه وكلمة المرور من صفحة تسجيل الدخول",
                 "Le chauffeur pourra se connecter avec son téléphone et mot de passe")}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Promo Banners (Home Page Promo Slides)
// ──────────────────────────────────────────────────────────────────────────────
const EMPTY_BANNER_FORM = {
  titleAr: "", titleFr: "",
  subtitleAr: "", subtitleFr: "",
  imageUrl: "",
  bgFrom: "#1A4D1F", bgTo: "#0D3311", accent: "#FFA500",
  isActive: true, startsAt: "", endsAt: "",
};

function BannersSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<PromoBanner[]>([]);
  const [modal, setModal] = useState<null | "add" | PromoBanner>(null);
  const [form, setForm] = useState({ ...EMPTY_BANNER_FORM });

  const load = () => get<PromoBanner[]>("/admin/banners").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...form };
    if (modal === "add") await post("/admin/banners", payload);
    else await patch(`/admin/banners/${(modal as PromoBanner).id}`, payload);
    setModal(null); load();
  };

  const toggleActive = async (id: number, current: boolean) => {
    await patch(`/admin/banners/${id}`, { isActive: !current });
    setItems(prev => prev.map(b => b.id === id ? {...b, isActive: !current} : b));
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف هذه الشريحة؟","Supprimer cette diapositive ?"))) return;
    await del(`/admin/banners/${id}`); load();
  };

  const openEdit = (b: PromoBanner) => {
    setForm({
      titleAr: b.titleAr, titleFr: b.titleFr,
      subtitleAr: b.subtitleAr || "", subtitleFr: b.subtitleFr || "",
      imageUrl: b.imageUrl || "",
      bgFrom: b.bgFrom || "#1A4D1F", bgTo: b.bgTo || "#0D3311", accent: b.accent || "#FFA500",
      isActive: b.isActive, startsAt: "", endsAt: "",
    });
    setModal(b);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("عروض الصفحة الرئيسية","Diapositives d'accueil")}</h2>
          <p className="text-xs text-[#1A4D1F]/50 font-bold mt-0.5">{t("تظهر في أعلى الصفحة الرئيسية للعملاء","Apparaissent en haut de la page d'accueil")}</p>
        </div>
        <GoldBtn onClick={() => { setForm({ ...EMPTY_BANNER_FORM }); setModal("add"); }}>
          <Plus size={14}/>{t("إضافة شريحة","Ajouter diapositive")}
        </GoldBtn>
      </div>

      {/* Summary stats */}
      <div className="flex gap-3 text-sm flex-wrap">
        <span className="px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-bold">
          {items.filter(b => b.isActive).length} {t("مباشر","en direct")}
        </span>
        <span className="px-3 py-1 rounded-full bg-[#1A4D1F]/5 text-[#1A4D1F]/40 border border-[#1A4D1F]/10 font-bold">
          {items.filter(b => !b.isActive).length} {t("متوقف","masqué(s)")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#1A4D1F]/20 p-10 text-center">
            <Image size={32} className="mx-auto text-[#1A4D1F]/20 mb-2" />
            <p className="text-[#1A4D1F]/40 text-sm font-bold">{t("لا توجد شرائح بعد","Aucune diapositive pour l'instant")}</p>
            <p className="text-[#1A4D1F]/25 text-xs mt-1">{t("أضف شريحة لتظهر في الصفحة الرئيسية","Ajoutez une diapositive pour l'afficher sur la page d'accueil")}</p>
          </div>
        )}
        {items.map((b, idx) => (
          <div key={b.id} className="rounded-2xl overflow-hidden border border-[#1A4D1F]/10 bg-[#FFFDE7]">
            {/* Preview strip */}
            <div
              className="h-20 flex items-center px-5 gap-4 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${b.bgFrom || b.bgColor || "#1A4D1F"} 0%, ${b.bgTo || "#0D3311"} 100%)` }}
            >
              {/* Accent circle */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full opacity-20"
                style={{ background: b.accent || "#FFA500" }} />
              {/* Text */}
              <div dir="rtl" className="flex-1 min-w-0 relative z-10">
                {b.subtitleAr && (
                  <p className="text-[10px] font-black mb-0.5 truncate" style={{ color: b.accent || "#FFA500", textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>{b.subtitleAr}</p>
                )}
                <p className="font-black text-white text-sm truncate" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>{b.titleAr}</p>
                <p className="text-white/60 text-xs truncate">{b.titleFr}</p>
              </div>
              {/* Order badge */}
              <span className="text-white/50 text-[10px] font-black flex-shrink-0">#{idx + 1}</span>
              {/* Live/Hidden badge */}
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black flex-shrink-0",
                b.isActive ? "bg-white/20 text-white border border-white/30" : "bg-black/20 text-white/50 border border-white/10")}>
                {b.isActive ? t("● مباشر","● Live") : t("○ مخفي","○ Caché")}
              </span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between px-4 py-3 gap-3 border-t border-[#1A4D1F]/5">
              <div className="flex items-center gap-2">
                {/* Color swatches */}
                <div className="flex gap-1">
                  <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: b.bgFrom || b.bgColor || "#1A4D1F" }} title={t("لون البداية","Début")} />
                  <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: b.bgTo || "#0D3311" }} title={t("لون النهاية","Fin")} />
                  <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: b.accent || "#FFA500" }} title={t("لون التمييز","Accent")} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleActive(b.id, b.isActive)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    b.isActive
                      ? "bg-emerald-400/10 text-emerald-500 border-emerald-400/25 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/25"
                      : "bg-[#1A4D1F]/8 text-[#1A4D1F]/40 border-[#1A4D1F]/10 hover:bg-emerald-400/10 hover:text-emerald-500 hover:border-emerald-400/25"
                  )}
                >
                  <Power size={11} />
                  {b.isActive ? t("إيقاف","Désactiver") : t("تفعيل","Activer")}
                </button>
                {/* Edit */}
                <button onClick={() => openEdit(b)} className="p-2 rounded-xl bg-[#1A4D1F]/8 text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:bg-[#1A4D1F]/15 transition-all">
                  <Pencil size={13} />
                </button>
                {/* Delete */}
                <button onClick={() => remove(b.id)} className="p-2 rounded-xl bg-red-400/8 text-red-400/50 hover:text-red-400 hover:bg-red-400/15 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "add" ? t("إضافة شريحة جديدة","Ajouter diapositive") : t("تعديل الشريحة","Modifier diapositive")}
      >
        {/* Live Preview */}
        <div
          className="relative w-full overflow-hidden rounded-xl mb-4"
          style={{ aspectRatio: "16/7", minHeight: 100, background: `linear-gradient(135deg, ${form.bgFrom} 0%, ${form.bgTo} 100%)` }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.30) 0%, transparent 52%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.18) 0%, transparent 52%)" }} />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full opacity-20" style={{ background: form.accent }} />
          <div className="absolute inset-0 flex items-center justify-center px-8" dir="rtl">
            <div className="text-center w-full relative z-10">
              {form.subtitleAr && (
                <p className="text-[10px] font-black mb-1 leading-snug" style={{ color: form.accent, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
                  {form.subtitleAr}
                </p>
              )}
              <p className="text-base font-black text-white leading-snug" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {form.titleAr || t("العنوان هنا","Titre ici")}
              </p>
            </div>
          </div>
          <div className="absolute bottom-1.5 right-2 text-[9px] font-bold text-white/40">{t("معاينة مباشرة","Aperçu en direct")}</div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("العنوان (عربي)","Titre (arabe)")}>
            <Input value={form.titleAr} onChange={v => setForm(f => ({...f, titleAr: v}))} placeholder="عرض خاص!" />
          </Field>
          <Field label={t("العنوان (فرنسي)","Titre (français)")}>
            <Input value={form.titleFr} onChange={v => setForm(f => ({...f, titleFr: v}))} placeholder="Offre spéciale!" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("النص الثانوي (عربي)","Sous-titre (arabe)")}>
            <Input value={form.subtitleAr} onChange={v => setForm(f => ({...f, subtitleAr: v}))} placeholder="وصف قصير..." />
          </Field>
          <Field label={t("النص الثانوي (فرنسي)","Sous-titre (français)")}>
            <Input value={form.subtitleFr} onChange={v => setForm(f => ({...f, subtitleFr: v}))} placeholder="Description courte..." />
          </Field>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("لون البداية","Couleur début")}>
            <div className="flex items-center gap-2">
              <input type="color" value={form.bgFrom} onChange={e => setForm(f => ({...f, bgFrom: e.target.value}))} className="w-10 h-9 rounded-lg border border-[#1A4D1F]/10 cursor-pointer flex-shrink-0" />
              <Input value={form.bgFrom} onChange={v => setForm(f => ({...f, bgFrom: v}))} />
            </div>
          </Field>
          <Field label={t("لون النهاية","Couleur fin")}>
            <div className="flex items-center gap-2">
              <input type="color" value={form.bgTo} onChange={e => setForm(f => ({...f, bgTo: e.target.value}))} className="w-10 h-9 rounded-lg border border-[#1A4D1F]/10 cursor-pointer flex-shrink-0" />
              <Input value={form.bgTo} onChange={v => setForm(f => ({...f, bgTo: v}))} />
            </div>
          </Field>
          <Field label={t("لون التمييز","Couleur accent")}>
            <div className="flex items-center gap-2">
              <input type="color" value={form.accent} onChange={e => setForm(f => ({...f, accent: e.target.value}))} className="w-10 h-9 rounded-lg border border-[#1A4D1F]/10 cursor-pointer flex-shrink-0" />
              <Input value={form.accent} onChange={v => setForm(f => ({...f, accent: v}))} />
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("تاريخ البداية (اختياري)","Date début (optionnel)")}>
            <Input type="date" value={form.startsAt} onChange={v => setForm(f => ({...f, startsAt: v}))} />
          </Field>
          <Field label={t("تاريخ الانتهاء (اختياري)","Date fin (optionnel)")}>
            <Input type="date" value={form.endsAt} onChange={v => setForm(f => ({...f, endsAt: v}))} />
          </Field>
        </div>
        <Field label={t("مباشر على الصفحة الرئيسية","En direct sur la page d'accueil")}>
          <Toggle checked={form.isActive} onChange={v => setForm(f => ({...f, isActive: v}))} />
        </Field>
        <GoldBtn onClick={save} className="w-full justify-center mt-2">{t("حفظ الشريحة","Enregistrer la diapositive")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Hotel Bookings
// ──────────────────────────────────────────────────────────────────────────────
interface HotelBooking {
  id: number; hotelId: number; customerName: string; customerPhone: string;
  checkIn: string; checkOut: string; guests: number; notes?: string;
  status: string; createdAt: string; hotelName?: string; hotelNameAr?: string;
}

const HB_STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  pending:   { ar: "قيد الانتظار", fr: "En attente", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  confirmed: { ar: "مؤكد",         fr: "Confirmé",   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  cancelled: { ar: "ملغي",         fr: "Annulé",     color: "text-red-400 bg-red-400/10 border-red-400/30" },
};

function HotelBookingsSection({ t, lang }: { t: (a: string, f: string) => string; lang: string }) {
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    get<HotelBooking[]>("/hotel-bookings").then(d => { setBookings(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    await patch(`/hotel-bookings/${id}`, { status });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("حجوزات الفنادق", "Réservations Hôtel")}</h2>
          <p className="text-[#1A4D1F]/30 text-sm mt-0.5">{filtered.length} {t("حجز", "réservation(s)")}</p>
        </div>
        <GoldBtn onClick={load} variant="ghost"><RefreshCw size={14} /></GoldBtn>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {["all", "pending", "confirmed", "cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-black border transition-all",
              filter === f ? "bg-[#1A4D1F] text-black border-[#1A4D1F]" : "border-[#1A4D1F]/10 text-[#1A4D1F]/40 hover:text-[#1A4D1F]")}>
            {f === "all" ? t("الكل", "Tous") : (HB_STATUS[f]?.[lang === "ar" ? "ar" : "fr"] ?? f)}
            <span className="ml-1.5 opacity-60">{(f === "all" ? bookings : bookings.filter(b => b.status === f)).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-[#1A4D1F] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-14 text-center">
          <Hotel size={40} className="text-[#1A4D1F]/10 mx-auto mb-3" />
          <p className="text-[#1A4D1F]/20 font-bold">{t("لا توجد حجوزات", "Aucune réservation")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const s = HB_STATUS[b.status] ?? HB_STATUS.pending;
            return (
              <div key={b.id} className="glass-panel rounded-2xl p-5 border border-[#1A4D1F]/5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[#1A4D1F]/25">#{b.id.toString().padStart(4, "0")}</span>
                      <span className={cn("text-xs font-black px-2.5 py-0.5 rounded-full border", s.color)}>{lang === "ar" ? s.ar : s.fr}</span>
                    </div>
                    <p className="font-black text-[#1A4D1F] text-lg">{b.customerName}</p>
                    <p className="text-sm text-[#1A4D1F]/60 font-bold">{lang === "ar" ? (b.hotelNameAr || b.hotelName) : (b.hotelName || b.hotelNameAr)}</p>
                    <p className="text-xs text-[#1A4D1F]/30 mt-0.5">{t("هاتف", "Tél")}: {b.customerPhone}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-[#1A4D1F]/30">{t("وصول", "Arrivée")}</div>
                    <div className="text-sm font-black text-[#1A4D1F]">{fmt(b.checkIn)}</div>
                    <div className="text-xs text-[#1A4D1F]/30 mt-1">{t("مغادرة", "Départ")}</div>
                    <div className="text-sm font-black text-[#1A4D1F]">{fmt(b.checkOut)}</div>
                    <div className="text-xs text-[#1A4D1F]/25 mt-1">{b.guests} {t("ضيف", "pers.")}</div>
                  </div>
                </div>
                {b.notes && <p className="text-xs text-[#1A4D1F]/30 mb-4 p-2.5 rounded-xl border border-[#1A4D1F]/5 bg-[#1A4D1F]/2">{b.notes}</p>}
                {b.status === "pending" && (
                  <div className="flex gap-2">
                    <GoldBtn onClick={() => updateStatus(b.id, "confirmed")} className="flex-1 justify-center">
                      <Check size={14} />{t("تأكيد", "Confirmer")}
                    </GoldBtn>
                    <GoldBtn onClick={() => updateStatus(b.id, "cancelled")} variant="danger" className="flex-1 justify-center">
                      <X size={14} />{t("إلغاء", "Annuler")}
                    </GoldBtn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Users Management
// ──────────────────────────────────────────────────────────────────────────────
interface AppUser {
  id: number; username: string; name: string; email?: string | null;
  phone?: string | null; role: string; isActive: boolean; createdAt: string;
  linkedSupplierId?: number | null; linkedStaffId?: number | null;
}

interface AnyUser {
  id: number; username: string | null; name: string; phone?: string | null;
  role: string; isActive: boolean; createdAt: string;
  source: "users" | "providers" | "drivers";
}

const SOURCE_LABEL: Record<"users" | "providers" | "drivers", { ar: string; color: string }> = {
  users:     { ar: "نظام",     color: "#0D3311" },
  providers: { ar: "مزودون",  color: "#1A4D1F" },
  drivers:   { ar: "سائقون",  color: "#0D3311" },
};

const ROLE_OPTIONS: { value: string; ar: string; fr: string; color: string }[] = [
  { value: "super_admin",  ar: "مدير عام",       fr: "Super Admin",   color: "#0D3311" },
  { value: "manager",      ar: "مسؤول",          fr: "Manager",       color: "#1A4D1F" },
  { value: "provider",     ar: "مزود / تاجر",    fr: "Fournisseur",   color: "#1A4D1F" },
  { value: "driver",       ar: "موزع",           fr: "Livreur",       color: "#0D3311" },
  { value: "taxi_driver",  ar: "سائق تاكسي",     fr: "Chauffeur taxi",color: "#FFA500" },
  { value: "customer",     ar: "زبون",           fr: "Client",        color: "#006B3C" },
];

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_OPTIONS.find(o => o.value === role);
  if (!r) return <span className="text-xs text-[#1A4D1F]/30">{role}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border"
      style={{ color: r.color, borderColor: r.color + "44", background: r.color + "14" }}
    >
      {r.ar}
    </span>
  );
}

function UsersSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [viewMode, setViewMode] = useState<"system" | "all">("all");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [allUsers, setAllUsers] = useState<AnyUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState<null | "add" | AppUser>(null);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [supplierList, setSupplierList] = useState<{ id: number; nameAr: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; nameAr: string }[]>([]);
  const [form, setForm] = useState({
    username: "", name: "", email: "", phone: "",
    role: "customer", password: "", isActive: true,
    linkedSupplierId: null as number | null,
    linkedStaffId: null as number | null,
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (silent = false) => {
    if (!silent) setListLoading(true);
    else setRefreshing(true);
    setListError(null);
    Promise.all([
      get<AppUser[]>("/admin/users"),
      get<AnyUser[]>("/admin/all-users"),
    ])
      .then(([sysUsers, anyUsers]) => {
        setUsers(sysUsers);
        setAllUsers(anyUsers);
        setListLoading(false);
        setRefreshing(false);
        setLastRefresh(new Date());
      })
      .catch(err => {
        setListError(err?.message || t("تعذّر تحميل المستخدمين","Impossible de charger les utilisateurs"));
        setListLoading(false);
        setRefreshing(false);
      });
  };
  useEffect(() => {
    load();
    // Load suppliers and staff for the link dropdowns
    get<{ id: number; nameAr: string }[]>("/admin/suppliers").then(setSupplierList).catch(() => {});
    get<{ id: number; nameAr: string }[]>("/admin/delivery-staff").then(setStaffList).catch(() => {});
    // Auto-refresh every 30 seconds to catch new signups
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, []);

  const openAdd = () => {
    setForm({ username: "", name: "", email: "", phone: "", role: "customer", password: "", isActive: true, linkedSupplierId: null, linkedStaffId: null });
    setSaveError(null); setShowPw(false); setModal("add");
  };
  const openEdit = (u: AppUser) => {
    setForm({ username: u.username, name: u.name, email: u.email || "", phone: u.phone || "", role: u.role, password: "", isActive: u.isActive, linkedSupplierId: u.linkedSupplierId ?? null, linkedStaffId: u.linkedStaffId ?? null });
    setSaveError(null); setShowPw(false); setModal(u);
  };

  const save = async () => {
    setSaveError(null);
    if (!form.name.trim()) { setSaveError(t("الاسم مطلوب","Nom requis")); return; }
    if (modal === "add" && !form.password.trim()) { setSaveError(t("كلمة المرور مطلوبة","Mot de passe requis")); return; }
    if (modal === "add" && !form.username.trim()) { setSaveError(t("اسم المستخدم مطلوب","Identifiant requis")); return; }
    setLoading(true);
    try {
      const payload = {
        ...(modal === "add" ? { username: form.username.trim().toLowerCase() } : {}),
        name: form.name.trim(), email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined, role: form.role, isActive: form.isActive,
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
        linkedSupplierId: form.role === "provider" ? (form.linkedSupplierId ?? null) : null,
        linkedStaffId: form.role === "driver" ? (form.linkedStaffId ?? null) : null,
      };
      if (modal === "add") {
        await post("/admin/users", { ...payload, password: form.password.trim() });
      } else {
        await patch(`/admin/users/${(modal as AppUser).id}`, payload);
      }
      setModal(null); load();
    } catch (err: any) {
      setSaveError(err?.message === "Username already exists"
        ? t("اسم المستخدم موجود بالفعل","Identifiant déjà utilisé")
        : t("حدث خطأ","Une erreur est survenue"));
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (u: AppUser) => {
    await patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
  };

  const remove = async (u: AppUser) => {
    if (!confirm(t(`حذف "${u.name}"؟`, `Supprimer "${u.name}" ?`))) return;
    await del(`/admin/users/${u.id}`); load();
  };

  const displayList: AnyUser[] = viewMode === "all"
    ? allUsers.filter(u => {
        const q = search.toLowerCase();
        const matchSearch = !q || u.name.toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.phone || "").includes(q);
        const matchRole = roleFilter === "all" || u.role === roleFilter;
        return matchSearch && matchRole;
      })
    : users
        .filter(u => {
          const q = search.toLowerCase();
          const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.phone || "").includes(q);
          const matchRole = roleFilter === "all" || u.role === roleFilter;
          return matchSearch && matchRole;
        })
        .map(u => ({ ...u, source: "users" as const }));

  const countFor = (role: string) =>
    viewMode === "all"
      ? (role === "all" ? allUsers.length : allUsers.filter(u => u.role === role).length)
      : (role === "all" ? users.length : users.filter(u => u.role === role).length);

  const fmt = (d: string) => { try { return new Date(d).toLocaleDateString("ar-TN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

  if (listLoading) return (
    <div className="flex items-center justify-center py-20 text-[#1A4D1F]/40 gap-3">
      <div className="w-6 h-6 rounded-full border-2 border-[#1A4D1F]/30 border-t-[#1A4D1F] animate-spin" />
      <span className="text-sm font-bold">{t("جارٍ التحميل…","Chargement…")}</span>
    </div>
  );

  if (listError) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
        <span className="text-red-400 text-2xl">!</span>
      </div>
      <p className="text-red-500 font-bold text-sm text-center">{listError}</p>
      <button onClick={load}
        className="px-5 py-2 rounded-xl bg-[#1A4D1F] text-white text-sm font-bold"
      >{t("إعادة المحاولة","Réessayer")}</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("إدارة المستخدمين","Gestion des Utilisateurs")}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[#1A4D1F]/30 text-sm">{allUsers.length} {t("مستخدم","utilisateur(s)")}</p>
            {lastRefresh && (
              <p className="text-[#1A4D1F]/20 text-xs">
                · {t("آخر تحديث","Màj")} {lastRefresh.toLocaleTimeString("ar-TN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            title={t("تحديث القائمة","Actualiser")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1A4D1F]/20 text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:border-[#1A4D1F]/40 transition-all text-xs font-bold"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {t("تحديث","Actualiser")}
          </button>
          <GoldBtn onClick={openAdd}>
            <Plus size={14} />{t("إضافة مستخدم","Ajouter utilisateur")}
          </GoldBtn>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-2 p-1 rounded-2xl bg-[#1A4D1F]/5 border border-[#1A4D1F]/8 w-fit">
        {([["all", t("جميع المستخدمين","Tous les utilisateurs"), allUsers.length], ["system", t("مستخدمو النظام","Utilisateurs système"), users.length]] as [string, string, number][]).map(([mode, label, count]) => (
          <button key={mode} onClick={() => setViewMode(mode as "all" | "system")}
            className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all",
              viewMode === mode
                ? "bg-[#1A4D1F] text-white shadow-sm"
                : "text-[#1A4D1F]/50 hover:text-[#1A4D1F]")}>
            {label}
            <span className={cn("ms-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
              viewMode === mode ? "bg-white/20" : "bg-[#1A4D1F]/10")}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Source legend for "all" mode */}
      {viewMode === "all" && (
        <div className="flex gap-3 flex-wrap">
          {(Object.entries(SOURCE_LABEL) as [keyof typeof SOURCE_LABEL, { ar: string; color: string }][]).map(([src, meta]) => (
            <div key={src} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
              <span className="text-[11px] text-[#1A4D1F]/50 font-bold">{meta.ar}</span>
            </div>
          ))}
        </div>
      )}

      {/* Role summary chips */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "all", ar: "الكل", fr: "Tous" }, ...ROLE_OPTIONS].map(r => (
          <button key={r.value} onClick={() => setRoleFilter(r.value)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
              roleFilter === r.value
                ? "bg-[#1A4D1F] text-white border-transparent"
                : "border-[#1A4D1F]/20 text-[#1A4D1F]/50 hover:border-[#1A4D1F]/40")}>
            {r.ar}
            <span className="ms-1.5 opacity-60">{countFor(r.value)}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("بحث بالاسم أو المعرّف...","Rechercher par nom ou identifiant...")}
          className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-[#1A4D1F]/15 bg-[#FFA500]/20 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/25 outline-none focus:border-[#1A4D1F]/40"
          dir="rtl"
        />
      </div>

      {/* Users table */}
      <div className="rounded-2xl border border-[#1A4D1F]/10 overflow-hidden">
        {/* Table header — desktop */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-[#1A4D1F]/5 border-b border-[#1A4D1F]/8 text-xs font-black text-[#1A4D1F]/40 uppercase tracking-wider" dir="rtl">
          <span>{t("الاسم","Nom")}</span>
          <span>{t("الهاتف","Téléphone")}</span>
          <span>{t("الدور","Rôle")}</span>
          <span>{t("تاريخ الإنشاء","Créé le")}</span>
          <span>{t("إجراءات","Actions")}</span>
        </div>

        {displayList.length === 0 && (
          <div className="p-12 text-center">
            <UserCog size={32} className="mx-auto text-[#1A4D1F]/15 mb-3" />
            <p className="text-[#1A4D1F]/30 text-sm">{t("لا يوجد مستخدمون","Aucun utilisateur trouvé")}</p>
          </div>
        )}

        {displayList.map((u) => {
          const isSystem = u.source === "users";
          const srcMeta = SOURCE_LABEL[u.source];
          return (
          <div
            key={`${u.source}-${u.id}`}
            className={cn("flex md:grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 md:px-5 py-4 items-center border-b border-[#1A4D1F]/5 last:border-0 transition-colors hover:bg-[#1A4D1F]/2",
              !u.isActive && "opacity-50")}
            dir="rtl"
          >
            {/* Name + username / source */}
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#1A4D1F] text-sm truncate">{u.name}</p>
              {isSystem
                ? <p className="text-xs text-[#1A4D1F]/35 font-mono mt-0.5">@{u.username}</p>
                : <span className="inline-flex items-center gap-1 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: srcMeta.color }} />
                    <span className="text-[10px] font-bold" style={{ color: srcMeta.color }}>{srcMeta.ar}</span>
                  </span>
              }
            </div>

            {/* Phone */}
            <div className="hidden md:block min-w-0">
              {u.phone
                ? <p className="text-xs text-[#1A4D1F]/50 truncate">{u.phone}</p>
                : <p className="text-xs text-[#1A4D1F]/20">—</p>}
              {u.email
                ? <p className="text-[10px] text-[#1A4D1F]/35 truncate mt-0.5">{u.email}</p>
                : <p className="text-[10px] text-[#1A4D1F]/15 mt-0.5">{t("لا يوجد بريد","Pas d'email")}</p>}
            </div>

            {/* Role */}
            <div className="hidden md:block">
              <RoleBadge role={u.role} />
              {!u.isActive && (
                <span className="ms-2 text-[10px] text-red-400/70 border border-red-400/20 px-1.5 py-0.5 rounded-full bg-red-400/8">
                  {t("معطّل","Désactivé")}
                </span>
              )}
            </div>

            {/* Created at */}
            <div className="hidden md:block">
              <p className="text-xs text-[#1A4D1F]/30">{fmt(u.createdAt)}</p>
            </div>

            {/* Mobile badges */}
            <div className="flex md:hidden items-center gap-1.5 flex-wrap">
              <RoleBadge role={u.role} />
              {!u.isActive && <span className="text-[10px] text-red-400 border border-red-400/20 px-1.5 py-0.5 rounded-full">{t("معطّل","Désactivé")}</span>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isSystem ? (
                <>
                  <button
                    onClick={() => toggleActive(u as unknown as AppUser)}
                    title={u.isActive ? t("تعطيل","Désactiver") : t("تفعيل","Activer")}
                    className={cn("p-2 rounded-xl transition-all",
                      u.isActive
                        ? "text-emerald-500/60 bg-emerald-500/5 hover:bg-red-400/10 hover:text-red-400"
                        : "text-red-400/50 bg-red-400/5 hover:bg-emerald-500/10 hover:text-emerald-500")}
                  >
                    {u.isActive ? <UserCheck size={14} /> : <UserX size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(u as unknown as AppUser)}
                    className="p-2 rounded-xl text-[#1A4D1F]/40 bg-[#1A4D1F]/5 hover:text-[#1A4D1F] hover:bg-[#1A4D1F]/15 transition-all"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(u as unknown as AppUser)}
                    className="p-2 rounded-xl text-red-400/40 bg-red-400/5 hover:text-red-400 hover:bg-red-400/15 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-[#1A4D1F]/30 px-2 py-1 rounded-lg bg-[#1A4D1F]/5 border border-[#1A4D1F]/8 whitespace-nowrap">
                  {u.source === "providers" ? t("→ المزودون","→ Fournisseurs") : t("→ السائقون","→ Livreurs")}
                </span>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "add" ? t("إضافة مستخدم","Ajouter un utilisateur") : t("تعديل المستخدم","Modifier l'utilisateur")}
      >
        <div className="space-y-3" dir="rtl">
          {/* Username — only on add */}
          {modal === "add" && (
            <Field label={t("اسم المستخدم (معرّف الدخول)","Identifiant de connexion")}>
              <Input value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="ex: ali.ben" />
            </Field>
          )}
          {modal !== "add" && (
            <div className="px-3 py-2 rounded-xl bg-[#1A4D1F]/5 border border-[#1A4D1F]/10">
              <p className="text-[10px] text-[#1A4D1F]/40 uppercase font-black">{t("المعرّف","Identifiant")}</p>
              <p className="text-sm font-black text-[#1A4D1F] font-mono">@{form.username}</p>
            </div>
          )}

          {/* Full name */}
          <Field label={t("الاسم الكامل","Nom complet")}>
            <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t("الاسم الكامل","Nom complet")} />
          </Field>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("البريد الإلكتروني","Email")}>
              <Input value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="example@mail.com" />
            </Field>
            <Field label={t("رقم الهاتف","Téléphone")}>
              <Input value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+216..." />
            </Field>
          </div>

          {/* Role */}
          <Field label={t("الدور والصلاحيات","Rôle & Permissions")}>
            <div className="grid grid-cols-1 gap-2">
              {ROLE_OPTIONS.map(r => (
                <label key={r.value}
                  className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all",
                    form.role === r.value
                      ? "border-[#1A4D1F]/40 bg-[#1A4D1F]/6"
                      : "border-[#1A4D1F]/10 hover:border-[#1A4D1F]/20")}
                  onClick={() => setForm(f => ({ ...f, role: r.value }))}
                >
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: form.role === r.value ? r.color : "rgba(46,125,50,0.2)" }}>
                    {form.role === r.value && <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-black text-sm text-[#1A4D1F]">{r.ar}</span>
                    <span className="text-[#1A4D1F]/30 text-xs ms-2">· {r.fr}</span>
                  </div>
                  <Shield size={12} style={{ color: r.color }} className="flex-shrink-0" />
                </label>
              ))}
            </div>
          </Field>

          {/* Linked entity — shown only for provider and driver roles */}
          {form.role === "provider" && (
            <Field label={t("ربط بمزود / تاجر","Lier à un fournisseur")}>
              <select
                value={form.linkedSupplierId ?? ""}
                onChange={e => setForm(f => ({ ...f, linkedSupplierId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full bg-[#FFA500]/50 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 text-sm text-[#1A4D1F] focus:outline-none focus:border-[#1A4D1F]/50 transition-colors"
                dir="rtl"
              >
                <option value="">{t("— بدون ربط —","— Sans lien —")}</option>
                {supplierList.map(s => (
                  <option key={s.id} value={s.id}>{s.nameAr}</option>
                ))}
              </select>
            </Field>
          )}
          {form.role === "driver" && (
            <Field label={t("ربط بموزع / سائق","Lier à un livreur")}>
              <select
                value={form.linkedStaffId ?? ""}
                onChange={e => setForm(f => ({ ...f, linkedStaffId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full bg-[#FFA500]/50 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 text-sm text-[#1A4D1F] focus:outline-none focus:border-[#1A4D1F]/50 transition-colors"
                dir="rtl"
              >
                <option value="">{t("— بدون ربط —","— Sans lien —")}</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.nameAr}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Password */}
          <Field label={modal === "add" ? t("كلمة المرور","Mot de passe") : t("كلمة المرور الجديدة (اتركها فارغة للإبقاء عليها)","Nouveau mot de passe (vide = inchangé)")}>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={modal === "add" ? "••••••••" : t("اتركها فارغة","Laisser vide")}
                className="w-full bg-[#FFA500]/50 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 pe-10 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/20 focus:outline-none focus:border-[#1A4D1F]/50 transition-colors"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-[#1A4D1F]/30 hover:text-[#1A4D1F]">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          {/* Active toggle */}
          <Field label={t("حالة الحساب","État du compte")}>
            <Toggle checked={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))}
              label={form.isActive ? t("نشط","Actif") : t("معطّل","Désactivé")} />
          </Field>

          {/* Error */}
          {saveError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm font-bold">{saveError}</p>
            </div>
          )}

          <GoldBtn onClick={save} disabled={loading} className="w-full justify-center">
            {loading
              ? <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />{t("جاري الحفظ...","Enregistrement...")}</span>
              : t("حفظ التغييرات","Enregistrer")}
          </GoldBtn>
        </div>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ── Ticker Section ────────────────────────────────────────────────────────────
interface TickerRow { id: number; textAr: string; textFr: string | null; imageUrl: string | null; linkUrl: string | null; supplierId: number | null; bgColor: string; textColor: string; isActive: boolean; sortOrder: number; }
interface SupplierMinimal { id: number; nameAr: string; name: string; }

function TickerSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [ads, setAds]               = useState<TickerRow[]>([]);
  const [suppliers, setSuppliers]   = useState<SupplierMinimal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<TickerRow | null>(null);
  const [filterSup, setFilterSup]   = useState<string>("all");

  const [textAr, setTextAr]         = useState("");
  const [textFr, setTextFr]         = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [bgColor, setBgColor]       = useState("#1A4D1F");
  const [textColor, setTextColor]   = useState("#FFFFFF");
  const [sortOrder, setSortOrder]   = useState("0");
  const [imageUrl, setImageUrl]     = useState("");
  const [linkUrl, setLinkUrl]       = useState("");
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [a, s] = await Promise.all([get<TickerRow[]>("/admin/ticker"), get<SupplierMinimal[]>("/suppliers")]);
    setAds(a || []);
    setSuppliers(s || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setTextAr(""); setTextFr(""); setSupplierId(""); setBgColor("#1A4D1F"); setTextColor("#FFFFFF"); setSortOrder("0"); setImageUrl(""); setLinkUrl("");
    setShowForm(true);
  };
  const openEdit = (r: TickerRow) => {
    setEditing(r);
    setTextAr(r.textAr); setTextFr(r.textFr || ""); setSupplierId(r.supplierId ? String(r.supplierId) : "");
    setBgColor(r.bgColor); setTextColor(r.textColor); setSortOrder(String(r.sortOrder));
    setImageUrl(r.imageUrl || ""); setLinkUrl(r.linkUrl || "");
    setShowForm(true);
  };

  const uploadImage = async (rawFile: File) => {
    setUploading(true);
    const session = getSession();
    const file = await compressImage(rawFile).catch(() => rawFile);
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch("/api/admin/upload/ad", {
        method: "POST",
        headers: { "x-session-token": session?.token || "" },
        body: form,
      });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } catch { }
    setUploading(false);
  };

  const save = async () => {
    if (!textAr.trim()) return;
    setSaving(true);
    const body = { textAr, textFr: textFr || null, supplierId: supplierId || null, bgColor, textColor, sortOrder: parseInt(sortOrder) || 0, imageUrl: imageUrl || null, linkUrl: linkUrl || null };
    if (editing) await patch(`/admin/ticker/${editing.id}`, body);
    else await post("/admin/ticker", body);
    setSaving(false);
    setShowForm(false);
    await load();
  };
  const toggle = async (r: TickerRow) => {
    await patch(`/admin/ticker/${r.id}`, { isActive: !r.isActive });
    await load();
  };
  const remove = async (id: number) => {
    if (!confirm(t("هل أنت متأكد؟", "Confirmer la suppression?"))) return;
    await del(`/admin/ticker/${id}`);
    await load();
  };

  const filtered = filterSup === "all" ? ads : filterSup === "global" ? ads.filter(a => !a.supplierId) : ads.filter(a => String(a.supplierId) === filterSup);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-black text-[#1A4D1F]">{t("شريط الإشهار", "Ticker Publicitaire")}</h2>
          <p className="text-xs text-[#1A4D1F]/40">{t("نصوص تتحرك كشريط أسفل كل قسم أو في الرئيسية", "Texte défilant sur la page d'accueil ou profils")}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-black hover:opacity-90"
          style={{ background: "#1A4D1F" }}>
          <Plus size={15} /> {t("إضافة نص", "Ajouter")}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" dir="rtl">
        {[{ key: "all", label: t("الكل","Tout") }, { key: "global", label: t("الرئيسية","Accueil") }, ...suppliers.map(s => ({ key: String(s.id), label: s.nameAr }))].map(tab => (
          <button key={tab.key} onClick={() => setFilterSup(tab.key)}
            className={cn("px-3 py-1 rounded-full text-xs font-black whitespace-nowrap transition-all", filterSup === tab.key ? "text-white" : "text-[#1A4D1F]/50 border border-[#1A4D1F]/20")}
            style={filterSup === tab.key ? { background: "#1A4D1F" } : {}}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-[#1A4D1F]/30" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Radio size={36} className="mx-auto mb-3 text-[#1A4D1F]/20" />
          <p className="font-black text-[#1A4D1F]/30">{t("لا توجد نصوص", "Aucun ticker")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ad => {
            const supName = ad.supplierId ? (suppliers.find(s => s.id === ad.supplierId)?.nameAr || `#${ad.supplierId}`) : t("الرئيسية","Accueil");
            return (
              <motion.div key={ad.id} layout
                className="rounded-2xl border p-4"
                style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.12)" }}>
                {/* Preview banner */}
                <div className="rounded-xl overflow-hidden mb-3 relative" style={{ background: ad.bgColor, height: 72 }}>
                  {ad.imageUrl && <img src={ad.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  {ad.imageUrl && <div className="absolute inset-0" style={{ background: "linear-gradient(to left, rgba(0,0,0,0.5), transparent 60%)" }} />}
                  <div className="absolute inset-0 flex items-center px-3" dir="rtl">
                    <span className="text-xs font-bold truncate drop-shadow" style={{ color: ad.imageUrl ? "#fff" : ad.textColor }}>{ad.textAr}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between" dir="rtl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-[#1A4D1F]/50 px-2 py-0.5 rounded-full border border-[#1A4D1F]/10">{supName}</span>
                      <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", ad.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                        {ad.isActive ? t("نشط","Actif") : t("معطّل","Inactif")}
                      </span>
                      {ad.imageUrl && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{t("صورة","Image")}</span>}
                    </div>
                    {ad.textFr && <p className="text-xs text-[#1A4D1F]/30 mt-1 truncate">{ad.textFr}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ms-3">
                    <button onClick={() => toggle(ad)} className="p-2 rounded-lg hover:bg-[#1A4D1F]/10 transition-all">
                      {ad.isActive ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-[#1A4D1F]/30" />}
                    </button>
                    <button onClick={() => openEdit(ad)} className="p-2 rounded-lg hover:bg-[#1A4D1F]/10 transition-all">
                      <Pencil size={14} className="text-[#1A4D1F]/50" />
                    </button>
                    <button onClick={() => remove(ad.id)} className="p-2 rounded-lg hover:bg-red-50 transition-all">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: "#FFF3E0" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5" dir="rtl">
                <h3 className="font-black text-[#1A4D1F]">
                  {editing ? t("تعديل النص","Modifier") : t("نص إشهاري جديد","Nouveau ticker")}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#1A4D1F]/10">
                  <X size={16} className="text-[#1A4D1F]/60" />
                </button>
              </div>
              <div className="space-y-4 max-h-[65vh] overflow-y-auto pb-1" dir="rtl">
                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("صورة الإعلان (اختياري)","Image publicitaire (optionnel)")}</label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                  <div className="flex gap-2 items-start">
                    {imageUrl ? (
                      <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-[#1A4D1F]/20 flex-shrink-0">
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setImageUrl("")} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-xl border-2 border-dashed border-[#1A4D1F]/20 flex items-center justify-center flex-shrink-0 bg-white/50">
                        <ImageIcon size={18} className="text-[#1A4D1F]/20" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black border-2 border-dashed border-[#1A4D1F]/30 text-[#1A4D1F]/60 hover:bg-[#1A4D1F]/5 transition-all disabled:opacity-50">
                        {uploading ? <><RefreshCw size={12} className="animate-spin" /> {t("جاري الرفع...","Envoi...")}</> : <><Upload size={12} /> {t("رفع صورة","Télécharger")}</>}
                      </button>
                      <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder={t("أو الصق رابط الصورة","Ou coller l'URL de l'image")}
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs font-bold border border-[#1A4D1F]/20 outline-none focus:border-[#1A4D1F]" style={{ background: "#fff", color: "#1A4D1F" }} dir="ltr" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("النص بالعربية *","Texte arabe *")}</label>
                  <input value={textAr} onChange={e => setTextAr(e.target.value)} placeholder={t("مثال: عروض حصرية هذا الأسبوع!","Ex: Offres exclusives cette semaine!")}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border border-[#1A4D1F]/20 outline-none focus:border-[#1A4D1F]" style={{ background: "#fff", color: "#1A4D1F" }} />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("النص بالفرنسية","Texte français")}</label>
                  <input value={textFr} onChange={e => setTextFr(e.target.value)} placeholder="Ex: Offres exclusives cette semaine!"
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border border-[#1A4D1F]/20 outline-none focus:border-[#1A4D1F]" style={{ background: "#fff", color: "#1A4D1F" }} />
                </div>

                {/* Link URL */}
                <div>
                  <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("رابط النقر (اختياري)","URL du clic (optionnel)")}</label>
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..."
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border border-[#1A4D1F]/20 outline-none focus:border-[#1A4D1F]" style={{ background: "#fff", color: "#1A4D1F" }} dir="ltr" />
                </div>

                <div>
                  <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("خاص بمزود (اختياري)","Fournisseur (optionnel)")}</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border border-[#1A4D1F]/20 outline-none focus:border-[#1A4D1F]" style={{ background: "#fff", color: "#1A4D1F" }}>
                    <option value="">{t("الرئيسية (عام)","Page d'accueil (général)")}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
                  </select>
                </div>
                {!imageUrl && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("لون الخلفية","Couleur fond")}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-10 h-9 rounded-lg border border-[#1A4D1F]/20 cursor-pointer" />
                        <span className="text-xs font-bold text-[#1A4D1F]/40">{bgColor}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("لون النص","Couleur texte")}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-9 rounded-lg border border-[#1A4D1F]/20 cursor-pointer" />
                        <span className="text-xs font-bold text-[#1A4D1F]/40">{textColor}</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Live preview */}
                <div>
                  <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">{t("معاينة","Aperçu")}</label>
                  <div className="rounded-xl overflow-hidden relative" style={{ background: imageUrl ? "#000" : bgColor, height: 72 }}>
                    {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                    {imageUrl && <div className="absolute inset-0" style={{ background: "linear-gradient(to left, rgba(0,0,0,0.5), transparent 60%)" }} />}
                    <div className="absolute inset-0 flex items-center px-4" dir="rtl">
                      <span className="text-xs font-bold drop-shadow" style={{ color: imageUrl ? "#fff" : textColor }}>{textAr || t("نص الإشهار سيظهر هنا...","Le texte publicitaire s'affichera ici...")}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={save} disabled={saving || !textAr.trim()}
                  className="flex-1 py-2.5 rounded-xl text-white font-black text-sm disabled:opacity-50"
                  style={{ background: "#1A4D1F" }}>
                  {saving ? <RefreshCw size={14} className="animate-spin mx-auto" /> : t("حفظ","Enregistrer")}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl font-black text-sm text-[#1A4D1F]/60 border border-[#1A4D1F]/20">
                  {t("إلغاء","Annuler")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ── Partners Section ──────────────────────────────────────────────────────────
interface PartnerLogo { id: number; name: string; imageUrl: string; isActive: boolean; sortOrder: number; }

function PartnersSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems]   = useState<PartnerLogo[]>([]);
  const [modal, setModal]   = useState<null | "add" | PartnerLogo>(null);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const EMPTY = { name: "", imageUrl: "", isActive: true, sortOrder: 0 };
  const [form, setForm]     = useState(EMPTY);

  const load = () => get<PartnerLogo[]>("/admin/partners").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setErrMsg(""); setModal("add"); };
  const openEdit = (p: PartnerLogo) => {
    setForm({ name: p.name, imageUrl: p.imageUrl, isActive: p.isActive, sortOrder: p.sortOrder });
    setErrMsg(""); setModal(p);
  };

  const save = async () => {
    if (!form.imageUrl) { setErrMsg(t("صورة الشريك مطلوبة", "L'image est requise")); return; }
    if (!form.name.trim()) { setErrMsg(t("اسم الشريك مطلوب", "Le nom est requis")); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), imageUrl: form.imageUrl, isActive: form.isActive, sortOrder: Number(form.sortOrder) || 0 };
      if (modal === "add") await post("/admin/partners", payload);
      else await patch(`/admin/partners/${(modal as PartnerLogo).id}`, payload);
      setModal(null); load();
    } catch (e: any) {
      setErrMsg(e?.message || t("حدث خطأ", "Erreur"));
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل تريد الحذف؟", "Confirmer ?"))) return;
    await del(`/admin/partners/${id}`); load();
  };

  const toggleActive = async (p: PartnerLogo) => {
    await patch(`/admin/partners/${p.id}`, { isActive: !p.isActive }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("شركاء · Partenaires", "Partenaires")}</h2>
          <p className="text-xs text-[#1A4D1F]/40 mt-0.5">{items.length} {t("شريك", "partenaire(s)")}</p>
        </div>
        <GoldBtn onClick={openAdd}><Plus size={14} />{t("إضافة شريك", "Ajouter")}</GoldBtn>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🤝</p>
          <p className="text-[#1A4D1F]/30 font-bold">{t("لا يوجد شركاء بعد", "Aucun partenaire")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map(p => (
            <div key={p.id} className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
              {/* Circular logo preview */}
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#1A4D1F]/10 flex-shrink-0">
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <p className="font-bold text-[#1A4D1F] text-sm truncate w-full">{p.name}</p>
              <div className="flex gap-1.5">
                <button onClick={() => toggleActive(p)}
                  className={`p-1.5 rounded-lg border text-xs transition-all ${p.isActive ? "bg-emerald-400/10 text-emerald-500 border-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20"}`}
                  title={p.isActive ? t("تعطيل","Désactiver") : t("تفعيل","Activer")}>
                  <Power size={11} />
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors"><Pencil size={12} /></button>
                <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg bg-[#1A4D1F]/5 text-[#1A4D1F]/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => { setModal(null); setErrMsg(""); }}
        title={modal === "add" ? t("إضافة شريك","Ajouter un partenaire") : t("تعديل الشريك","Modifier le partenaire")}>

        {/* Circular logo picker */}
        <AdminImagePicker
          value={form.imageUrl}
          onChange={v => setForm(f => ({ ...f, imageUrl: v }))}
          label={t("شعار الشريك (دائري)","Logo du partenaire (circulaire)")}
          guideAr="شعار مربع 1:1 سيظهر دائرياً في الصفحة الرئيسية"
          guideFr="Logo carré 1:1 affiché en cercle sur la page d'accueil"
          aspect="1:1"
          accent="#1A4D1F"
          t={t}
        />

        <Field label={t("اسم الشريك","Nom du partenaire")}>
          <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t("مثال: بنك الأمل","Ex: Banque Espoir")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الترتيب","Ordre")}>
            <Input type="number" value={String(form.sortOrder)} onChange={v => setForm(f => ({ ...f, sortOrder: Number(v) || 0 }))} />
          </Field>
          <Field label={t("ظاهر","Visible")}>
            <Toggle checked={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} label={form.isActive ? t("نعم","Oui") : t("لا","Non")} />
          </Field>
        </div>

        {errMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 font-bold text-center">⚠️ {errMsg}</div>
        )}
        <GoldBtn onClick={save} disabled={saving} className="w-full justify-center">
          {saving ? <RefreshCw size={14} className="animate-spin mx-auto" /> : t("حفظ","Enregistrer")}
        </GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ── Ads Section ───────────────────────────────────────────────────────────────
interface AdRow { id: number; title: string; imageUrl?: string; linkUrl?: string; isActive: boolean; expiresAt?: string; clickCount: number; createdAt: string; }

function AdsSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [ads, setAds]           = useState<AdRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<AdRow | null>(null);
  const [form, setForm]         = useState({ title: "", imageUrl: "", linkUrl: "", expiresAt: "", isActive: true });
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    const token = getSession()?.token || getSessionToken() || "";
    if (!token) return;
    setUploading(true);
    try {
      const url = await uploadImageFileAdmin(file, token);
      setForm(f => ({ ...f, imageUrl: url }));
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const load = async () => {
    setLoading(true);
    try { setAds(await get<AdRow[]>("/admin/ads")); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setForm({ title: "", imageUrl: "", linkUrl: "", expiresAt: "", isActive: true }); setShowForm(true); };
  const openEdit = (a: AdRow) => {
    setEditing(a);
    setForm({
      title: a.title, imageUrl: a.imageUrl || "",
      linkUrl: a.linkUrl || "",
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : "",
      isActive: a.isActive,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, expiresAt: form.expiresAt || null };
      if (editing) await patch(`/admin/ads/${editing.id}`, payload);
      else await post("/admin/ads", payload);
      await load();
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const toggle = async (a: AdRow) => {
    await patch(`/admin/ads/${a.id}`, { isActive: !a.isActive });
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل أنت متأكد؟", "Confirmer la suppression?"))) return;
    await del(`/admin/ads/${id}`);
    await load();
  };

  const isExpired = (a: AdRow) => a.expiresAt && new Date(a.expiresAt) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-black text-[#1A4D1F]">{t("إدارة الإعلانات", "Gestion des publicités")}</h2>
          <p className="text-xs text-[#1A4D1F]/40">{t("إضافة وتعديل الإعلانات البانورامية", "Gérer les publicités panoramiques")}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-black transition-all hover:opacity-90"
          style={{ background: "#1A4D1F" }}>
          <Plus size={15} /> {t("إضافة إعلان", "Ajouter")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-[#1A4D1F]/30" /></div>
      ) : ads.length === 0 ? (
        <div className="text-center py-16">
          <Image size={36} className="mx-auto mb-3 text-[#1A4D1F]/20" />
          <p className="font-black text-[#1A4D1F]/30">{t("لا توجد إعلانات", "Aucune publicité")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map(a => (
            <motion.div key={a.id} layout
              className="rounded-2xl border p-4 flex items-start gap-4"
              style={{ background: "#FFFDE7", borderColor: isExpired(a) ? "#FCA5A5" : "rgba(46,125,50,0.12)" }}>
              {/* Image preview */}
              <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border border-[#1A4D1F]/10 bg-[#1A4D1F]/5 flex items-center justify-center">
                {a.imageUrl
                  ? <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display="none")} />
                  : <Image size={20} className="text-[#1A4D1F]/20" />
                }
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0" dir="rtl">
                <p className="font-black text-[#1A4D1F] text-sm truncate">{a.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {/* Status badge */}
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", a.isActive && !isExpired(a) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                    {isExpired(a) ? t("منتهية الصلاحية","Expirée") : a.isActive ? t("نشط","Actif") : t("معطّل","Inactif")}
                  </span>
                  {/* Expiry */}
                  {a.expiresAt && (
                    <span className="flex items-center gap-1 text-[10px] text-[#1A4D1F]/40 font-bold">
                      <Calendar size={10} />
                      {new Date(a.expiresAt).toLocaleDateString("ar-TN")}
                    </span>
                  )}
                  {/* Clicks */}
                  <span className="flex items-center gap-1 text-[10px] text-[#1A4D1F]/40 font-bold">
                    <MousePointer size={10} />
                    {a.clickCount} {t("نقرة","clics")}
                  </span>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle(a)} title={a.isActive ? t("تعطيل","Désactiver") : t("تفعيل","Activer")}
                  className="p-2 rounded-lg transition-all hover:bg-[#1A4D1F]/10">
                  {a.isActive ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-[#1A4D1F]/30" />}
                </button>
                <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-[#1A4D1F]/10 transition-all">
                  <Pencil size={14} className="text-[#1A4D1F]/50" />
                </button>
                <button onClick={() => remove(a.id)} className="p-2 rounded-lg hover:bg-red-50 transition-all">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: "#FFF3E0" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4" dir="rtl">
                <h3 className="font-black text-[#1A4D1F]">
                  {editing ? t("تعديل الإعلان","Modifier") : t("إعلان جديد","Nouvelle publicité")}
                </h3>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-[#1A4D1F]/40" /></button>
              </div>
              <div className="space-y-3" dir="rtl">
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("عنوان الإعلان","Titre *")}</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={t("مثال: عرض رمضان الحصري","Ex: Offre exclusive")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/60" />
                </div>
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("صورة الإعلان","Image de la publicité")}</label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
                  {form.imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-[#1A4D1F]/20" style={{ height: 110 }}>
                      <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                        className="absolute top-2 left-2 bg-white/90 rounded-full p-1 shadow hover:bg-red-50 transition-all">
                        <X size={12} className="text-red-500" />
                      </button>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow hover:bg-[#1A4D1F]/10 transition-all">
                        <Upload size={12} className="text-[#1A4D1F]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed border-[#1A4D1F]/20 bg-[#1A4D1F]/3 hover:bg-[#1A4D1F]/8 transition-all">
                      {uploading
                        ? <RefreshCw size={18} className="animate-spin text-[#1A4D1F]/40" />
                        : <><Upload size={18} className="text-[#1A4D1F]/40" /><span className="text-xs font-black text-[#1A4D1F]/40">{t("اضغط لرفع صورة","Cliquer pour importer")}</span></>
                      }
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("رابط الموقع عند النقر (اختياري)","Lien au clic (optionnel)")}</label>
                  <input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/60" />
                </div>
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("تاريخ الانتهاء","Date d'expiration")}</label>
                  <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/60" />
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-black text-[#1A4D1F]">{t("نشط","Actif")}</span>
                  <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                    {form.isActive
                      ? <ToggleRight size={26} className="text-green-600" />
                      : <ToggleLeft size={26} className="text-[#1A4D1F]/30" />
                    }
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={save} disabled={saving || !form.title}
                  className="flex-1 py-2.5 rounded-xl text-white font-black text-sm transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#1A4D1F" }}>
                  {saving ? <RefreshCw size={14} className="animate-spin mx-auto" /> : t("حفظ","Enregistrer")}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-black text-[#1A4D1F]/50 border border-[#1A4D1F]/15 hover:bg-[#1A4D1F]/5">
                  {t("إلغاء","Annuler")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Broadcast Section
// ──────────────────────────────────────────────────────────────────────────────
interface BroadcastRow { id: number; message: string; messageAr?: string; targetRole: string; createdBy: string; createdAt: string; }

const BROADCAST_ROLE_OPTIONS = [
  { value: "all",      labelAr: "الجميع",        labelFr: "Tous" },
  { value: "client",   labelAr: "العملاء",       labelFr: "Clients" },
  { value: "provider", labelAr: "المزودون",      labelFr: "Fournisseurs" },
  { value: "delivery", labelAr: "السائقون",      labelFr: "Livreurs" },
  { value: "admin",    labelAr: "المديرون",      labelFr: "Admins" },
];

function BroadcastSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [message, setMessage] = useState("");
  const [messageAr, setMessageAr] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setBroadcasts(await get<BroadcastRow[]>("/admin/broadcasts")); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await post("/admin/broadcast", {
        message: message.trim(),
        messageAr: messageAr.trim() || message.trim(),
        targetRole,
        createdBy: "admin",
      });
      setMessage("");
      setMessageAr("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await load();
    } catch {}
    setSending(false);
  };

  const remove = async (id: number) => {
    setDeleting(id);
    try { await del(`/admin/broadcast/${id}`); await load(); } catch {}
    setDeleting(null);
  };

  const roleLabel = (role: string) => {
    const opt = BROADCAST_ROLE_OPTIONS.find(r => r.value === role);
    return lang === "ar" ? (opt?.labelAr || role) : (opt?.labelFr || role);
  };

  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-2xl font-black text-[#1A4D1F] mb-1">{t("بث إشعار", "Diffuser une notification")}</h2>
        <p className="text-[#1A4D1F]/40 text-sm">{t("أرسل إشعاراً فورياً لجميع المستخدمين أو لفئة محددة", "Envoyez une notification instantanée à tous les utilisateurs ou à un rôle ciblé")}</p>
      </div>

      {/* Compose */}
      <div className="glass-panel rounded-2xl p-6 border border-[#1A4D1F]/10 space-y-4" style={{ background: "#FFFDE7" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#FFA500]/20 border border-[#FFA500]/30 flex items-center justify-center">
            <Radio size={17} className="text-[#FFA500]" />
          </div>
          <h3 className="font-black text-[#1A4D1F]">{t("رسالة جديدة", "Nouveau message")}</h3>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1A4D1F]/50 mb-1 uppercase tracking-wide">
            {t("الرسالة (عربي)", "Message (Arabe)")}
          </label>
          <textarea
            value={messageAr}
            onChange={e => setMessageAr(e.target.value)}
            placeholder={t("أدخل الرسالة بالعربية...", "Entrez le message en arabe...")}
            rows={3}
            dir="rtl"
            className="w-full bg-[#FFA500]/30 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/20 focus:outline-none focus:border-[#1A4D1F]/50 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1A4D1F]/50 mb-1 uppercase tracking-wide">
            {t("الرسالة (فرنسي)", "Message (Français)")} <span className="text-red-400">*</span>
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t("أدخل الرسالة بالفرنسية...", "Entrez le message en français...")}
            rows={3}
            dir="ltr"
            className="w-full bg-[#FFA500]/30 border border-[#1A4D1F]/10 rounded-xl px-3 py-2.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/20 focus:outline-none focus:border-[#1A4D1F]/50 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1A4D1F]/50 mb-1 uppercase tracking-wide">
            {t("المستهدفون", "Destinataires")}
          </label>
          <div className="flex flex-wrap gap-2">
            {BROADCAST_ROLE_OPTIONS.map(r => (
              <button
                key={r.value}
                onClick={() => setTargetRole(r.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black border transition-all",
                  targetRole === r.value
                    ? "bg-[#1A4D1F] text-white border-[#1A4D1F]"
                    : "bg-transparent text-[#1A4D1F] border-[#1A4D1F]/20 hover:border-[#1A4D1F]/50"
                )}
              >
                {lang === "ar" ? r.labelAr : r.labelFr}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={send}
          disabled={!message.trim() || sending}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all w-full justify-center",
            !message.trim() || sending
              ? "bg-[#1A4D1F]/20 text-[#1A4D1F]/30 cursor-not-allowed"
              : "bg-[#1A4D1F] text-white hover:bg-[#0D3311] shadow-[0_4px_12px_-2px_rgba(46,125,50,0.3)]"
          )}
        >
          {sending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {t("إرسال الإشعار", "Envoyer la notification")}
        </button>

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-400/10 border border-emerald-400/30"
          >
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">
              {t("تم إرسال الإشعار بنجاح!", "Notification envoyée avec succès!")}
            </span>
          </motion.div>
        )}
      </div>

      {/* History */}
      {broadcasts.length > 0 && (
        <div>
          <h3 className="font-black text-[#1A4D1F] mb-3 flex items-center gap-2">
            <Bell size={16} className="text-[#1A4D1F]/40" />
            {t("الإشعارات المرسلة", "Historique des notifications")}
          </h3>
          <div className="space-y-2">
            {broadcasts.map(b => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-panel rounded-xl p-4 border border-[#1A4D1F]/10 flex items-start gap-3"
                style={{ background: "#FFFDE7" }}
              >
                <div className="w-8 h-8 rounded-xl bg-[#FFA500]/20 border border-[#FFA500]/30 flex items-center justify-center flex-shrink-0">
                  <Radio size={13} className="text-[#FFA500]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#FFA500] bg-[#FFA500]/10 border border-[#FFA500]/20 px-2 py-0.5 rounded-full">
                      {roleLabel(b.targetRole)}
                    </span>
                    <span className="text-[10px] text-[#1A4D1F]/30">
                      {new Date(b.createdAt).toLocaleString(lang === "ar" ? "ar-TN" : "fr-TN")}
                    </span>
                  </div>
                  {b.messageAr && <p className="text-sm font-bold text-[#1A4D1F] leading-snug" dir="rtl">{b.messageAr}</p>}
                  <p className="text-xs text-[#1A4D1F]/50 leading-snug mt-0.5" dir="ltr">{b.message}</p>
                </div>
                <button
                  onClick={() => remove(b.id)}
                  disabled={deleting === b.id}
                  className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-400/5 transition-all flex-shrink-0"
                >
                  {deleting === b.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Live Delivery Map
// ──────────────────────────────────────────────────────────────────────────────
interface ActiveOrder {
  id: number; customerName: string; customerAddress: string;
  customerLat?: number | null; customerLng?: number | null;
  serviceProviderName: string; status: string; deliveryFee?: number;
  distanceKm?: number | null; etaMinutes?: number | null;
  createdAt: string;
}
interface MapSupplier { id: number; nameAr: string; name: string; address: string; latitude?: number | null; longitude?: number | null; isAvailable: boolean; }

function LiveMapSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [suppliers, setSuppliers] = useState<MapSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [MapComponents, setMapComponents] = useState<any>(null);

  const BEN_GUERDANE: [number, number] = [33.1365, 11.2206];
  const ACTIVE_STATUSES = ["pending", "accepted", "prepared", "driver_accepted", "in_delivery", "searching_for_driver"];

  useEffect(() => {
    const load = async () => {
      const [allOrders, allSuppliers] = await Promise.all([
        get<ActiveOrder[]>("/orders").catch(() => []),
        get<MapSupplier[]>("/admin/suppliers").catch(() => []),
      ]);
      setOrders(allOrders.filter(o => ACTIVE_STATUSES.includes(o.status)));
      setSuppliers(allSuppliers);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
      // @ts-ignore
      import("leaflet/dist/leaflet.css"),
    ]).then(([rl, L]) => {
      delete (L.default.Icon.Default.prototype as any)._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setMapComponents({ MapContainer: rl.MapContainer, TileLayer: rl.TileLayer, Marker: rl.Marker, Popup: rl.Popup, L: L.default });
    });
  }, []);

  const ordersWithCoords = orders.filter(o => o.customerLat && o.customerLng);
  const suppliersWithCoords = suppliers.filter(s => s.latitude && s.longitude);

  const createIcon = (color: string, L: any) => L.divIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7], className: "",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-[#1A4D1F]">{t("الخريطة المباشرة", "Carte en direct")}</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-black">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {t("مباشر", "En direct")}
          </div>
          <span className="text-xs text-[#1A4D1F]/40 font-bold">{t(`${orders.length} طلب نشط`, `${orders.length} commandes actives`)}</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel rounded-xl p-3 text-center">
          <p className="text-xl font-black text-[#FFA500]">{orders.length}</p>
          <p className="text-xs text-[#1A4D1F]/40">{t("طلبات نشطة","Commandes actives")}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 text-center">
          <p className="text-xl font-black text-[#1A4D1F]">{ordersWithCoords.length}</p>
          <p className="text-xs text-[#1A4D1F]/40">{t("موقع محدد","Avec GPS")}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 text-center">
          <p className="text-xl font-black text-emerald-500">{suppliersWithCoords.length}</p>
          <p className="text-xs text-[#1A4D1F]/40">{t("مزودون محددون","Prestataires GPS")}</p>
        </div>
      </div>

      {/* Map */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-[#1A4D1F]/20" style={{ height: "480px" }}>
        {loading || !MapComponents ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#1A4D1F] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
            <p className="text-sm text-[#1A4D1F]/40">{t("تحميل الخريطة...","Chargement de la carte...")}</p>
          </div>
        ) : (
          <div style={{ height: "100%", direction: "ltr" }}>
            <MapComponents.MapContainer center={BEN_GUERDANE} zoom={13} style={{ height: "100%", width: "100%" }}>
              <MapComponents.TileLayer
                attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Customer order markers (orange) */}
              {ordersWithCoords.map(order => (
                <MapComponents.Marker
                  key={`order-${order.id}`}
                  position={[order.customerLat!, order.customerLng!]}
                  icon={createIcon("#FFA500", MapComponents.L)}
                >
                  <MapComponents.Popup>
                    <div style={{ fontFamily: "sans-serif", minWidth: 180 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>#{order.id} · {order.customerName}</p>
                      <p style={{ fontSize: 12, color: "#666" }}>{order.serviceProviderName}</p>
                      <p style={{ fontSize: 12, color: "#666" }}>{order.customerAddress}</p>
                      {order.distanceKm && <p style={{ fontSize: 11, color: "#1A4D1F", marginTop: 4 }}>📍 {order.distanceKm.toFixed(1)} km</p>}
                      {order.etaMinutes && <p style={{ fontSize: 11, color: "#059669" }}>⏱ ~{order.etaMinutes} min</p>}
                      {order.deliveryFee && <p style={{ fontSize: 11, color: "#1A4D1F" }}>💰 {order.deliveryFee} TND</p>}
                    </div>
                  </MapComponents.Popup>
                </MapComponents.Marker>
              ))}
              {/* Provider markers (green) */}
              {suppliersWithCoords.map(s => (
                <MapComponents.Marker
                  key={`supplier-${s.id}`}
                  position={[s.latitude!, s.longitude!]}
                  icon={createIcon("#1A4D1F", MapComponents.L)}
                >
                  <MapComponents.Popup>
                    <div style={{ fontFamily: "sans-serif" }}>
                      <p style={{ fontWeight: 700 }}>{lang === "ar" ? s.nameAr : s.name}</p>
                      <p style={{ fontSize: 12, color: "#666" }}>{s.address}</p>
                      <p style={{ fontSize: 11, color: s.isAvailable ? "#059669" : "#EF4444", marginTop: 4 }}>
                        {s.isAvailable ? (lang === "ar" ? "متاح" : "Disponible") : (lang === "ar" ? "غير متاح" : "Indisponible")}
                      </p>
                    </div>
                  </MapComponents.Popup>
                </MapComponents.Marker>
              ))}
            </MapComponents.MapContainer>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-[#1A4D1F]/60 font-bold px-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FFA500] border border-white shadow-sm" />
          {t("عميل / طلب نشط","Client / Commande active")}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#1A4D1F] border border-white shadow-sm" />
          {t("مزود خدمات","Prestataire de services")}
        </div>
        <div className="ml-auto text-[10px] text-[#1A4D1F]/30">
          {t("يتحدث كل 15 ثانية","Mise à jour toutes les 15s")}
        </div>
      </div>

      {/* Orders without GPS */}
      {orders.length > ordersWithCoords.length && (
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-sm font-black text-[#1A4D1F] mb-3">{t("طلبات بدون موقع GPS","Commandes sans GPS")}</p>
          <div className="space-y-2">
            {orders.filter(o => !o.customerLat || !o.customerLng).map(order => (
              <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#FFA500]/5 border border-[#FFA500]/20">
                <span className="font-mono text-xs text-[#1A4D1F]/40">#{order.id.toString().padStart(4,"0")}</span>
                <span className="text-sm font-bold text-[#1A4D1F]">{order.customerName}</span>
                <span className="text-xs text-[#1A4D1F]/40 flex-1">{order.customerAddress}</span>
                <span className="text-xs text-[#FFA500] font-bold">{order.serviceProviderName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Delivery Config
// ──────────────────────────────────────────────────────────────────────────────
interface DeliveryConfig {
  id: number;
  baseFee: number;
  ratePerKm: number;
  minFee: number;
  maxFee: number | null;
  nightSurchargePercent: number;
  nightStartHour: number;
  nightEndHour: number;
  platformCommissionPercent: number;
  prepTimeMinutes: number;
  avgSpeedKmPerMin: number;
  expressEnabled: boolean;
  expressSurchargeTnd: number;
  fixedFeeEnabled: boolean;
  fixedFeeTnd: number;
  autoModeEnabled: boolean;
  updatedAt: string;
}

interface AutoCtx {
  label: string;
  labelAr: string;
  labelFr: string;
  emoji: string;
  surchargePercent: number;
}
interface AutoContextResp {
  context: AutoCtx;
  demo: { baseFee: number; kmFee: number; surchargeAmount: number; deliveryFee: number; etaMinutes: number };
}

function DeliveryConfigSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [cfg, setCfg] = useState<DeliveryConfig | null>(null);
  const [form, setForm] = useState<Partial<DeliveryConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewKm, setPreviewKm] = useState(3);
  const [previewNight, setPreviewNight] = useState(false);
  const [previewExpress, setPreviewExpress] = useState(false);
  const [autoCtxResp, setAutoCtxResp] = useState<AutoContextResp | null>(null);

  const load = async () => {
    try {
      const [data, autoData] = await Promise.all([
        get<DeliveryConfig>("/delivery-config"),
        get<AutoContextResp>("/auto-context"),
      ]);
      setCfg(data);
      setForm(data);
      setAutoCtxResp(autoData);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Refresh auto context every 30 seconds for live display
  useEffect(() => {
    const iv = setInterval(async () => {
      try { setAutoCtxResp(await get<AutoContextResp>("/auto-context")); } catch {}
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  const f = (field: keyof DeliveryConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.maxFee === null || payload.maxFee === undefined || String(payload.maxFee) === "") {
        payload.maxFee = null;
      }
      const updated = await patch<DeliveryConfig>("/admin/delivery-config", payload);
      setCfg(updated);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    finally { setSaving(false); }
  };

  // Live preview calculation
  const previewFee = (() => {
    const isFixed = !!form.fixedFeeEnabled;
    if (isFixed) {
      const total = Math.round(Number(form.fixedFeeTnd ?? 5) * 100) / 100;
      const commission = Math.round(total * (Number(form.platformCommissionPercent ?? 0) / 100) * 100) / 100;
      const eta = Number(form.prepTimeMinutes ?? 15) + Math.ceil(previewKm / Number(form.avgSpeedKmPerMin ?? 0.5));
      return { total, night: 0, commission, eta, isFixed: true };
    }
    const base = Number(form.baseFee ?? 2);
    const rate = Number(form.ratePerKm ?? 0.5);
    const min  = Number(form.minFee ?? 2);
    const max  = form.maxFee != null && String(form.maxFee) !== "" ? Number(form.maxFee) : null;
    const nightPct = Number(form.nightSurchargePercent ?? 0);
    const expressFee = form.expressEnabled && previewExpress ? Number(form.expressSurchargeTnd ?? 1) : 0;
    let sub = base + rate * previewKm + expressFee;
    const night = previewNight ? Math.round(sub * (nightPct / 100) * 100) / 100 : 0;
    sub += night;
    sub = Math.max(sub, min);
    if (max != null) sub = Math.min(sub, max);
    const commission = Math.round(sub * (Number(form.platformCommissionPercent ?? 0) / 100) * 100) / 100;
    const eta = Number(form.prepTimeMinutes ?? 15) + Math.ceil(previewKm / Number(form.avgSpeedKmPerMin ?? 0.5));
    return { total: Math.round(sub * 100) / 100, night, commission, eta, isFixed: false };
  })();

  const card = "bg-white rounded-2xl p-5 border border-[#1A4D1F]/8 shadow-sm";
  const label = "block text-xs font-black text-[#1A4D1F]/60 mb-1";
  const input = "w-full rounded-xl border border-[#1A4D1F]/15 px-3 py-2 text-sm font-bold text-[#1A4D1F] bg-[#FFF9F0] focus:outline-none focus:ring-2 focus:ring-[#FFA500]/40 text-right";

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-[#1A4D1F]/40 text-sm font-bold">
      {t("جارٍ التحميل...", "Chargement...")}
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#1A4D1F]">{t("سيناريو عمولة التوصيل","Commission de livraison")}</h2>
          <p className="text-xs text-[#1A4D1F]/40 mt-0.5">{t("حدّد قواعد احتساب رسوم التوصيل بمرونة كاملة","Définissez les règles de tarification de livraison")}</p>
        </div>
        {cfg?.updatedAt && (
          <span className="text-[10px] text-[#1A4D1F]/30 bg-[#1A4D1F]/5 px-3 py-1 rounded-full">
            {t("آخر تعديل:","Mis à jour :")} {new Date(cfg.updatedAt).toLocaleDateString("ar-TN")}
          </span>
        )}
      </div>

      {/* ── AUTO MODE BANNER ── */}
      <div className={`rounded-2xl border-2 p-5 transition-all ${form.autoModeEnabled
        ? "border-[#1A4D1F] bg-gradient-to-r from-[#1A4D1F]/5 to-[#1A4D1F]/10"
        : "border-[#1A4D1F]/10 bg-white"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${form.autoModeEnabled ? "bg-[#1A4D1F]" : "bg-[#1A4D1F]/8"}`}>
              <Zap size={18} className={form.autoModeEnabled ? "text-[#FFA500]" : "text-[#1A4D1F]/40"} />
            </div>
            <div>
              <p className="font-black text-[#1A4D1F] text-sm">{t("وضع تلقائي ذكي — بدون تدخل يدوي","Mode automatique intelligent — zéro intervention")}</p>
              <p className="text-xs text-[#1A4D1F]/50 mt-0.5">{t("يحسب الرسوم تلقائياً حسب الوقت والطلب — ذروة، ليل، عطلة","Calcule les frais automatiquement selon l'heure et la demande")}</p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
            <span className="text-xs font-bold text-[#1A4D1F]/60">{form.autoModeEnabled ? t("مفعّل","Actif") : t("معطّل","Inactif")}</span>
            <button type="button"
              onClick={() => setForm(p => ({ ...p, autoModeEnabled: !p.autoModeEnabled }))}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none ${form.autoModeEnabled ? "bg-[#1A4D1F]" : "bg-[#1A4D1F]/20"}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${form.autoModeEnabled ? "translate-x-8" : "translate-x-1"}`} />
            </button>
          </label>
        </div>

        {form.autoModeEnabled && (
          <div className="mt-4 pt-4 border-t border-[#1A4D1F]/10 space-y-4">
            {/* Current live context */}
            {autoCtxResp && (
              <div className="flex items-center gap-3 bg-[#1A4D1F]/8 rounded-xl px-4 py-3">
                <span className="text-2xl">{autoCtxResp.context.emoji}</span>
                <div className="flex-1">
                  <p className="text-xs font-black text-[#1A4D1F]">{t("الوضع الحالي الآن:","Contexte actuel :")} <span className="text-[#FFA500]">{autoCtxResp.context.labelAr}</span></p>
                  <p className="text-[10px] text-[#1A4D1F]/50 mt-0.5">{autoCtxResp.context.surchargePercent > 0
                    ? t(`زيادة تلقائية: +${autoCtxResp.context.surchargePercent}%`, `Majoration automatique : +${autoCtxResp.context.surchargePercent}%`)
                    : t("لا توجد زيادة — الوقت العادي","Aucune majoration — tarif standard")
                  }</p>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-[#1A4D1F]/40">{t("مثال (3 كم):","Ex. (3 km) :")}</p>
                  <p className="text-base font-black text-[#FFA500]">{autoCtxResp.demo.deliveryFee.toFixed(3)} <span className="text-xs">د.ت</span></p>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { emoji: "✅", ar: "وقت عادي",    fr: "Normal",     pct: 0,  time: t("باقي الأوقات","Reste du temps") },
                { emoji: "☀️", ar: "ذروة الظهر",  fr: "Pointe midi", pct: 15, time: "12:00 – 14:00" },
                { emoji: "🔥", ar: "ذروة المساء", fr: "Pointe soir", pct: 20, time: "18:00 – 21:00" },
                { emoji: "🌙", ar: "الليل",       fr: "Nuit",        pct: 30, time: "22:00 – 06:00" },
                { emoji: "🎉", ar: "عطلة نهاية الأسبوع", fr: "Week-end", pct: 10, time: t("جمعة + سبت","Ven + Sam") },
              ].map(row => (
                <div key={row.ar} className={`rounded-xl p-2.5 text-center border ${
                  autoCtxResp?.context.surchargePercent === row.pct && autoCtxResp?.context.emoji === row.emoji
                    ? "border-[#FFA500] bg-[#FFA500]/10" : "border-[#1A4D1F]/8 bg-[#1A4D1F]/3"}`}>
                  <div className="text-lg mb-1">{row.emoji}</div>
                  <div className="text-[10px] font-black text-[#1A4D1F]">{t(row.ar, row.fr)}</div>
                  <div className={`text-xs font-black mt-0.5 ${row.pct > 0 ? "text-[#FFA500]" : "text-[#1A4D1F]/40"}`}>
                    {row.pct > 0 ? `+${row.pct}%` : t("عادي","Standard")}
                  </div>
                  <div className="text-[9px] text-[#1A4D1F]/30 mt-0.5">{row.time}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#1A4D1F]/60 bg-[#1A4D1F]/5 rounded-xl px-4 py-2.5">
              <Zap size={13} className="flex-shrink-0 text-[#1A4D1F]" />
              <span>{t("رسوم أساسية: 2 د.ت + 0.5 د.ت/كم — تُطبَّق الزيادات تلقائياً دون أي تدخل","Base: 2 TND + 0.5 TND/km — majorations appliquées automatiquement")}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed Fee Banner ── */}
      <div className={`rounded-2xl border-2 p-5 transition-all ${
        form.autoModeEnabled ? "opacity-30 pointer-events-none select-none" : ""
      } ${form.fixedFeeEnabled
        ? "border-[#FFA500] bg-gradient-to-r from-[#FFF3E0] to-[#FFF9F0]"
        : "border-[#1A4D1F]/10 bg-white"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${form.fixedFeeEnabled ? "bg-[#FFA500]" : "bg-[#1A4D1F]/8"}`}>
              <DollarSign size={18} className={form.fixedFeeEnabled ? "text-white" : "text-[#1A4D1F]/40"} />
            </div>
            <div>
              <p className="font-black text-[#1A4D1F] text-sm">{t("تسعيرة ثابتة لجميع العملاء","Tarif fixe pour tous les clients")}</p>
              <p className="text-xs text-[#1A4D1F]/50 mt-0.5">{t("تطبيق سعر واحد موحد بغض النظر عن المسافة — يلغي الحسابات الديناميكية","Un seul tarif appliqué quelle que soit la distance — remplace le calcul dynamique")}</p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
            <span className="text-xs font-bold text-[#1A4D1F]/60">{form.fixedFeeEnabled ? t("مفعّل","Actif") : t("معطّل","Inactif")}</span>
            <button type="button"
              onClick={() => setForm(p => ({ ...p, fixedFeeEnabled: !p.fixedFeeEnabled }))}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none ${form.fixedFeeEnabled ? "bg-[#FFA500]" : "bg-[#1A4D1F]/20"}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${form.fixedFeeEnabled ? "translate-x-8" : "translate-x-1"}`} />
            </button>
          </label>
        </div>
        {form.fixedFeeEnabled && (
          <div className="mt-4 pt-4 border-t border-[#FFA500]/20">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1">
                  {t("قيمة التسعيرة الثابتة (دينار تونسي)","Montant du tarif fixe (TND)")}
                </label>
                <input
                  type="number" step="0.1" min="0"
                  value={form.fixedFeeTnd ?? ""}
                  onChange={f("fixedFeeTnd")}
                  className="w-full rounded-xl border-2 border-[#FFA500]/60 px-4 py-3 text-lg font-black text-[#1A4D1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFA500]/40 text-right"
                />
              </div>
              <div className="pb-1 text-sm text-[#1A4D1F]/50">
                {t("= نفس السعر لجميع الطلبات","= même prix pour toutes les commandes")}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5 border border-amber-200">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{t("هذا الوضع يعطّل تلقائياً: رسوم المسافة، رسوم الليل، رسوم السريع، الحد الأدنى والأقصى","Ce mode désactive automatiquement : frais km, supplément nuit, express, min/max")}</span>
            </div>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 transition-all ${form.fixedFeeEnabled ? "opacity-40 pointer-events-none select-none" : ""}`}>

        {/* ── Column 1: Base Fees ── */}
        <div className="space-y-4">
          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#FFA500]/15 flex items-center justify-center">
                <DollarSign size={15} className="text-[#FFA500]" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("الرسوم الأساسية","Frais de base")}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>{t("رسوم الانطلاق (دينار)","Frais de départ (TND)")}</label>
                <input type="number" step="0.1" min="0" value={form.baseFee ?? ""} onChange={f("baseFee")} className={input} />
                <p className="text-[10px] text-[#1A4D1F]/30 mt-1">{t("مبلغ ثابت لكل طلب بغض النظر عن المسافة","Montant fixe par commande quelle que soit la distance")}</p>
              </div>
              <div>
                <label className={label}>{t("رسوم الكيلومتر (دينار/كم)","Tarif au km (TND/km)")}</label>
                <input type="number" step="0.05" min="0" value={form.ratePerKm ?? ""} onChange={f("ratePerKm")} className={input} />
                <p className="text-[10px] text-[#1A4D1F]/30 mt-1">{t("يُضاف لكل كيلومتر إضافي","Ajouté par kilomètre parcouru")}</p>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#1A4D1F]/10 flex items-center justify-center">
                <Sliders size={15} className="text-[#1A4D1F]" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("الحدود (أدنى / أقصى)","Plafonds (min / max)")}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>{t("الحد الأدنى للتوصيل (دينار)","Frais minimum (TND)")}</label>
                <input type="number" step="0.1" min="0" value={form.minFee ?? ""} onChange={f("minFee")} className={input} />
              </div>
              <div>
                <label className={label}>{t("الحد الأقصى (دينار) — اتركه فارغاً للإلغاء","Plafond max (TND) — laisser vide pour désactiver")}</label>
                <input type="number" step="0.1" min="0"
                  value={form.maxFee == null ? "" : form.maxFee}
                  onChange={e => setForm(p => ({ ...p, maxFee: e.target.value === "" ? null : Number(e.target.value) }))}
                  className={input} placeholder={t("بلا سقف","Illimité")} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Surcharges & Commission ── */}
        <div className="space-y-4">
          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Moon size={15} className="text-indigo-500" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("رسوم الليل","Supplément nocturne")}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>{t("نسبة زيادة الليل (%)","Majoration nocturne (%)")}</label>
                <input type="number" step="1" min="0" max="100" value={form.nightSurchargePercent ?? ""} onChange={f("nightSurchargePercent")} className={input} />
                <p className="text-[10px] text-[#1A4D1F]/30 mt-1">{t("0% = بدون رسوم ليل","0% = aucun supplément nocturne")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>{t("بداية الليل (ساعة)","Début nuit (heure)")}</label>
                  <input type="number" step="1" min="0" max="23" value={form.nightStartHour ?? ""} onChange={f("nightStartHour")} className={input} />
                </div>
                <div>
                  <label className={label}>{t("نهاية الليل (ساعة)","Fin nuit (heure)")}</label>
                  <input type="number" step="1" min="0" max="23" value={form.nightEndHour ?? ""} onChange={f("nightEndHour")} className={input} />
                </div>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#1A4D1F]/10 flex items-center justify-center">
                <TrendingUp size={15} className="text-[#1A4D1F]" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("عمولة المنصة","Commission plateforme")}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>{t("نسبة عمولة سند (%)","Commission Sanad (%)")}</label>
                <input type="number" step="1" min="0" max="100" value={form.platformCommissionPercent ?? ""} onChange={f("platformCommissionPercent")} className={input} />
                <p className="text-[10px] text-[#1A4D1F]/30 mt-1">{t("مقتطعة من رسوم التوصيل لصالح المنصة (معلوماتي فقط)","Prélevée sur les frais — indicatif uniquement")}</p>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Zap size={15} className="text-amber-500" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("التوصيل السريع","Livraison express")}</span>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!form.expressEnabled} onChange={f("expressEnabled")}
                  className="w-4 h-4 rounded accent-[#FFA500]" />
                <span className="text-sm font-bold text-[#1A4D1F]">{t("تفعيل خيار التوصيل السريع","Activer la livraison express")}</span>
              </label>
              {form.expressEnabled && (
                <div>
                  <label className={label}>{t("رسوم إضافية للسريع (دينار)","Supplément express (TND)")}</label>
                  <input type="number" step="0.1" min="0" value={form.expressSurchargeTnd ?? ""} onChange={f("expressSurchargeTnd")} className={input} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Column 3: ETA + Live Preview ── */}
        <div className="space-y-4">
          <div className={card}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Clock size={15} className="text-emerald-600" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("وقت الوصول المتوقع","Délai estimé (ETA)")}</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>{t("وقت التحضير (دقيقة)","Temps de préparation (min)")}</label>
                <input type="number" step="1" min="0" value={form.prepTimeMinutes ?? ""} onChange={f("prepTimeMinutes")} className={input} />
              </div>
              <div>
                <label className={label}>{t("متوسط السرعة (كم/دقيقة)","Vitesse moyenne (km/min)")}</label>
                <input type="number" step="0.1" min="0.1" value={form.avgSpeedKmPerMin ?? ""} onChange={f("avgSpeedKmPerMin")} className={input} />
                <p className="text-[10px] text-[#1A4D1F]/30 mt-1">{t("0.5 = 30 كم/ساعة","0.5 = 30 km/h")}</p>
              </div>
            </div>
          </div>

          {/* Live Preview Calculator */}
          <div className="rounded-2xl border-2 border-[#FFA500]/40 bg-gradient-to-br from-[#FFF9F0] to-[#FFF3E0] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#FFA500]/20 flex items-center justify-center">
                <RefreshCw size={15} className="text-[#FFA500]" />
              </div>
              <span className="font-black text-[#1A4D1F] text-sm">{t("حاسبة مباشرة","Simulateur en direct")}</span>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className={label}>{t("المسافة التجريبية (كم)","Distance de test (km)")}</label>
                <input type="range" min="0.5" max="20" step="0.5" value={previewKm}
                  onChange={e => setPreviewKm(Number(e.target.value))}
                  className="w-full accent-[#FFA500]" />
                <div className="text-center text-sm font-black text-[#1A4D1F]">{previewKm} كم</div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1A4D1F]">
                  <input type="checkbox" checked={previewNight} onChange={e => setPreviewNight(e.target.checked)} className="accent-[#FFA500]" />
                  {t("ليل","Nuit")}
                </label>
                {form.expressEnabled && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1A4D1F]">
                    <input type="checkbox" checked={previewExpress} onChange={e => setPreviewExpress(e.target.checked)} className="accent-[#FFA500]" />
                    {t("سريع","Express")}
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {previewFee.isFixed ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#FFA500] font-bold">{t("تسعيرة ثابتة 🔒","Tarif fixe 🔒")}</span>
                  <span className="font-bold text-[#FFA500]">{Number(form.fixedFeeTnd ?? 5).toFixed(3)} د.ت</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#1A4D1F]/50">{t("رسوم الانطلاق","Frais de base")}</span>
                    <span className="font-bold text-[#1A4D1F]">{Number(form.baseFee ?? 2).toFixed(3)} د.ت</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#1A4D1F]/50">{t("رسوم المسافة","Frais km")}</span>
                    <span className="font-bold text-[#1A4D1F]">{(Number(form.ratePerKm ?? 0.5) * previewKm).toFixed(3)} د.ت</span>
                  </div>
                  {previewNight && previewFee.night > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-500">{t("رسوم الليل","Supplément nuit")}</span>
                      <span className="font-bold text-indigo-500">+{previewFee.night.toFixed(3)} د.ت</span>
                    </div>
                  )}
                  {previewExpress && form.expressEnabled && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-600">{t("رسوم سريع","Express")}</span>
                      <span className="font-bold text-amber-600">+{Number(form.expressSurchargeTnd ?? 1).toFixed(3)} د.ت</span>
                    </div>
                  )}
                </>
              )}
              <div className="border-t border-[#1A4D1F]/10 my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-[#1A4D1F]">{t("إجمالي رسوم التوصيل","Total livraison")}</span>
                <span className="text-lg font-black text-[#FFA500]">{previewFee.total.toFixed(3)} <span className="text-xs">د.ت</span></span>
              </div>
              {Number(form.platformCommissionPercent ?? 0) > 0 && (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-[#1A4D1F]/50">{t("عمولة سند","Commission Sanad")}</span>
                  <span className="font-bold text-[#1A4D1F]">{previewFee.commission.toFixed(3)} د.ت</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#1A4D1F]/50">{t("الوقت المتوقع","Délai estimé")}</span>
                <span className="font-bold text-[#1A4D1F]">~{previewFee.eta} {t("دقيقة","min")}</span>
              </div>
            </div>
          </div>

          {/* Save button */}
          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
            style={{ background: saved ? "#1A4D1F" : "#FFA500", color: saved ? "#FFF3E0" : "#1A4D1F" }}>
            {saving ? <RefreshCw size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Settings size={16} />}
            {saving ? t("جارٍ الحفظ...","Enregistrement...") : saved ? t("✓ تم الحفظ","✓ Enregistré") : t("حفظ الإعدادات","Enregistrer")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ── Car Rental Section ────────────────────────────────────────────────────────
function CarRentalSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [agencies, setAgencies]     = useState<any[]>([]);
  const [cars, setCars]             = useState<any[]>([]);
  const [bookings, setBookings]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeAgency, setActiveAgency] = useState<any | null>(null);
  const [showCarForm, setShowCarForm]   = useState(false);
  const [showAgencyForm, setShowAgencyForm] = useState(false);
  const [carForm, setCarForm] = useState({ make: "", model: "", year: "", color: "", plateNumber: "", pricePerDay: "", seats: "5", transmission: "manual", fuelType: "essence", imageUrl: "", descriptionAr: "", description: "" });
  const [agencyForm, setAgencyForm] = useState({ nameAr: "", name: "", phone: "", address: "", photoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"cars" | "bookings">("cars");

  const STATUS_LABELS: Record<string, { ar: string; fr: string; color: string; bg: string }> = {
    pending:   { ar: "في الانتظار", fr: "En attente", color: "#92400E", bg: "#FEF3C7" },
    confirmed: { ar: "مؤكد",        fr: "Confirmé",   color: "#1D4ED8", bg: "#DBEAFE" },
    rejected:  { ar: "مرفوض",       fr: "Refusé",     color: "#DC2626", bg: "#FEE2E2" },
    active:    { ar: "نشط",         fr: "Actif",      color: "#059669", bg: "#D1FAE5" },
    completed: { ar: "مكتمل",       fr: "Terminé",    color: "#6D28D9", bg: "#EDE9FE" },
    cancelled: { ar: "ملغي",        fr: "Annulé",     color: "#6B7280", bg: "#F3F4F6" },
  };

  useEffect(() => {
    Promise.all([
      get<any[]>("/suppliers").then(d => d.filter((s: any) => s.category === "car_rental")),
      fetch("/api/car-rental/cars/all", { headers: { "x-session-token": getSession()?.token || "" } }).then(r => r.json()),
      fetch("/api/car-rental/bookings", { headers: { "x-session-token": getSession()?.token || "" } }).then(r => r.json()),
    ]).then(([ag, ca, bo]) => {
      setAgencies(ag || []);
      setCars(Array.isArray(ca) ? ca : []);
      setBookings(Array.isArray(bo) ? bo : []);
    }).finally(() => setLoading(false));
  }, []);

  const addAgency = async () => {
    if (!agencyForm.nameAr || !agencyForm.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
        body: JSON.stringify({ ...agencyForm, category: "car_rental" }),
      });
      const agency = await res.json();
      setAgencies(prev => [...prev, agency]);
      setAgencyForm({ nameAr: "", name: "", phone: "", address: "", photoUrl: "" });
      setShowAgencyForm(false);
      setActiveAgency(agency);
    } finally { setSaving(false); }
  };

  const deleteAgency = async (id: number) => {
    if (!confirm(t("هل أنت متأكد من حذف هذه الوكالة؟","Supprimer cette agence ?"))) return;
    await fetch(`/api/admin/suppliers/${id}`, {
      method: "DELETE",
      headers: { "x-session-token": getSession()?.token || "" },
    });
    setAgencies(prev => prev.filter(a => a.id !== id));
    if (activeAgency?.id === id) setActiveAgency(null);
  };

  const addCar = async () => {
    if (!activeAgency || !carForm.make || !carForm.model || !carForm.pricePerDay) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/car-rental/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
        body: JSON.stringify({ ...carForm, agencyId: activeAgency.id, pricePerDay: Number(carForm.pricePerDay), seats: Number(carForm.seats) }),
      });
      const car = await res.json();
      setCars(prev => [...prev, car]);
      setCarForm({ make: "", model: "", year: "", color: "", plateNumber: "", pricePerDay: "", seats: "5", transmission: "manual", fuelType: "essence", imageUrl: "", descriptionAr: "", description: "" });
      setShowCarForm(false);
    } finally { setSaving(false); }
  };

  const deleteCar = async (carId: number) => {
    if (!confirm(t("حذف هذه السيارة؟","Supprimer cette voiture ?"))) return;
    await fetch(`/api/admin/car-rental/cars/${carId}`, {
      method: "DELETE",
      headers: { "x-session-token": getSession()?.token || "" },
    });
    setCars(prev => prev.filter(c => c.id !== carId));
  };

  const toggleCar = async (carId: number, isAvailable: boolean) => {
    await fetch(`/api/admin/car-rental/cars/${carId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
      body: JSON.stringify({ isAvailable: !isAvailable }),
    });
    setCars(prev => prev.map(c => c.id === carId ? { ...c, isAvailable: !isAvailable } : c));
  };

  if (loading) return <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-[#1A4D1F]/30" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-[#1A4D1F]">{t("كراء السيارات", "Location de voitures")}</h2>
          <p className="text-xs text-[#1A4D1F]/40">{t("إدارة الوكالات والسيارات والحجوزات", "Gestion des agences, voitures et réservations")}</p>
        </div>
        <button onClick={() => setShowAgencyForm(!showAgencyForm)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs text-white"
          style={{ background: "#1565C0" }}>
          <Plus size={13} />{t("وكالة جديدة", "Nouvelle agence")}
        </button>
      </div>

      {/* ── Add Agency Form ── */}
      {showAgencyForm && (
        <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: "#EFF6FF", border: "1.5px solid #1565C033" }}>
          <p className="text-sm font-black text-[#1565C0]">{t("إضافة وكالة كراء سيارات", "Ajouter une agence de location")}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "nameAr", label: t("الاسم بالعربية","Nom arabe"), placeholder: t("وكالة النجوم","Agence النجوم"), required: true },
              { key: "name",   label: t("الاسم بالفرنسية","Nom français"), placeholder: "Agence Étoiles", required: true },
              { key: "phone",  label: t("الهاتف","Téléphone"), placeholder: "216XXXXXXXX" },
              { key: "address",label: t("العنوان","Adresse"), placeholder: t("بن قردان","Ben Guerdane") },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-black mb-1 opacity-60 text-[#1565C0]">{f.label}{f.required && " *"}</label>
                <input value={(agencyForm as any)[f.key]} onChange={e => setAgencyForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                  style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1565C033" }} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-black mb-1 opacity-60 text-[#1565C0]">{t("رابط الشعار / الصورة","Logo / Photo URL")}</label>
            <input value={agencyForm.photoUrl} onChange={e => setAgencyForm(p => ({ ...p, photoUrl: e.target.value }))}
              placeholder="https://..." dir="ltr"
              className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
              style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1565C033" }} />
          </div>
          <div className="flex gap-2">
            <button onClick={addAgency} disabled={saving || !agencyForm.nameAr || !agencyForm.name}
              className="flex-1 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#1565C0" }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("إضافة الوكالة","Ajouter l'agence")}
            </button>
            <button onClick={() => setShowAgencyForm(false)}
              className="px-4 py-2.5 rounded-xl font-black text-sm"
              style={{ background: "#1565C022", color: "#1565C0" }}>
              {t("إلغاء","Annuler")}
            </button>
          </div>
        </div>
      )}

      {agencies.length === 0 && !showAgencyForm ? (
        <div className="text-center py-12 opacity-40">
          <Car size={32} className="mx-auto mb-3" style={{ color: "#1565C0" }} />
          <p className="text-sm font-bold text-[#1A4D1F]">{t("لا توجد وكالات بعد", "Aucune agence encore")}</p>
          <p className="text-xs mt-1 text-[#1A4D1F]/60">{t("اضغط 'وكالة جديدة' لإضافة أول وكالة", "Cliquez 'Nouvelle agence' pour commencer")}</p>
        </div>
      ) : agencies.length > 0 && (
        <div className="space-y-4">
          {/* Agency Picker */}
          <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
            {agencies.map(a => (
              <div key={a.id} className="flex items-center gap-1">
                <button onClick={() => setActiveAgency(a)}
                  className="flex-shrink-0 px-4 py-2 rounded-full font-black text-xs border transition-all"
                  style={activeAgency?.id === a.id
                    ? { background: "#1565C0", color: "#fff", borderColor: "#1565C0" }
                    : { background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F33" }}>
                  {a.nameAr || a.name}
                </button>
                <button onClick={() => deleteAgency(a.id)}
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "#FEE2E2" }}>
                  <Trash2 size={10} color="#DC2626" />
                </button>
              </div>
            ))}
          </div>

          {activeAgency && (
            <>
              {/* Tabs */}
              <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "#FFFDE7" }}>
                {(["cars", "bookings"] as const).map(tb => (
                  <button key={tb} onClick={() => setTab(tb)}
                    className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${tab === tb ? "bg-[#1A4D1F] text-white" : "text-[#1A4D1F]/40"}`}>
                    {tb === "cars" ? t("السيارات", "Voitures") : t("الحجوزات", "Réservations")}
                  </button>
                ))}
              </div>

              {/* Cars Tab */}
              {tab === "cars" && (
                <div className="space-y-3">
                  <button onClick={() => setShowCarForm(!showCarForm)}
                    className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 border-dashed border-[#1A4D1F]/30 text-[#1A4D1F]/60 hover:bg-[#1A4D1F]/5">
                    <Plus size={14} /> {t("إضافة سيارة", "Ajouter une voiture")}
                  </button>

                  {showCarForm && (
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFFDE7", border: "1px solid #1A4D1F22" }}>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "make", label: t("العلامة","Marque"), placeholder: "Toyota" },
                          { key: "model", label: t("الموديل","Modèle"), placeholder: "Yaris" },
                          { key: "year", label: t("السنة","Année"), placeholder: "2022" },
                          { key: "color", label: t("اللون","Couleur"), placeholder: t("أبيض","Blanc") },
                          { key: "plateNumber", label: t("رقم اللوحة المنجمية","Numéro d'immatriculation"), placeholder: "123 TU 4567" },
                          { key: "pricePerDay", label: t("السعر/يوم (د.ت)","Prix/jour (DT)"), placeholder: "50" },
                          { key: "seats", label: t("المقاعد","Places"), placeholder: "5" },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs font-black mb-1 opacity-50" style={{ color: "#1A4D1F" }}>{f.label}</label>
                            <input value={(carForm as any)[f.key]} onChange={e => setCarForm(p => ({ ...p, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                              style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-black mb-1 opacity-50" style={{ color: "#1A4D1F" }}>{t("ناقل الحركة","Boîte")}</label>
                          <select value={carForm.transmission} onChange={e => setCarForm(p => ({ ...p, transmission: e.target.value }))}
                            className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                            style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }}>
                            <option value="manual">{t("يدوي","Manuelle")}</option>
                            <option value="automatic">{t("أوتوماتيك","Automatique")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-black mb-1 opacity-50" style={{ color: "#1A4D1F" }}>{t("الوقود","Carburant")}</label>
                          <select value={carForm.fuelType} onChange={e => setCarForm(p => ({ ...p, fuelType: e.target.value }))}
                            className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                            style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }}>
                            <option value="essence">{t("بنزين","Essence")}</option>
                            <option value="diesel">{t("ديزل","Diesel")}</option>
                            <option value="electrique">{t("كهربائي","Électrique")}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-black mb-1 opacity-50" style={{ color: "#1A4D1F" }}>{t("رابط الصورة","URL image")}</label>
                        <input value={carForm.imageUrl} onChange={e => setCarForm(p => ({ ...p, imageUrl: e.target.value }))}
                          placeholder="https://..." dir="ltr"
                          className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                          style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                      </div>
                      <button onClick={addCar} disabled={saving || !carForm.make || !carForm.model || !carForm.pricePerDay}
                        className="w-full py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: "#1A4D1F" }}>
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        {t("حفظ السيارة","Enregistrer")}
                      </button>
                    </div>
                  )}

                  {/* Cars list */}
                  {cars.filter(c => c.agencyId === activeAgency.id).length === 0 && !showCarForm && (
                    <p className="text-center text-xs opacity-30 py-4 font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد سيارات لهذه الوكالة","Aucune voiture pour cette agence")}</p>
                  )}
                  {cars.filter(c => c.agencyId === activeAgency.id).map(car => (
                    <div key={car.id} className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                      <div className="flex items-center gap-3 p-3">
                        {car.imageUrl
                          ? <img src={car.imageUrl} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-16 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FFF3E0" }}><Car size={20} style={{ color: "#1A4D1F40" }} /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm truncate" style={{ color: "#1A4D1F" }}>{car.make} {car.model} {car.year && `(${car.year})`}</p>
                          <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{car.color && `${car.color} · `}{car.transmission === "automatic" ? t("أوتوماتيك","Auto") : t("يدوي","Manuel")} · {car.fuelType}</p>
                          {car.plateNumber && (
                            <p className="text-xs font-black mt-0.5 tracking-widest px-2 py-0.5 rounded inline-block" style={{ background: "#1A4D1F", color: "#FFA500", fontFamily: "monospace", letterSpacing: "0.15em" }}>
                              🇹🇳 {car.plateNumber}
                            </p>
                          )}
                          <p className="text-xs font-black mt-0.5" style={{ color: "#1565C0" }}>{car.pricePerDay} {t("د.ت/يوم","TND/j")} · {car.seats} {t("مقاعد","places")}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 items-end">
                          <button onClick={() => toggleCar(car.id, car.isAvailable)}
                            className="text-xs font-black px-2.5 py-1 rounded-full"
                            style={{ background: car.isAvailable ? "#D1FAE5" : "#FEE2E2", color: car.isAvailable ? "#059669" : "#DC2626" }}>
                            {car.isAvailable ? t("متاح","Dispo") : t("غير متاح","Indispo")}
                          </button>
                          <button onClick={() => deleteCar(car.id)}
                            className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                            style={{ background: "#FEE2E2", color: "#DC2626" }}>
                            <Trash2 size={10} />{t("حذف","Suppr.")}
                          </button>
                        </div>
                      </div>
                      {car.descriptionAr && (
                        <p className="px-3 pb-2 text-xs opacity-40" style={{ color: "#1A4D1F" }}>{car.descriptionAr}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Bookings Tab */}
              {tab === "bookings" && (
                <div className="space-y-3">
                  {bookings.filter(b => b.agencyId === activeAgency.id).length === 0 ? (
                    <div className="text-center py-8 opacity-30 text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد حجوزات","Aucune réservation")}</div>
                  ) : bookings.filter(b => b.agencyId === activeAgency.id).map(b => {
                    const s = STATUS_LABELS[b.status] || STATUS_LABELS.pending;
                    return (
                      <div key={b.id} className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-sm" style={{ color: "#1A4D1F" }}>#{b.id} · {b.customerName}</span>
                          <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>{s.ar}</span>
                        </div>
                        <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{b.startDate} → {b.endDate} · {b.totalPrice} {t("د.ت","TND")}</p>
                        <p className="text-xs opacity-40 mt-0.5" style={{ color: "#1A4D1F" }}>{b.customerPhone}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ── SOS Requests Section ──────────────────────────────────────────────────────
function SosSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [mainTab, setMainTab]   = useState<"requests" | "providers">("requests");
  const [providers, setProviders] = useState<any[]>([]);
  const [provLoading, setProvLoading] = useState(false);
  const [showProvForm, setShowProvForm] = useState(false);
  const [provForm, setProvForm] = useState({ nameAr: "", name: "", phone: "", category: "mechanic", address: "", latitude: "", longitude: "" });
  const [provSaving, setProvSaving] = useState(false);

  const CAT_LABELS: Record<string, { ar: string; fr: string; color: string }> = {
    mechanic:  { ar: "ميكانيكي", fr: "Mécanicien", color: "#F59E0B" },
    doctor:    { ar: "طبيب",     fr: "Médecin",    color: "#3B82F6" },
    emergency: { ar: "طوارئ",    fr: "Urgence",    color: "#EF4444" },
    other:     { ar: "أخرى",     fr: "Autre",      color: "#6B7280" },
  };

  const STATUS_LABELS: Record<string, { ar: string; fr: string; color: string; bg: string }> = {
    pending:  { ar: "في الانتظار",   fr: "En attente",      color: "#92400E", bg: "#FEF3C7" },
    offered:  { ar: "عرض سعر",       fr: "Offre de prix",   color: "#1D4ED8", bg: "#DBEAFE" },
    accepted: { ar: "مقبول",         fr: "Accepté",         color: "#059669", bg: "#D1FAE5" },
    done:     { ar: "مكتمل",         fr: "Terminé",         color: "#6D28D9", bg: "#EDE9FE" },
    cancelled:{ ar: "ملغي",          fr: "Annulé",          color: "#6B7280", bg: "#F3F4F6" },
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sos", { headers: { "x-session-token": getSession()?.token || "" } });
      const data = await res.json();
      if (Array.isArray(data)) setRequests(data);
    } finally { setLoading(false); }
  };

  const loadProviders = async () => {
    setProvLoading(true);
    try {
      const data = await get<any[]>("/suppliers");
      setProviders(data.filter((s: any) => s.category === "sos"));
    } finally { setProvLoading(false); }
  };

  const addProvider = async () => {
    if (!provForm.nameAr || !provForm.name || !provForm.category) return;
    setProvSaving(true);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
        body: JSON.stringify({
          ...provForm,
          latitude: provForm.latitude ? parseFloat(provForm.latitude) : null,
          longitude: provForm.longitude ? parseFloat(provForm.longitude) : null,
        }),
      });
      const prov = await res.json();
      setProviders(prev => [...prev, prov]);
      setProvForm({ nameAr: "", name: "", phone: "", category: "mechanic", address: "", latitude: "", longitude: "" });
      setShowProvForm(false);
    } finally { setProvSaving(false); }
  };

  const deleteProvider = async (id: number) => {
    if (!confirm(t("حذف هذا المزود؟","Supprimer ce prestataire ?"))) return;
    await fetch(`/api/admin/suppliers/${id}`, {
      method: "DELETE",
      headers: { "x-session-token": getSession()?.token || "" },
    });
    setProviders(prev => prev.filter(p => p.id !== id));
  };

  const toggleProvider = async (id: number, isAvailable: boolean) => {
    await fetch(`/api/admin/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
      body: JSON.stringify({ isAvailable: !isAvailable }),
    });
    setProviders(prev => prev.map(p => p.id === id ? { ...p, isAvailable: !isAvailable } : p));
  };

  useEffect(() => { load(); loadProviders(); }, []);

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/sos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
      body: JSON.stringify({ status }),
    });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-black" style={{ color: "#EF4444" }}>{t("خدمة SOS", "Service SOS")}</h2>
          <p className="text-xs opacity-40" style={{ color: "#1A4D1F" }}>{t("إدارة الطلبات والمزودين", "Gestion des demandes et prestataires")}</p>
        </div>
        <button onClick={() => { load(); loadProviders(); }} className="p-2 rounded-xl" style={{ background: "#EF444415" }}>
          <RefreshCw size={16} style={{ color: "#EF4444" }} />
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl mb-5" style={{ background: "#FFF0F0" }}>
        {([
          { id: "requests",  ar: "الطلبات",   fr: "Demandes",     badge: requests.filter(r => r.status === "pending").length },
          { id: "providers", ar: "المزودون",  fr: "Prestataires", badge: providers.length },
        ] as const).map(tb => (
          <button key={tb.id} onClick={() => setMainTab(tb.id)}
            className="flex-1 py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1.5"
            style={mainTab === tb.id
              ? { background: "#EF4444", color: "#fff" }
              : { color: "rgba(239,68,68,0.5)" }}>
            {t(tb.ar, tb.fr)}
            {tb.badge > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black"
                style={{ background: mainTab === tb.id ? "rgba(255,255,255,0.3)" : "#EF444422", color: mainTab === tb.id ? "#fff" : "#EF4444" }}>
                {tb.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {mainTab === "requests" && (
      <div>
      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {["all", "pending", "offered", "accepted", "done", "cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full font-black text-xs border transition-all"
            style={filter === f
              ? { background: "#EF4444", color: "#fff", borderColor: "#EF4444" }
              : { background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }}>
            {f === "all" ? t("الكل","Tous") : (STATUS_LABELS[f]?.ar || f)}
            {f !== "all" && ` (${requests.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin" style={{ color: "#EF4444" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 opacity-30">
          <AlertTriangle size={32} className="mx-auto mb-2" style={{ color: "#EF4444" }} />
          <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد طلبات","Aucune demande")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const cat = CAT_LABELS[req.category] || CAT_LABELS.other;
            const st  = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
            const d   = new Date(req.createdAt);
            return (
              <div key={req.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${cat.color}33` }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: cat.color + "15" }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} style={{ color: cat.color }} />
                    <span className="font-black text-xs" style={{ color: cat.color }}>{cat.ar} · #{req.id}</span>
                  </div>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.ar}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{req.customerName}</p>
                      <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{req.customerPhone}</p>
                    </div>
                    <p className="text-xs opacity-40" style={{ color: "#1A4D1F" }}>{d.toLocaleDateString("ar")} {d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p className="text-xs mt-1 opacity-50" style={{ color: "#1A4D1F" }}>📍 {req.lat?.toFixed(4)}, {req.lng?.toFixed(4)}</p>
                  {req.description && <p className="text-xs mt-2 p-2 rounded-lg opacity-70" style={{ color: "#1A4D1F", background: "#FFF3E0" }}>{req.description}</p>}
                  {req.assignedProviderName && (
                    <p className="text-xs mt-1 font-bold flex items-center gap-1" style={{ color: "#059669" }}>
                      🚛 {req.assignedProviderName}
                    </p>
                  )}
                  {req.offeredPrice != null && (
                    <p className="text-xs mt-1 font-black" style={{ color: "#1D4ED8" }}>
                      💰 {t("السعر المقترح:", "Prix proposé:")} {Number(req.offeredPrice).toFixed(3)} TND
                    </p>
                  )}
                  {req.status === "accepted" && (
                    <button onClick={() => updateStatus(req.id, "done")}
                      className="mt-3 w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                      style={{ background: "#EDE9FE", color: "#6D28D9" }}>
                      {t("تعليم كمكتمل ✓","Marquer terminé ✓")}
                    </button>
                  )}
                  {["pending", "offered"].includes(req.status) && (
                    <button onClick={() => updateStatus(req.id, "cancelled")}
                      className="mt-3 w-full py-2 rounded-xl font-black text-xs"
                      style={{ background: "#FEE2E2", color: "#DC2626" }}>
                      {t("إلغاء","Annuler")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}

      {/* ── PROVIDERS TAB ── */}
      {mainTab === "providers" && (
        <div className="space-y-3">
          <button onClick={() => setShowProvForm(!showProvForm)}
            className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 border-dashed text-white"
            style={{ borderColor: "#EF4444", background: showProvForm ? "#EF444422" : "#EF4444", color: showProvForm ? "#EF4444" : "#fff" }}>
            <Plus size={14} />{t("إضافة مزود SOS", "Ajouter un prestataire SOS")}
          </button>

          {showProvForm && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFF0F0", border: "1.5px solid #EF444433" }}>
              <p className="text-sm font-black" style={{ color: "#EF4444" }}>{t("مزود خدمة SOS جديد", "Nouveau prestataire SOS")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "nameAr", label: t("الاسم بالعربية","Nom arabe"), placeholder: t("الدكتور أحمد","Dr. Ahmed"), required: true },
                  { key: "name",   label: t("الاسم بالفرنسية","Nom français"), placeholder: "Dr. Ahmed", required: true },
                  { key: "phone",  label: t("الهاتف","Téléphone"), placeholder: "216XXXXXXXX" },
                  { key: "address",label: t("العنوان","Adresse"), placeholder: t("بن قردان","Ben Guerdane") },
                  { key: "latitude",  label: t("خط العرض","Latitude"),  placeholder: "33.1234" },
                  { key: "longitude", label: t("خط الطول","Longitude"), placeholder: "11.2345" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-black mb-1 opacity-60" style={{ color: "#EF4444" }}>{f.label}{f.required && " *"}</label>
                    <input value={(provForm as any)[f.key]} onChange={e => setProvForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} dir={["latitude","longitude"].includes(f.key) ? "ltr" : "rtl"}
                      className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                      style={{ background: "#fff", color: "#1A4D1F", borderColor: "#EF444433" }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-black mb-1 opacity-60" style={{ color: "#EF4444" }}>{t("التخصص","Spécialité")}</label>
                <select value={provForm.category} onChange={e => setProvForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                  style={{ background: "#fff", color: "#1A4D1F", borderColor: "#EF444433" }}>
                  <option value="mechanic">{t("ميكانيكي","Mécanicien")}</option>
                  <option value="doctor">{t("طبيب","Médecin")}</option>
                  <option value="emergency">{t("طوارئ عامة","Urgence générale")}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={addProvider} disabled={provSaving || !provForm.nameAr || !provForm.name}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "#EF4444" }}>
                  {provSaving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {t("إضافة المزود","Ajouter")}
                </button>
                <button onClick={() => setShowProvForm(false)}
                  className="px-4 py-2.5 rounded-xl font-black text-sm"
                  style={{ background: "#EF444422", color: "#EF4444" }}>
                  {t("إلغاء","Annuler")}
                </button>
              </div>
            </div>
          )}

          {provLoading ? (
            <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin" style={{ color: "#EF4444" }} /></div>
          ) : providers.length === 0 ? (
            <div className="text-center py-10 opacity-30">
              <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: "#EF4444" }} />
              <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا يوجد مزودون بعد","Aucun prestataire encore")}</p>
            </div>
          ) : (
            providers.map(p => {
              const catLabel = { mechanic: { ar: "ميكانيكي", color: "#F59E0B" }, doctor: { ar: "طبيب", color: "#3B82F6" }, emergency: { ar: "طوارئ", color: "#EF4444" } }[p.category as string] || { ar: p.category, color: "#6B7280" };
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#fff", border: "1px solid #EF444411" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: catLabel.color + "20" }}>
                    <AlertTriangle size={16} style={{ color: catLabel.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate" style={{ color: "#1A4D1F" }}>{p.nameAr}</p>
                    <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{catLabel.ar} {p.phone && `· ${p.phone}`}</p>
                    {p.latitude && <p className="text-xs opacity-30 font-mono" style={{ color: "#1A4D1F" }}>{p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <button onClick={() => toggleProvider(p.id, p.isAvailable)}
                      className="text-xs font-black px-2.5 py-1 rounded-full"
                      style={{ background: p.isAvailable ? "#D1FAE5" : "#FEE2E2", color: p.isAvailable ? "#059669" : "#DC2626" }}>
                      {p.isAvailable ? t("نشط","Actif") : t("غير نشط","Inactif")}
                    </button>
                    <button onClick={() => deleteProvider(p.id)}
                      className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ background: "#FEE2E2", color: "#DC2626" }}>
                      <Trash2 size={10} />{t("حذف","Suppr.")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ── Appearance Section (Logo Upload) ─────────────────────────────────────────
function AppearanceSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [logoUrl, setLogoUrl]       = useState("");
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loading, setLoading]       = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get<{ key: string; value: string | null }>("/app-settings/app_logo_url")
      .then(d => { if (d?.value) setLogoUrl(d.value); })
      .finally(() => setLoading(false));
  }, []);

  const uploadLogo = async (rawFile: File) => {
    setUploading(true);
    const session = getSession();
    const file = await compressImage(rawFile).catch(() => rawFile);
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch("/api/admin/upload/logo", {
        method: "POST",
        headers: { "x-session-token": session?.token || "" },
        body: form,
      });
      const data = await res.json();
      if (data.url) setLogoUrl(data.url);
    } catch { }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/app-settings/app_logo_url", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": getSession()?.token || "",
        },
        body: JSON.stringify({ value: logoUrl || null }),
      });
      // Update all logo instances globally
      const { setLogoUrl: setGlobalLogo } = await import("@/lib/useAppLogo");
      setGlobalLogo(logoUrl || "/sanad-logo.svg?v=5");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { }
    setSaving(false);
  };

  const reset = async () => {
    setLogoUrl("");
    await fetch("/api/admin/app-settings/app_logo_url", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": getSession()?.token || "",
      },
      body: JSON.stringify({ value: null }),
    });
    const { setLogoUrl: setGlobalLogo } = await import("@/lib/useAppLogo");
    setGlobalLogo("/sanad-logo.svg?v=5");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-[#1A4D1F]">{t("المظهر والشعار", "Apparence & Logo")}</h2>
          <p className="text-xs text-[#1A4D1F]/40">{t("شعار التطبيق يظهر في الرئيسية وصفحة التحميل", "Le logo s'affiche sur l'accueil et l'écran de chargement")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-[#1A4D1F]/30" /></div>
      ) : (
        <div className="space-y-6">
          {/* Current logo preview */}
          <div className="rounded-2xl border p-5" style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.12)" }}>
            <p className="text-xs font-black text-[#1A4D1F]/50 mb-3">{t("الشعار الحالي", "Logo actuel")}</p>
            <div className="flex items-center justify-center py-5 rounded-xl" style={{ background: "#FFA500" }}>
              <img
                src={logoUrl || "/sanad-logo.svg?v=5"}
                alt="شعار سند"
                style={{ height: 80, width: "auto", objectFit: "contain" }}
                onError={e => { (e.target as HTMLImageElement).src = "/sanad-logo.svg?v=5"; }}
              />
            </div>
          </div>

          {/* Upload zone */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.12)" }}>
            <p className="text-xs font-black text-[#1A4D1F]/50">{t("رفع شعار جديد", "Télécharger un nouveau logo")}</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />

            <div className="flex gap-3">
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm border-2 border-dashed border-[#1A4D1F]/30 text-[#1A4D1F]/70 hover:bg-[#1A4D1F]/5 transition-all disabled:opacity-50">
                {uploading
                  ? <><RefreshCw size={15} className="animate-spin" /> {t("جاري الرفع...","Envoi en cours...")}</>
                  : <><Upload size={15} /> {t("اختر ملف","Choisir un fichier")}</>}
              </button>
            </div>

            <div>
              <label className="block text-xs font-black text-[#1A4D1F]/50 mb-1.5">{t("أو الصق رابط الشعار","Ou coller l'URL du logo")}</label>
              <input
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                dir="ltr"
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border border-[#1A4D1F]/20 outline-none focus:border-[#1A4D1F]"
                style={{ background: "#fff", color: "#1A4D1F" }}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#1A4D1F" }}>
                {saving
                  ? <><RefreshCw size={14} className="animate-spin" /> {t("حفظ...","Enregistrement...")}</>
                  : saved
                  ? <><Check size={14} /> {t("✓ تم الحفظ","✓ Enregistré")}</>
                  : <>{t("حفظ الشعار","Enregistrer le logo")}</>}
              </button>
              {logoUrl && logoUrl !== "/sanad-logo.svg?v=5" && (
                <button onClick={reset}
                  className="px-4 py-2.5 rounded-xl font-black text-sm text-[#1A4D1F]/60 border border-[#1A4D1F]/20 hover:bg-[#1A4D1F]/5 transition-all">
                  {t("إعادة الافتراضي","Réinitialiser")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lawyer Requests Section ───────────────────────────────────────────────────
function LawyerRequestsSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const CASE_LABELS: Record<string, { ar: string; fr: string }> = {
    criminal:       { ar: "جنائي",  fr: "Pénal" },
    civil:          { ar: "مدني",   fr: "Civil" },
    administrative: { ar: "إداري",  fr: "Administratif" },
    commercial:     { ar: "تجاري",  fr: "Commercial" },
    family:         { ar: "أسري",   fr: "Familial" },
    real_estate:    { ar: "عقاري",  fr: "Immobilier" },
    other:          { ar: "أخرى",   fr: "Autre" },
  };

  const STATUS_LABELS: Record<string, { ar: string; fr: string; color: string; bg: string }> = {
    pending:  { ar: "في الانتظار", fr: "En attente", color: "#92400E", bg: "#FEF3C7" },
    accepted: { ar: "مقبول",       fr: "Accepté",    color: "#059669", bg: "#D1FAE5" },
    rejected: { ar: "مرفوض",       fr: "Refusé",     color: "#DC2626", bg: "#FEE2E2" },
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lawyer-requests", {
        headers: { "x-session-token": getSession()?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setRequests(data);
    } finally { setLoading(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/lawyer-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
        body: JSON.stringify({ status }),
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={18} style={{ color: "#1A4D1F" }} />
          <h2 className="text-base font-black" style={{ color: "#1A4D1F" }}>{t("طلبات المحامين", "Dossiers Avocats")}</h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-black" style={{ background: "#1A4D1F22", color: "#1A4D1F" }}>{requests.length}</span>
        </div>
        <button onClick={load} className="p-2 rounded-xl" style={{ background: "#1A4D1F22" }}>
          <RefreshCw size={14} style={{ color: "#1A4D1F" }} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#1A4D1F0A" }}>
        {["all", "pending", "accepted", "rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-lg text-xs font-black transition-all"
            style={{
              background: filter === f ? "#1A4D1F" : "transparent",
              color: filter === f ? "white" : "#1A4D1F88",
            }}>
            {f === "all" ? t("الكل", "Tout") : (STATUS_LABELS[f] ? (lang === "ar" ? STATUS_LABELS[f].ar : STATUS_LABELS[f].fr) : f)}
          </button>
        ))}
      </div>

      {/* Photo modal */}
      <AnimatePresence>
        {photoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.92)" }} onClick={() => setPhotoModal(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={photoModal}
              className="max-w-sm w-full rounded-2xl" alt="doc" />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-[#1A4D1F]/20 border-t-[#1A4D1F] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2 opacity-30">
          <Scale size={32} style={{ color: "#1A4D1F" }} />
          <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد طلبات", "Aucune demande")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const ct = CASE_LABELS[req.caseType] || CASE_LABELS.other;
            const st = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
            const reqPhotos = (() => { try { return JSON.parse(req.photos || "[]"); } catch { return []; } })();
            return (
              <div key={req.id} className="rounded-2xl overflow-hidden border" style={{ background: "white", borderColor: "#1A4D1F11" }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1A4D1F08" }}>
                  <div className="flex items-center gap-2">
                    <Scale size={11} style={{ color: "#1A4D1F" }} />
                    <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>
                      #{req.id.toString().padStart(4, "0")} · {lang === "ar" ? ct.ar : ct.fr}
                    </span>
                    <span className="text-xs opacity-40" style={{ color: "#1A4D1F" }}>→ {req.lawyerName}</span>
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
                    <FileText size={10} />{t("المحكمة:", "Tribunal:")} {req.court}
                  </p>
                  {req.notes && (
                    <p className="text-xs p-2.5 rounded-xl opacity-60" style={{ background: "#FFF3E0", color: "#1A4D1F" }}>{req.notes}</p>
                  )}
                  {reqPhotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {reqPhotos.map((url: string, i: number) => (
                        <button key={i} onClick={() => setPhotoModal(url)}
                          className="w-14 h-14 rounded-xl overflow-hidden border border-[#1A4D1F]/10">
                          <img src={url} alt="doc" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  {req.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => updateStatus(req.id, "accepted")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                        style={{ background: "#1A4D1F", color: "white" }}>
                        <Check size={12} /> {t("قبول", "Accepter")}
                      </button>
                      <button onClick={() => updateStatus(req.id, "rejected")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                        style={{ background: "#FEE2E2", color: "#DC2626" }}>
                        <X size={12} /> {t("رفض", "Refuser")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
type Section = "overview" | "orders" | "suppliers" | "articles" | "staff" | "taxi_drivers" | "delegations" | "banners" | "hotelBookings" | "users" | "broadcast" | "ads" | "live_map" | "delivery_config" | "ticker" | "appearance" | "car_rental" | "sos_requests" | "lawyer_requests" | "partners";

type NavItem = { id: Section; icon: React.FC<any>; ar: string; fr: string; superOnly?: boolean };
type NavGroup = { id: string; icon: React.FC<any>; ar: string; fr: string; color: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview_group",
    icon: LayoutDashboard,
    ar: "نظرة عامة",
    fr: "Vue générale",
    color: "#1A4D1F",
    items: [
      { id: "overview",  icon: LayoutDashboard, ar: "لوحة المعلومات", fr: "Tableau de bord" },
      { id: "orders",    icon: Package,          ar: "الطلبات",        fr: "Commandes" },
      { id: "live_map",  icon: Map,              ar: "الخريطة المباشرة", fr: "Carte live" },
      { id: "users",     icon: UserCog,          ar: "المستخدمون",     fr: "Utilisateurs",  superOnly: true },
    ],
  },
  {
    id: "products_group",
    icon: ShoppingBag,
    ar: "تزويد المنتوجات",
    fr: "Produits & Livraison",
    color: "#B45309",
    items: [
      { id: "suppliers",      icon: Users,     ar: "المزودون",        fr: "Fournisseurs",  superOnly: true },
      { id: "articles",       icon: ShoppingBag, ar: "المنتجات",      fr: "Articles",      superOnly: true },
      { id: "staff",          icon: Truck,     ar: "السائقون",        fr: "Livreurs",      superOnly: true },
      { id: "delegations",    icon: Map,       ar: "المعتمديات",      fr: "Délégations",   superOnly: true },
      { id: "delivery_config",icon: Settings,  ar: "عمولة التوصيل",  fr: "Commission",    superOnly: true },
    ],
  },
  {
    id: "services_group",
    icon: Stethoscope,
    ar: "تزويد الخدمات",
    fr: "Services",
    color: "#1565C0",
    items: [
      { id: "hotelBookings", icon: Hotel,         ar: "حجوزات الفنادق",  fr: "Réservations Hôtel" },
      { id: "taxi_drivers",  icon: Car,            ar: "سائقو التاكسي",  fr: "Chauffeurs Taxi",  superOnly: true },
      { id: "car_rental",    icon: Car,            ar: "كراء السيارات",   fr: "Location auto",    superOnly: true },
      { id: "sos_requests",     icon: AlertTriangle,  ar: "طلبات SOS",       fr: "Demandes SOS",     superOnly: true },
      { id: "lawyer_requests",  icon: Scale,          ar: "طلبات المحامين",  fr: "Dossiers Avocats", superOnly: true },
    ],
  },
  {
    id: "marketing_group",
    icon: Megaphone,
    ar: "الإشهار والإشعار",
    fr: "Pub & Notifications",
    color: "#7C3AED",
    items: [
      { id: "banners",    icon: Megaphone, ar: "الإعلانات",       fr: "Publicités" },
      { id: "ticker",     icon: Radio,     ar: "شريط الإشهار",   fr: "Ticker Pub" },
      { id: "partners",   icon: Users,     ar: "شركاء",           fr: "Partenaires" },
      { id: "ads",        icon: Image,     ar: "إعلانات متقدمة", fr: "Ads avancées" },
      { id: "broadcast",  icon: Radio,     ar: "بث إشعار",       fr: "Diffusion" },
      { id: "appearance", icon: Image,     ar: "المظهر والشعار", fr: "Apparence",  superOnly: true },
    ],
  },
];

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Abc1234";
const ADMIN_KEY = "dc_admin_auth";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTimeout(() => {
      if (username !== ADMIN_USERNAME) {
        setError("اسم المستخدم غير صحيح · Identifiant incorrect");
      } else if (pw !== ADMIN_PASSWORD) {
        setError("كلمة المرور غير صحيحة · Mot de passe incorrect");
      } else {
        localStorage.setItem(ADMIN_KEY, "1");
        onLogin();
      }
      setLoading(false);
    }, 450);
  };

  const canSubmit = username.trim().length > 0 && pw.length > 0 && !loading;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFA500" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="w-18 h-18 rounded-2xl bg-[#1A4D1F]/15 border-2 border-[#1A4D1F]/40 flex items-center justify-center mx-auto mb-5 w-[72px] h-[72px]"
            style={{ boxShadow: "0 0 40px -10px rgba(46,125,50,0.55)" }}>
            <LayoutDashboard size={28} className="text-[#1A4D1F]" />
          </div>
          <h1 className="text-3xl font-black text-[#1A4D1F] mb-1">لوحة التحكم</h1>
          <p className="text-[#1A4D1F]/30 text-sm">Admin Panel · سند</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-3" dir="rtl">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#1A4D1F]/40 uppercase tracking-widest">
              اسم المستخدم · Identifiant
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(null); }}
              placeholder="admin"
              autoComplete="username"
              autoFocus
              className="w-full bg-[#FFFDE7] border rounded-xl px-4 py-3.5 text-[#1A4D1F] font-bold outline-none transition-all placeholder:text-[#1A4D1F]/30"
              style={{ borderColor: error && username && username !== ADMIN_USERNAME ? "#ef4444" : username ? "#1A4D1F" : "rgba(46,125,50,0.25)" }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#1A4D1F]/40 uppercase tracking-widest">
              كلمة المرور · Mot de passe
            </label>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(null); }}
              placeholder="••••••••••••"
              autoComplete="current-password"
              className="w-full bg-[#FFFDE7] border rounded-xl px-4 py-3.5 text-[#1A4D1F] font-bold outline-none transition-all placeholder:text-[#1A4D1F]/30"
              style={{ borderColor: error && username === ADMIN_USERNAME ? "#ef4444" : pw ? "#1A4D1F" : "rgba(46,125,50,0.25)" }}
            />
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs font-bold">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-4 rounded-xl font-black text-black text-base transition-all disabled:opacity-35 mt-2"
            style={{ background: "#1A4D1F", boxShadow: canSubmit ? "0 0 25px rgba(46,125,50,0.3)" : "none" }}>
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  جاري التحقق...
                </span>
              : "تسجيل الدخول ←"}
          </button>
        </form>

        <p className="text-center text-[#1A4D1F]/15 text-xs mt-8">
          سند — Sanad · بن قردان
        </p>
      </motion.div>
    </div>
  );
}

export default function Admin() {
  const { lang, t, isRTL } = useLang();
  const [active, setActive] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, navigate] = useLocation();
  const session = getSession();

  // Role guard — allow admin, super_admin, manager only
  useEffect(() => {
    if (!session || !isAdminRole(session.role as any)) {
      navigate("/home");
    }
  }, []);

  // Whether the current user has full super-admin privileges
  const isSuper = isSuperAdmin(session?.role as any);

  // Find which group the active section belongs to and open it by default
  const findGroupId = (sectionId: Section) =>
    NAV_GROUPS.find(g => g.items.some(i => i.id === sectionId))?.id ?? NAV_GROUPS[0].id;

  const [openGroup, setOpenGroup] = useState<string>(() => findGroupId("overview"));

  const handleSetActive = (id: Section) => {
    setActive(id);
    setOpenGroup(findGroupId(id));
    setSidebarOpen(false);
  };

  const adminLogout = () => { clearSession(); navigate("/home"); };

  return (
    <div className="min-h-screen bg-background flex" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed top-0 h-screen z-40 flex flex-col border-[#1A4D1F]/20",
        "transition-all duration-300",
        isRTL ? "right-0 border-l" : "left-0 border-r",
        sidebarOpen ? "w-64" : "w-16 md:w-64"
      )} style={{ background: "#1A4D1F" }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-xl"
            style={{ background: "rgba(255,163,0,0.15)" }}>
            <img src="/sanad-logo.svg?v=5" alt="سند" style={{ height: 36, width: "auto", filter: "brightness(10)" }} draggable={false} />
          </div>
          <div className="hidden md:block overflow-hidden flex-1 min-w-0">
            <p className="text-xs font-black text-white/90 leading-tight">{t("لوحة التحكم","Admin Panel")}</p>
            <p className="text-[10px] text-white/50 font-bold truncate">{session?.name ?? "Admin"}</p>
            {session?.role && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black"
                style={{ background: "#FFA50030", color: "#FFA500" }}>
                {ROLE_OPTIONS.find(o => o.value === session.role)?.ar ?? session.role}
              </span>
            )}
          </div>
        </div>

        {/* ── Nav Groups ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => isSuper || !item.superOnly);
            if (visibleItems.length === 0) return null;
            const isOpen = openGroup === group.id;
            const groupHasActive = visibleItems.some(i => i.id === active);
            const GroupIcon = group.icon;
            return (
              <div key={group.id}>
                {/* Group header */}
                <button
                  onClick={() => setOpenGroup(isOpen ? "" : group.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: groupHasActive ? group.color + "30" : isOpen ? "rgba(255,255,255,0.08)" : "transparent",
                    color: groupHasActive ? group.color === "#1A4D1F" ? "#FFA500" : group.color : "rgba(255,255,255,0.55)",
                  }}
                >
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: groupHasActive ? group.color + "40" : "rgba(255,255,255,0.10)" }}>
                    <GroupIcon size={13} style={{ color: groupHasActive ? (group.color === "#1A4D1F" ? "#FFA500" : group.color) : "rgba(255,255,255,0.6)" }} />
                  </div>
                  <span className="hidden md:block flex-1 text-xs font-black truncate text-start">
                    {lang === "ar" ? group.ar : group.fr}
                  </span>
                  <ChevronDown
                    size={12}
                    className="hidden md:block flex-shrink-0 transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  />
                </button>

                {/* Group items */}
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5 ml-2 pl-2 border-l border-white/10">
                    {visibleItems.map(item => {
                      const Icon = item.icon;
                      const isAct = active === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSetActive(item.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
                          style={{
                            background: isAct ? "#FFA500" : "transparent",
                            color: isAct ? "#1A4D1F" : "rgba(255,255,255,0.50)",
                          }}
                        >
                          <Icon size={14} className="flex-shrink-0" />
                          <span className="hidden md:block truncate text-xs font-bold">
                            {lang === "ar" ? item.ar : item.fr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Back to app + Logout */}
        <div className="px-2 py-3 border-t border-white/10 space-y-1">
          <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all text-sm font-bold">
            <ChevronRight size={17} className={cn("flex-shrink-0", isRTL ? "rotate-0" : "rotate-180")} />
            <span className="hidden md:block text-xs">{t("العودة للتطبيق","Retour à l'app")}</span>
          </a>
          <button onClick={adminLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all"
            style={{ background: "#FFA500", color: "#1A4D1F" }}>
            <Power size={15} className="flex-shrink-0" />
            <span className="hidden md:block">{t("تسجيل الخروج","Déconnexion")}</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={cn("flex-1 min-w-0 p-4 md:p-8 pb-24", isRTL ? "mr-16 md:mr-64" : "ml-16 md:ml-64")}>
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <button onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-xl bg-[#1A4D1F]/5 text-[#1A4D1F]/40">
            <LayoutDashboard size={18} />
          </button>
          <p className="text-sm font-black text-[#1A4D1F]">{(() => { const item = NAV_GROUPS.flatMap(g => g.items).find(n => n.id === active); return lang === "ar" ? item?.ar : item?.fr; })()}</p>
          <NotificationBell lang={lang} role={session?.role as any || "admin"} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {active === "overview"      && <OverviewSection t={t} />}
            {active === "orders"        && <OrdersSection t={t} lang={lang} />}
            {active === "live_map"      && <LiveMapSection t={t} lang={lang} />}
            {active === "hotelBookings" && <HotelBookingsSection t={t} lang={lang} />}
            {active === "banners"       && <BannersSection t={t} />}
            {active === "ticker"        && <TickerSection t={t} />}
            {active === "partners"      && <PartnersSection t={t} />}
            {active === "ads"           && <AdsSection t={t} />}
            {active === "broadcast"     && <BroadcastSection t={t} lang={lang} />}
            {active === "suppliers"     && isSuper && <SuppliersSection t={t} lang={lang} />}
            {active === "articles"      && isSuper && <ArticlesSection t={t} lang={lang} />}
            {active === "staff"         && isSuper && <DeliveryStaffSection t={t} />}
            {active === "taxi_drivers"  && isSuper && <TaxiDriversSection t={t} />}
            {active === "delegations"   && isSuper && <DelegationsSection t={t} />}
            {active === "users"         && isSuper && <UsersSection t={t} />}
            {active === "delivery_config" && isSuper && <DeliveryConfigSection t={t} />}
            {active === "appearance"      && isSuper && <AppearanceSection t={t} />}
            {active === "car_rental"      && isSuper && <CarRentalSection t={t} />}
            {active === "sos_requests"    && isSuper && <SosSection t={t} />}
            {active === "lawyer_requests" && isSuper && <LawyerRequestsSection t={t} lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
