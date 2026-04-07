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
  ShoppingCart, LogIn, UserCircle, ChevronLeft, ChevronRight,
  MapPin, Truck, Eye, LogOut, Clock, CheckCircle, XCircle,
  Package, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Bike,
  Percent, Tag, Phone, ArrowLeft,
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
// SERVICE CATEGORIES — with emoji images for circles
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "restaurant",  ar: "مطاعم",       fr: "Restaurants",   href: null,            emoji: "🍽️",  bg: "radial-gradient(circle at 35% 30%, #FF8C00 0%, #C84B00 100%)" },
  { id: "grocery",     ar: "بقالة",       fr: "Épicerie",      href: null,            emoji: "🛒",  bg: "radial-gradient(circle at 35% 30%, #F59E0B 0%, #92400E 100%)" },
  { id: "pharmacy",    ar: "صيدلية",      fr: "Pharmacie",     href: null,            emoji: "💊",  bg: "radial-gradient(circle at 35% 30%, #10B981 0%, #065F46 100%)" },
  { id: "doctor",      ar: "طبيب",        fr: "Médecin",       href: null,            emoji: "🩺",  bg: "radial-gradient(circle at 35% 30%, #0EA5E9 0%, #0C4A6E 100%)" },
  { id: "taxi",        ar: "تاكسي",       fr: "Taxi",          href: "/taxi",         emoji: "🚕",  bg: "radial-gradient(circle at 35% 30%, #FCD34D 0%, #92400E 100%)" },
  { id: "car_rental",  ar: "كراء سيارات", fr: "Location auto", href: "/car-rental",   emoji: "🚗",  bg: "radial-gradient(circle at 35% 30%, #3B82F6 0%, #1E3A8A 100%)" },
  { id: "sos",         ar: "SOS",         fr: "SOS",           href: "/sos",          emoji: "🚨",  bg: "radial-gradient(circle at 35% 30%, #EF4444 0%, #7F1D1D 100%)" },
  { id: "lawyer",      ar: "محامي",       fr: "Avocat",        href: "/lawyer",       emoji: "⚖️",  bg: "radial-gradient(circle at 35% 30%, #1A4D1F 0%, #0D2B0F 100%)" },
  { id: "hotel",       ar: "فنادق",       fr: "Hôtels",        href: null,            emoji: "🏨",  bg: "radial-gradient(circle at 35% 30%, #8B5CF6 0%, #4C1D95 100%)" },
  { id: "mechanic",    ar: "ميكانيكي",    fr: "Mécanicien",    href: null,            emoji: "🔧",  bg: "radial-gradient(circle at 35% 30%, #6B7280 0%, #1F2937 100%)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-RING ORBITAL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const INNER_CATS = CATEGORIES.slice(0, 5);   // مطاعم، بقالة، صيدلية، طبيب، تاكسي
const OUTER_CATS = CATEGORIES.slice(5);      // كراء، SOS، محامي، فنادق، ميكانيكي

function OrbitRing({
  cats, radius, size, duration, clockwise, lang, cx, cy,
}: {
  cats: typeof CATEGORIES; radius: number; size: number;
  duration: number; clockwise: boolean; lang: string;
  cx: number; cy: number;
}) {
  const spinIn  = clockwise ? "orbit-cw"  : "orbit-ccw";
  const spinOut = clockwise ? "spin-ccw"  : "spin-cw";   // counter to keep upright

  return (
    <>
      {cats.map((cat, i) => {
        const delay = -((duration * i) / cats.length);
        return (
          <div
            key={`${cat.id}-${i}`}
            style={{
              position: "absolute",
              top: cy,
              left: cx,
              width: 0,
              height: 0,
              animationName: spinIn,
              animationDuration: `${duration}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationDelay: `${delay}s`,
              animationFillMode: "both",
              willChange: "transform",
              WebkitTransform: "translateZ(0)",
              transform: "translateZ(0)",
            }}
          >
            {/* Offset to orbit radius */}
            <div style={{ position: "absolute", left: radius - size / 2, top: -size / 2 }}>
              {/* Counter-rotate so content stays upright */}
              <div
                style={{
                  animationName: spinOut,
                  animationDuration: `${duration}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationDelay: `${delay}s`,
                  willChange: "transform",
                  WebkitTransform: "translateZ(0)",
                  transform: "translateZ(0)",
                }}
              >
                <Link href={cat.href ?? `/services?category=${cat.id}`}>
                  <div
                    className="flex flex-col items-center cursor-pointer active:scale-90 transition-transform duration-100"
                    style={{ gap: 4 }}
                  >
                    {/* Circle */}
                    <div
                      style={{
                        width: size,
                        height: size,
                        borderRadius: "50%",
                        background: cat.bg,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {/* Shine */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0, left: 0, right: 0,
                          height: "45%",
                          borderRadius: "50% 50% 0 0",
                          background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)",
                          pointerEvents: "none",
                        }}
                      />
                      <span
                        style={{
                          fontSize: size * 0.42,
                          lineHeight: 1,
                          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
                          userSelect: "none",
                        }}
                      >
                        {cat.emoji}
                      </span>
                    </div>
                    {/* Label */}
                    <p
                      style={{
                        fontSize: Math.round(size * 0.155),
                        fontWeight: 900,
                        color: "#1A4D1F",
                        textAlign: "center",
                        width: size + 12,
                        lineHeight: 1.2,
                        fontFamily: "'Cairo','Tajawal',sans-serif",
                      }}
                    >
                      {lang === "ar" ? cat.ar : cat.fr}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function OrbitSystem({ lang }: { lang: string }) {
  const [cw, setCw] = useState(() => Math.min(typeof window !== "undefined" ? window.innerWidth : 390, 430));

  useEffect(() => {
    const update = () => setCw(Math.min(window.innerWidth, 430));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Responsive sizing — fills the full available width
  const CX     = cw / 2;                        // center X
  const CY     = 215;                            // center Y (fixed, leaves room for bottom labels)
  const R_IN   = Math.round(cw * 0.272);        // inner orbit radius  ≈ 106px @ 390
  const R_OUT  = Math.round(cw * 0.444);        // outer orbit radius  ≈ 173px @ 390
  const S_IN   = Math.round(cw * 0.196);        // inner circle px     ≈ 76px  @ 390
  const S_OUT  = Math.round(cw * 0.172);        // outer circle px     ≈ 67px  @ 390
  const BADGE  = Math.round(cw * 0.226);        // center badge px     ≈ 88px  @ 390
  const HEIGHT = CY * 2 + 30;                   // total height        ≈ 460px

  return (
    <div className="w-full overflow-hidden" style={{ height: HEIGHT }}>
      <div style={{ position: "relative", width: cw, height: HEIGHT, margin: "0 auto" }}>

        {/* ── Orbit path rings (decorative) ── */}
        {[R_IN, R_OUT].map(r => (
          <div
            key={r}
            style={{
              position: "absolute",
              top: CY - r, left: CX - r,
              width: r * 2, height: r * 2,
              borderRadius: "50%",
              border: "1.5px dashed rgba(26,77,31,0.13)",
            }}
          />
        ))}

        {/* ── Glow behind center ── */}
        <div style={{
          position: "absolute",
          top: CY - BADGE * 0.75, left: CX - BADGE * 0.75,
          width: BADGE * 1.5, height: BADGE * 1.5,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(26,77,31,0.10) 0%, transparent 70%)",
        }} />

        {/* ── Center badge ── */}
        <div style={{
          position: "absolute",
          top: CY - BADGE / 2, left: CX - BADGE / 2,
          width: BADGE, height: BADGE,
          borderRadius: "50%",
          background: "linear-gradient(145deg, #1A4D1F 0%, #0D3311 100%)",
          boxShadow: "0 8px 30px rgba(26,77,31,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ color: "#FFA500", fontSize: Math.round(BADGE * 0.20), fontWeight: 900, lineHeight: 1, fontFamily: "'Cairo',sans-serif" }}>سند</span>
          <span style={{ color: "rgba(255,165,0,0.55)", fontSize: Math.round(BADGE * 0.11), fontWeight: 700, fontFamily: "'Outfit',sans-serif", letterSpacing: 1.5 }}>SANAD</span>
        </div>

        {/* ── Inner ring — clockwise 20s ── */}
        <OrbitRing cats={INNER_CATS} radius={R_IN}  size={S_IN}  duration={20} clockwise={true}  lang={lang} cx={CX} cy={CY} />

        {/* ── Outer ring — counter-clockwise 30s ── */}
        <OrbitRing cats={OUTER_CATS} radius={R_OUT} size={S_OUT} duration={30} clockwise={false} lang={lang} cx={CX} cy={CY} />
      </div>
    </div>
  );
}

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
          2. SERVICES — dual-ring orbital system
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="mt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-1 px-4 sm:px-6"
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-[#FFA500] block flex-shrink-0" />
            <h2 className="text-base font-black text-[#1A4D1F]">{t("خدماتنا", "Nos Services")}</h2>
          </div>
          <Link href="/services">
            <span className="text-[11px] font-black text-[#FFA500] border border-[#FFA500]/30 px-2.5 py-1 rounded-full">
              {t("الكل", "Tout")} ←
            </span>
          </Link>
        </motion.div>

        {/* ── Orbital system ── */}
        <OrbitSystem lang={lang} />
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
          ABOUT — ultra-compact strip
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mx-4 mt-5 mb-2 rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(26,77,31,0.06)", border: "1px solid rgba(26,77,31,0.12)" }}
        dir="rtl"
      >
        <MapPin size={14} className="text-[#1A4D1F]/40 flex-shrink-0" />
        <p className="text-xs font-bold text-[#1A4D1F]/60 leading-snug">
          {t(
            "سندك في التوصيل لباب الدار — نربطك بكل ما تحتاجه في المدينة",
            "Votre partenaire livraison à domicile — nous vous connectons à tout ce dont vous avez besoin"
          )}
        </p>
      </motion.div>

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
