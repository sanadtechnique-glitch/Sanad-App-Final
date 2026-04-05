import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { AdBanner } from "@/components/ad-banner";
import { PhotoAdGallery } from "@/components/PhotoAdGallery";
import { useLang } from "@/lib/language";
import { getSession, clearSession } from "@/lib/auth";
import { get } from "@/lib/admin-api";
import { useAppLogo } from "@/lib/useAppLogo";
import { useSocket } from "@/lib/use-socket";
import {
  Utensils, Pill, Scale, ShoppingCart, Wrench, Stethoscope,
  Car, Hotel, LogIn, UserCircle, ChevronLeft, ChevronRight,
  MapPin, Truck, Eye, Grid, LogOut, Clock, CheckCircle, XCircle,
  Package, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Bike,
  Percent, Tag, Phone, ArrowLeft, AlertTriangle, KeyRound,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function getRoleBadge(role: string) {
  const map: Record<string, { ar: string; fr: string; bg: string; border: string }> = {
    super_admin: { ar: "مدير النظام", fr: "Super Admin",  bg: "#B91C1C", border: "#991B1B" },
    admin:       { ar: "مدير النظام", fr: "Admin",        bg: "#B91C1C", border: "#991B1B" },
    manager:     { ar: "مدير النظام", fr: "Gestionnaire", bg: "#B91C1C", border: "#991B1B" },
    provider:    { ar: "مزود",        fr: "Fournisseur",  bg: "#1A4D1F", border: "#0D3311" },
    delivery:    { ar: "سائق/موزع",   fr: "Livreur",      bg: "#1565C0", border: "#0D47A1" },
    driver:      { ar: "سائق/موزع",   fr: "Livreur",      bg: "#1565C0", border: "#0D47A1" },
    client:      { ar: "عميل",        fr: "Client",       bg: "#0D3311", border: "#1A4D1F" },
  };
  return map[role] ?? map.client;
}

// ─────────────────────────────────────────────────────────────────────────────
// PANORAMIC PROMO SLIDES
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SLIDES = [
  {
    id: 1,
    imageUrl: "",
    titleAr: "عروض حصرية",
    titleFr: "Offres exclusives",
    subtitleAr: "أفضل العروض من مطاعم ومحلات المدينة",
    subtitleFr: "Les meilleures offres des restaurants de la ville",
    bgFrom: "#1A4D1F",
    bgTo: "#0D3311",
    accent: "#FFA500",
  },
  {
    id: 2,
    imageUrl: "",
    titleAr: "توصيل سريع لباب الدار",
    titleFr: "Livraison rapide à domicile",
    subtitleAr: "طلبك في أقل من 45 دقيقة — في أي مكان بالمدينة",
    subtitleFr: "Votre commande en moins de 45 min — partout en ville",
    bgFrom: "#E65100",
    bgTo: "#BF360C",
    accent: "#FFF3E0",
  },
  {
    id: 3,
    imageUrl: "",
    titleAr: "انضم كمزود خدمة",
    titleFr: "Rejoignez-nous en tant que prestataire",
    subtitleAr: "سجّل محلك أو مطعمك وابدأ استقبال الطلبات اليوم",
    subtitleFr: "Inscrivez votre boutique et commencez à recevoir des commandes",
    bgFrom: "#1565C0",
    bgTo: "#0D47A1",
    accent: "#FFA500",
  },
];

interface PromoSlide {
  id: number;
  titleAr: string;
  titleFr: string;
  subtitleAr?: string | null;
  subtitleFr?: string | null;
  imageUrl?: string | null;
  bgFrom?: string | null;
  bgTo?: string | null;
  accent?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "restaurant",  icon: Utensils,       ar: "مطاعم",          fr: "Restaurants",   href: null },
  { id: "grocery",     icon: ShoppingCart,   ar: "بقالة",          fr: "Épicerie",      href: null },
  { id: "pharmacy",    icon: Pill,           ar: "صيدلية",         fr: "Pharmacie",     href: null },
  { id: "doctor",      icon: Stethoscope,    ar: "طبيب",           fr: "Médecin",       href: null },
  { id: "taxi",        icon: Car,            ar: "تاكسي",          fr: "Taxi",          href: "/taxi" },
  { id: "car_rental",  icon: KeyRound,       ar: "كراء سيارات",    fr: "Location auto", href: "/car-rental" },
  { id: "sos",         icon: AlertTriangle,  ar: "SOS",            fr: "SOS",           href: "/sos" },
  { id: "lawyer",      icon: Scale,          ar: "محامي",          fr: "Avocat",        href: null },
  { id: "hotel",       icon: Hotel,          ar: "فنادق",          fr: "Hôtels",        href: null },
  { id: "mechanic",    icon: Wrench,         ar: "ميكانيكي",       fr: "Mécanicien",    href: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ONGOING_STATUSES = ["pending", "accepted", "prepared", "driver_accepted", "in_delivery"];

function statusConfig(status: string, t: (ar: string, fr: string) => string) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending:        { label: t("في الانتظار",     "En attente"),     color: "#92400E", bg: "#FEF3C7", icon: <Clock size={11} /> },
    accepted:       { label: t("مقبول",           "Accepté"),        color: "#1D4ED8", bg: "#DBEAFE", icon: <CheckCircle size={11} /> },
    prepared:       { label: t("جاهز",            "Prêt"),           color: "#6D28D9", bg: "#EDE9FE", icon: <Package size={11} /> },
    driver_accepted:{ label: t("السائق في الطريق","Livreur en route"),color: "#0369A1", bg: "#E0F2FE", icon: <Bike size={11} /> },
    in_delivery:    { label: t("في التوصيل",      "En livraison"),   color: "#0369A1", bg: "#E0F2FE", icon: <Truck size={11} /> },
    delivered:      { label: t("تم التوصيل",      "Livré"),          color: "#166534", bg: "#DCFCE7", icon: <CheckCircle size={11} /> },
    cancelled:      { label: t("ملغي",            "Annulé"),         color: "#991B1B", bg: "#FEE2E2", icon: <XCircle size={11} /> },
  };
  return map[status] ?? { label: status, color: "#6B7280", bg: "#F3F4F6", icon: <AlertCircle size={11} /> };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER CARD (compact for home page)
// ─────────────────────────────────────────────────────────────────────────────
interface Order {
  id: number;
  customerName: string;
  customerPhone?: string;
  customerAddress: string;
  notes?: string;
  serviceType: string;
  status: string;
  serviceProviderId: number;
  serviceProviderName: string;
  deliveryFee?: number;
  photoUrl?: string;
  createdAt: string;
}

function OrderCard({ order, t, expanded, onToggle }: {
  order: Order;
  t: (ar: string, fr: string) => string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = statusConfig(order.status, t);
  const date = new Date(order.createdAt).toLocaleDateString("ar-TN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <motion.div
      layout
      className="rounded-2xl border overflow-hidden cursor-pointer"
      style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.15)" }}
      onClick={onToggle}
      whileTap={{ scale: 0.99 }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3" dir="rtl">
        {/* Status dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: cfg.color }}
        />
        {/* Provider + service */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-[#1A4D1F] truncate">
            {order.serviceProviderName}
          </p>
          <p className="text-[10px] font-bold text-[#1A4D1F]/50 truncate">
            {order.serviceType} · {date}
          </p>
        </div>
        {/* Status badge */}
        <span
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.icon}
          {cfg.label}
        </span>
        {/* Order ID + expand arrow */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-[10px] font-black text-[#1A4D1F]/30">#{order.id}</span>
          {expanded
            ? <ChevronUp size={14} className="text-[#1A4D1F]/30" />
            : <ChevronDown size={14} className="text-[#1A4D1F]/30" />
          }
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-1 space-y-2 border-t"
              style={{ borderColor: "rgba(46,125,50,0.08)" }}
              dir="rtl"
            >
              <div className="grid grid-cols-2 gap-2">
                {order.customerAddress && (
                  <div className="flex items-start gap-1.5">
                    <MapPin size={12} className="text-[#1A4D1F]/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-[#1A4D1F]/40">{t("العنوان","Adresse")}</p>
                      <p className="text-xs font-black text-[#1A4D1F]/70">{order.customerAddress}</p>
                    </div>
                  </div>
                )}
                {order.deliveryFee !== undefined && (
                  <div className="flex items-start gap-1.5">
                    <Truck size={12} className="text-[#1A4D1F]/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-[#1A4D1F]/40">{t("رسوم التوصيل","Livraison")}</p>
                      <p className="text-xs font-black text-[#1A4D1F]/70">{order.deliveryFee} TND</p>
                    </div>
                  </div>
                )}
              </div>
              {order.notes && (
                <div className="flex items-start gap-1.5">
                  <Package size={12} className="text-[#1A4D1F]/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold text-[#1A4D1F]/40">{t("ملاحظات","Notes")}</p>
                    <p className="text-xs font-black text-[#1A4D1F]/70">{order.notes}</p>
                  </div>
                </div>
              )}
              {order.photoUrl && (
                <a href={order.photoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {t("عرض الصورة","Voir photo")}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE ORDERS BAR — horizontal scrolling mini-cards, real-time
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_PULSE: Record<string, boolean> = {
  pending: true, accepted: true, prepared: true, driver_accepted: true, in_delivery: true,
};

function ActiveOrdersBar({
  userId, name, t,
}: {
  userId: number | undefined;
  name: string;
  t: (ar: string, fr: string) => string;
}) {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await get<Order[]>(`/orders/customer?name=${encodeURIComponent(name)}`);
      setOrders(Array.isArray(data) ? data.filter(o => ONGOING_STATUSES.includes(o.status)) : []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [name]);

  useEffect(() => {
    load();
    refreshRef.current = setInterval(load, 8000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [load]);

  // Real-time socket: refresh instantly on order_status / driver_assigned
  useSocket("customer", userId, {
    order_status:    () => { load(); },
    driver_assigned: () => { load(); },
    order_updated:   () => { load(); },
  });

  if (loading || orders.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="px-4 sm:px-6 lg:px-10 mt-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3" dir="rtl">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        <span className="text-sm font-black text-[#1A4D1F]">
          {t("طلباتي الحالية", "Mes commandes actives")}
        </span>
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-full"
          style={{ background: "rgba(26,77,31,0.10)", color: "#1A4D1F" }}
        >
          {orders.length}
        </span>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" dir="rtl">
        {orders.map(order => {
          const cfg = statusConfig(order.status, t);
          const isPulsing = STATUS_PULSE[order.status] ?? false;
          return (
            <div
              key={order.id}
              className="flex-shrink-0 w-56 rounded-2xl overflow-hidden"
              style={{
                background: "#fff",
                border: "1.5px solid rgba(26,77,31,0.12)",
                boxShadow: "0 4px 18px rgba(26,77,31,0.10), 0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              {/* Color top stripe based on status */}
              <div className="h-1 w-full" style={{ background: cfg.color }} />

              <div className="p-3">
                {/* Order ID */}
                <div className="flex items-center justify-between mb-1.5" dir="rtl">
                  <span className="text-[10px] font-black text-[#1A4D1F]/35 font-mono">
                    #{order.id}
                  </span>
                  {/* Status badge */}
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {isPulsing && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={{ background: cfg.color }}
                        />
                        <span
                          className="relative inline-flex rounded-full h-1.5 w-1.5"
                          style={{ background: cfg.color }}
                        />
                      </span>
                    )}
                    {cfg.label}
                  </span>
                </div>

                {/* Provider name */}
                <p
                  className="font-black text-sm text-[#1A4D1F] leading-tight truncate mb-2.5"
                  dir="rtl"
                >
                  {order.serviceProviderName}
                </p>

                {/* Service type chip */}
                <p className="text-[10px] text-[#1A4D1F]/45 font-bold truncate mb-3" dir="rtl">
                  {order.serviceType}
                </p>

                {/* Track / Details button */}
                <Link href="/services">
                  <button
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "#1A4D1F" }}
                  >
                    <Eye size={11} />
                    {t("تفاصيل", "Détails")}
                    <ArrowLeft size={10} />
                  </button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MY ORDERS SECTION (embedded in home page)
// ─────────────────────────────────────────────────────────────────────────────
function MyOrdersSection({ name, t }: { name: string; t: (ar: string, fr: string) => string }) {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAll, setShowAll]     = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await get<Order[]>(`/orders/customer?name=${encodeURIComponent(name)}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [name]);

  useEffect(() => { load(); }, [load]);

  const ongoing  = orders.filter(o => ONGOING_STATUSES.includes(o.status));
  const history  = orders.filter(o => !ONGOING_STATUSES.includes(o.status));
  const shown    = showAll ? history : history.slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={20} className="animate-spin text-[#1A4D1F]/40" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8" dir="rtl">
        <ShoppingCart size={32} className="mx-auto mb-2 text-[#1A4D1F]/20" />
        <p className="text-sm font-black text-[#1A4D1F]/30">
          {t("لا توجد طلبات بعد", "Aucune commande pour l'instant")}
        </p>
        <p className="text-xs text-[#1A4D1F]/20 mt-1">
          {t("ستظهر طلباتك هنا بمجرد إرسالها", "Vos commandes apparaîtront ici")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#1A4D1F]/40">
          {orders.length} {t("طلب", "commande(s)")}
        </span>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs font-bold text-[#1A4D1F]/50 hover:text-[#1A4D1F] transition-all"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {t("تحديث", "Actualiser")}
        </button>
      </div>

      {/* ONGOING */}
      {ongoing.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-black text-amber-600">
              {t("جارية الآن", "En cours")} ({ongoing.length})
            </span>
          </div>
          <div className="space-y-2">
            {ongoing.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                t={t}
                expanded={expandedId === o.id}
                onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* HISTORY */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-[#1A4D1F]/40" />
            <span className="text-xs font-black text-[#1A4D1F]/50">
              {t("السابقة", "Historique")} ({history.length})
            </span>
          </div>
          <div className="space-y-2">
            {shown.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                t={t}
                expanded={expandedId === o.id}
                onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              />
            ))}
          </div>
          {history.length > 3 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full mt-2 py-2 rounded-xl text-xs font-black text-[#1A4D1F]/50 hover:text-[#1A4D1F] border border-[#1A4D1F]/10 hover:border-[#1A4D1F]/30 transition-all"
            >
              {showAll
                ? t("عرض أقل", "Voir moins")
                : t(`عرض الكل (${history.length})`, `Voir tout (${history.length})`)
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANORAMIC SLIDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function PromoSlider({ lang }: { lang: string }) {
  const [active, setActive] = useState(0);
  const [slides, setSlides] = useState<PromoSlide[]>(DEFAULT_SLIDES);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    get<PromoSlide[]>("/banners").then(data => {
      if (Array.isArray(data) && data.length > 0) setSlides(data);
    }).catch(() => {});
  }, []);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(i => (i + 1) % slides.length);
    }, 5000);
  };

  useEffect(() => {
    setActive(0);
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides]);

  const slide = slides[active] ?? slides[0];

  const goTo = (idx: number) => {
    setActive(idx);
    resetTimer();
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        aspectRatio: "16/7",
        minHeight: 130,
        maxHeight: 260,
        border: "1.5px solid rgba(46,125,50,0.22)",
        boxShadow: "0 6px 28px rgba(46,125,50,0.18), 0 1px 4px rgba(0,0,0,0.08)",
      }}
    >

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center px-10 sm:px-16"
          style={{
            background: `linear-gradient(135deg, ${slide.bgFrom || "#1A4D1F"} 0%, ${slide.bgTo || "#0D3311"} 100%)`,
          }}
        >
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.30) 0%, transparent 52%), " +
                "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.18) 0%, transparent 52%)",
            }} />

          {/* Accent circle decoration */}
          <div
            className="absolute right-5 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full opacity-15"
            style={{ background: slide.accent || "#FFA500" }}
          />
          <div
            className="absolute left-5 bottom-2 w-14 h-14 rounded-full opacity-8"
            style={{ background: slide.accent || "#FFA500" }}
          />

          {/* Text block */}
          <div className="relative z-10 text-center w-full" dir="rtl">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xs sm:text-sm font-black mb-1.5 leading-snug"
              style={{
                color: slide.accent,
                fontFamily: "'Cairo','Tajawal',sans-serif",
                opacity: 0.95,
                textShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
            >
              {lang === "ar" ? slide.subtitleAr : slide.subtitleFr}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl sm:text-2xl font-black text-white leading-snug"
              style={{
                fontFamily: "'Cairo','Tajawal',sans-serif",
                textShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              {lang === "ar" ? slide.titleAr : slide.titleFr}
            </motion.h2>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nav arrows */}
      {slides.length > 1 && (
        <button
          onClick={() => goTo((active - 1 + slides.length) % slides.length)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{ background: "rgba(46,125,50,0.35)", backdropFilter: "blur(4px)" }}
          aria-label="Previous"
        >
          <ChevronRight size={14} className="text-white" />
        </button>
      )}
      {slides.length > 1 && (
        <button
          onClick={() => goTo((active + 1) % slides.length)}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{ background: "rgba(46,125,50,0.35)", backdropFilter: "blur(4px)" }}
          aria-label="Next"
        >
          <ChevronLeft size={14} className="text-white" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === active ? 18 : 6,
              height: 6,
              background: i === active ? "#fff" : "rgba(255,255,255,0.45)",
              border: i === active ? "1px solid rgba(46,125,50,0.5)" : "none",
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { lang, t, isRTL } = useLang();
  const [, navigate] = useLocation();
  const session = getSession();
  const appLogo = useAppLogo();

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FFF3E0", fontFamily: "'Cairo','Tajawal',sans-serif" }}
      dir="rtl"
    >

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between"
        style={{
          background: "rgba(255,243,224,0.92)",
          borderBottom: "1.5px solid rgba(46,125,50,0.12)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/home")}
        >
          <img src={appLogo} alt="سند" style={{ height: 88, width: "auto" }} draggable={false} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-2"
        >
          {session ? (
            <div className="flex items-center gap-2">
              {/* User info card */}
              <div className="flex items-center gap-2" dir="rtl">
                {/* Avatar circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-white text-sm shadow-md"
                  style={{ background: getRoleBadge(session.role).bg }}
                >
                  {session.name?.charAt(0)?.toUpperCase() || "؟"}
                </div>
                {/* Name + badge */}
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-black leading-tight" style={{ color: "#1A4D1F" }}>
                    {t("مرحباً،", "Bonjour,")} {session.name}
                  </span>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5"
                    style={{
                      background: getRoleBadge(session.role).bg,
                      color: "#fff",
                      border: `1px solid ${getRoleBadge(session.role).border}`,
                    }}
                  >
                    {lang === "ar"
                      ? getRoleBadge(session.role).ar
                      : getRoleBadge(session.role).fr}
                  </span>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={() => { clearSession(); navigate("/auth"); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-red-400/30 bg-red-400/10 hover:bg-red-400/20 transition-all"
                title={t("تسجيل الخروج", "Déconnexion")}
              >
                <LogOut size={13} className="text-red-500" />
                <span className="hidden sm:inline text-xs font-bold text-red-500">{t("خروج", "Quitter")}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Guest label */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#1A4D1F]/20"
                style={{ background: "rgba(46,125,50,0.05)" }}>
                <UserCircle size={14} className="text-[#1A4D1F]/40" />
                <span className="text-xs font-bold text-[#1A4D1F]/50">{t("زائر", "Visiteur")}</span>
              </div>
              {/* Login button */}
              <button
                onClick={() => navigate("/auth")}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-black text-sm text-white transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: "#1A4D1F",
                  boxShadow: "0 3px 14px rgba(46,125,50,0.30)",
                }}
              >
                <LogIn size={14} />
                {t("دخول", "Connexion")}
              </button>
            </div>
          )}
        </motion.div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          PANORAMIC ADVERTISING SLIDER
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="px-4 sm:px-6 lg:px-10 mt-4"
      >
        <PromoSlider lang={lang} />
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════════
          ACTIVE ORDERS BAR — real-time mini-cards (logged-in clients only)
      ══════════════════════════════════════════════════════════════════════ */}
      {session?.role === "client" && (
        <ActiveOrdersBar userId={session.userId} name={session.name} t={t} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1. DEALS BUTTON — منتجات في التخفيض
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="px-4 sm:px-6 lg:px-10 mt-5"
      >
        <Link href="/deals">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="relative overflow-hidden rounded-2xl flex items-center gap-4 px-5 py-4 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)",
              boxShadow: "0 6px 24px rgba(185,28,28,0.35)",
            }}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />

            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Percent size={22} className="text-white" />
            </div>

            {/* Text */}
            <div className="flex-1" dir="rtl">
              <p className="text-white font-black text-base">
                {t("منتجات في التخفيض", "Produits en promotion")}
              </p>
              <p className="text-white/70 text-xs font-bold mt-0.5">
                {t("أفضل العروض من جميع المزودين", "Meilleures offres de tous les fournisseurs")}
              </p>
            </div>

            {/* Tag icon */}
            <Tag size={18} className="text-white/50 flex-shrink-0" />
          </motion.div>
        </Link>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════════
          2. SERVICES GRID — redesigned
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-10 mt-8">

        {/* ── Section header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-5"
          dir="rtl"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-7 rounded-full bg-[#FFA500] block flex-shrink-0" />
            <div>
              <h2 className="text-xl font-black text-[#1A4D1F] leading-tight">
                {t("خدماتنا", "Nos Services")}
              </h2>
              <p className="text-xs font-medium leading-none mt-0.5" style={{ color: "rgba(46,125,50,0.45)" }}>
                {t("اختر الخدمة المناسبة", "Choisissez votre service")}
              </p>
            </div>
          </div>
          <Link href="/services">
            <button
              className="text-[11px] font-black px-3 py-1.5 rounded-full border transition-all active:scale-95"
              style={{
                color: "#FFA500",
                borderColor: "rgba(255,165,0,0.35)",
                background: "rgba(255,165,0,0.07)",
              }}
            >
              {t("عرض الكل", "Voir tout")} ←
            </button>
          </Link>
        </motion.div>

        {/* ── Horizontal scrollable category row ─────────────────────────── */}
        {(() => {
          const CAT_THEME: Record<string, { from: string; to: string; glow: string }> = {
            restaurant: { from: "#E8820A", to: "#FFA500", glow: "#FFA50066" },
            pharmacy:   { from: "#005432", to: "#007A48", glow: "#006B3C55" },
            lawyer:     { from: "#0D3311", to: "#1A4D1F", glow: "#1A4D1F55" },
            grocery:    { from: "#B85C00", to: "#E8960A", glow: "#E8960A55" },
            taxi:       { from: "#D4850A", to: "#FFA500", glow: "#FFA50099" },
            mechanic:   { from: "#1A4D1F", to: "#2E7D32", glow: "#2E7D3255" },
            doctor:     { from: "#C96B00", to: "#F59E0B", glow: "#F59E0B55" },
            hotel:      { from: "#A86A00", to: "#D4930A", glow: "#D4930A55" },
            car_rental: { from: "#1565C0", to: "#1976D2", glow: "#1976D255" },
            sos:        { from: "#B91C1C", to: "#EF4444", glow: "#EF444499" },
          };
          return (
            <div
              className="flex gap-4 overflow-x-auto pb-3"
              style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
            >
              {CATEGORIES.map((cat, i) => {
                const Icon = cat.icon;
                const theme = CAT_THEME[cat.id] ?? { from: "#1A4D1F", to: "#006B3C", glow: "#1A4D1F55" };
                return (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.05, type: "spring", stiffness: 300, damping: 26 }}
                    style={{ scrollSnapAlign: "start", flexShrink: 0 }}
                  >
                    <Link href={cat.href ?? `/services?category=${cat.id}`}>
                      <div className="flex flex-col items-center gap-2.5 cursor-pointer group active:scale-95 transition-transform duration-150" style={{ width: 72 }}>

                        {/* Gradient circle */}
                        <div
                          className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 20,
                            background: `linear-gradient(145deg, ${theme.from} 0%, ${theme.to} 100%)`,
                            boxShadow: `0 6px 18px ${theme.glow}`,
                          }}
                        >
                          {/* Inner shine */}
                          <div
                            className="absolute top-0 inset-x-0 h-1/2 rounded-t-[20px] pointer-events-none"
                            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)" }}
                          />
                          <Icon size={26} color="white" strokeWidth={2} />
                        </div>

                        {/* Arabic label */}
                        <p
                          className="font-black text-[12px] text-center leading-tight"
                          style={{ color: "#1A4D1F", width: 72 }}
                        >
                          {cat.ar}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}

              {/* "See all" pill at the end */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55, type: "spring", stiffness: 300, damping: 26 }}
                style={{ scrollSnapAlign: "start", flexShrink: 0 }}
              >
                <Link href="/services">
                  <div className="flex flex-col items-center gap-2.5 cursor-pointer group active:scale-95 transition-transform duration-150" style={{ width: 72 }}>
                    <div
                      className="flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                      style={{
                        width: 64, height: 64, borderRadius: 20,
                        background: "rgba(26,77,31,0.07)",
                        border: "2px dashed rgba(26,77,31,0.25)",
                      }}
                    >
                      <span className="font-black text-2xl" style={{ color: "#1A4D1F" }}>+</span>
                    </div>
                    <p className="font-black text-[11px] text-center leading-tight" style={{ color: "#1A4D1F", width: 72 }}>
                      {lang === "ar" ? "الكل" : "Tout"}
                    </p>
                  </div>
                </Link>
              </motion.div>
            </div>
          );
        })()}

      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. MY ORDERS — shown only for logged-in clients
      ══════════════════════════════════════════════════════════════════════ */}
      {session?.role === "client" && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="px-4 sm:px-6 lg:px-10 mt-8"
        >
          {/* Section header */}
          <div className="flex items-center justify-between mb-4" dir="rtl">
            <div>
              <h2 className="text-lg font-black text-[#1A4D1F]">
                {t("طلباتي", "Mes commandes")}
              </h2>
              <p className="text-xs font-bold text-[#1A4D1F]/40">
                {t("جميع طلباتك من كل المزودين", "Toutes vos commandes")}
              </p>
            </div>
            <Link href="/services">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90"
                style={{ background: "#1A4D1F" }}
              >
                <ShoppingCart size={13} />
                {t("طلب جديد", "Nouvelle commande")}
              </button>
            </Link>
          </div>

          {/* Card container */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(46,125,50,0.04)",
              border: "1.5px solid rgba(46,125,50,0.12)",
            }}
          >
            <MyOrdersSection name={session.name} t={t} />
          </div>
        </motion.section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABOUT US
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="px-4 sm:px-8 lg:px-16 mt-10 mb-6"
      >
        <div className="flex items-center gap-4 mb-7">
          <div className="flex-1 h-px" style={{ background: "rgba(46,125,50,0.18)" }} />
          <MapPin size={18} style={{ color: "#1A4D1F", flexShrink: 0 }} />
          <div className="flex-1 h-px" style={{ background: "rgba(46,125,50,0.18)" }} />
        </div>

        <h2
          className="text-2xl font-black text-center mb-8"
          style={{ color: "#1A4D1F", fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl"
        >
          عن سند.. لماذا نحن هنا؟
        </h2>

        <div className="flex flex-col gap-6 max-w-2xl mx-auto">
          {[
            { icon: Truck, titleAr: "لماذا وضعناه على ذمتكم؟", bodyAr: "لأن وقتكم غالي، ولأننا نؤمن بضرورة تقريب المسافات وتسهيل حياتكم اليومية." },
            { icon: Grid,  titleAr: "ما هو دورنا؟",            bodyAr: "نحن الرابط الذكي بينك وبين احتياجاتك؛ سواء كانت قضية من المغازة، طرد مستعجل، أو وجبة من مطعمك المفضل." },
            { icon: Eye,   titleAr: "رؤيتنا",                   bodyAr: "أن نكون الخيار الأول والآمن لكل مواطن بفضل تكنولوجيا محلية تحترم خصوصيتكم وتلبي تطلعاتكم." },
          ].map(({ icon: Icon, titleAr, bodyAr }, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + idx * 0.08 }}
              className="rounded-2xl p-5 text-center"
              style={{
                background: "rgba(46,125,50,0.06)",
                border: "1.5px solid rgba(46,125,50,0.14)",
              }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "#1A4D1F" }}>
                <Icon size={18} className="text-white" />
              </div>
              <p className="font-black text-base mb-1" style={{ color: "#1A4D1F", fontFamily: "'Cairo','Tajawal',sans-serif" }} dir="rtl">
                {titleAr}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(46,125,50,0.75)", fontFamily: "'Cairo','Tajawal',sans-serif" }} dir="rtl">
                {bodyAr}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════════
          PHOTO AD GALLERY — 5 image slots, no text
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-10 mt-8">
        <PhotoAdGallery />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer
        className="mt-10 py-5 text-center border-t"
        style={{
          borderColor: "rgba(46,125,50,0.12)",
          background: "rgba(46,125,50,0.04)",
        }}
      >
        <p className="text-xs font-bold" style={{ color: "rgba(46,125,50,0.55)", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          جميع الحقوق محفوظة © سند · Sanad
        </p>
        <a
          href="tel:27777589"
          dir="ltr"
          className="inline-flex items-center gap-1.5 mt-1 group"
          style={{ fontFamily: "'Outfit',sans-serif" }}
        >
          <Phone size={12} style={{ color: "#1A4D1F" }} />
          <span
            className="text-xs font-black tracking-widest group-hover:underline"
            style={{ color: "rgba(46,125,50,0.65)", letterSpacing: "0.10em" }}
          >
            27 777 589
          </span>
        </a>
      </footer>

    </div>
  );
}
