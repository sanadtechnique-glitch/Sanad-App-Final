import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { AdBanner } from "@/components/ad-banner";
import { useLang } from "@/lib/language";
import { getSession, clearSession } from "@/lib/auth";
import { get } from "@/lib/admin-api";
import { useAppLogo } from "@/lib/useAppLogo";
import { useSocket } from "@/lib/use-socket";
import {
  ShoppingCart, LogIn, UserCircle, ChevronLeft, ChevronRight,
  MapPin, Truck, Eye, LogOut, Clock, CheckCircle, XCircle,
  Package, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Bike,
  Percent, Tag, Phone, ArrowLeft, Search, X as XIcon, Store, ShoppingBag,
  Megaphone,
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
  // ── حلقة داخلية — خدمات (6) — كبيرة ──────────────────────────────────────
  { id: "taxi",        ar: "تاكسي",       fr: "Taxi",          href: "/taxi",         emoji: "🚕",  bg: "radial-gradient(circle at 35% 30%, #FCD34D 0%, #92400E 100%)" },
  { id: "doctor",      ar: "طبيب",        fr: "Médecin",       href: null,            emoji: "🩺",  bg: "radial-gradient(circle at 35% 30%, #0EA5E9 0%, #0C4A6E 100%)" },
  { id: "car_rental",  ar: "كراء سيارات", fr: "Location auto", href: "/car-rental",   emoji: "🚗",  bg: "radial-gradient(circle at 35% 30%, #3B82F6 0%, #1E3A8A 100%)" },
  { id: "sos",         ar: "SOS",         fr: "SOS",           href: "/sos",          emoji: "🚨",  bg: "radial-gradient(circle at 35% 30%, #EF4444 0%, #7F1D1D 100%)" },
  { id: "lawyer",      ar: "محامي",       fr: "Avocat",        href: "/lawyer",       emoji: "⚖️",  bg: "radial-gradient(circle at 35% 30%, #1A4D1F 0%, #0D2B0F 100%)" },
  { id: "hotel",       ar: "فنادق",       fr: "Hôtels",        href: null,            emoji: "🏨",  bg: "radial-gradient(circle at 35% 30%, #8B5CF6 0%, #4C1D95 100%)" },
  // ── حلقة خارجية — منتجات (7) — صغيرة ─────────────────────────────────────
  { id: "restaurant",  ar: "مطاعم",       fr: "Restaurants",   href: null,            emoji: "🍽️",  bg: "radial-gradient(circle at 35% 30%, #FF8C00 0%, #C84B00 100%)" },
  { id: "grocery",     ar: "بقالة",       fr: "Épicerie",      href: null,            emoji: "🛒",  bg: "radial-gradient(circle at 35% 30%, #F59E0B 0%, #92400E 100%)" },
  { id: "vegetables",  ar: "خضر وغلال",  fr: "Légumes & Fruits", href: null,          emoji: "🥦",  bg: "radial-gradient(circle at 35% 30%, #22C55E 0%, #14532D 100%)" },
  { id: "pharmacy",    ar: "صيدلية",      fr: "Pharmacie",     href: null,            emoji: "💊",  bg: "radial-gradient(circle at 35% 30%, #10B981 0%, #065F46 100%)" },
  { id: "bakery",      ar: "مخبز",        fr: "Boulangerie",   href: null,            emoji: "🥖",  bg: "radial-gradient(circle at 35% 30%, #D97706 0%, #78350F 100%)" },
  { id: "butcher",     ar: "جزار",        fr: "Boucherie",     href: null,            emoji: "🥩",  bg: "radial-gradient(circle at 35% 30%, #DC2626 0%, #7F1D1D 100%)" },
  { id: "sweets",      ar: "مرطبات",      fr: "Pâtisserie",    href: null,            emoji: "🍬",  bg: "radial-gradient(circle at 35% 30%, #EC4899 0%, #831843 100%)" },
  { id: "cafe",        ar: "مقهى",        fr: "Café",          href: null,            emoji: "☕",  bg: "radial-gradient(circle at 35% 30%, #92400E 0%, #3B1A08 100%)" },
  { id: "clothing",    ar: "ملابس",       fr: "Vêtements",     href: null,            emoji: "👔",  bg: "radial-gradient(circle at 35% 30%, #7C3AED 0%, #3B1A8B 100%)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-RING ORBITAL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const INNER_CATS = CATEGORIES.slice(0, 6);   // خدمات: تاكسي، طبيب، كراء، SOS، محامي، فنادق
const OUTER_CATS = CATEGORIES.slice(6);      // منتجات: مطاعم، بقالة، صيدلية، مخبز، جزار، مرطبات، مقهى، ملابس

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
              pointerEvents: "none",
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
                  pointerEvents: "none",
                }}
              >
                <Link href={cat.href ?? `/services?category=${cat.id}`} style={{ pointerEvents: "auto" }}>
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

const ROW1_IDS = ["restaurant", "grocery", "vegetables", "taxi", "clothing"];
const ROW3_IDS = ["doctor", "pharmacy", "lawyer", "car_rental", "hotel"];

function ServicesMarquee({ lang }: { lang: string }) {
  const row1 = ROW1_IDS.map(id => CATEGORIES.find(c => c.id === id)!).filter(Boolean);
  const row3 = ROW3_IDS.map(id => CATEGORIES.find(c => c.id === id)!).filter(Boolean);
  const row2 = CATEGORIES.filter(c => !ROW1_IDS.includes(c.id) && !ROW3_IDS.includes(c.id));

  const ServiceChip = ({ cat, size = 32 }: { cat: typeof CATEGORIES[0]; size?: number }) => (
    <Link href={cat.href ?? `/services?category=${cat.id}`}>
      <div
        className="flex flex-col items-center gap-1 cursor-pointer select-none active:scale-90 transition-transform duration-100"
        style={{ background: "transparent", border: "none", boxShadow: "none", padding: "6px 6px" }}
      >
        <span style={{ fontSize: size, lineHeight: 1, filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.15))" }}>
          {cat.emoji}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: "#1A4D1F",
          fontFamily: "'Cairo','Tajawal',sans-serif",
          textAlign: "center",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}>
          {lang === "ar" ? cat.ar : cat.fr}
        </span>
      </div>
    </Link>
  );

  return (
    <div className="w-full" dir="rtl">
      {/* ── Row 1: Static 5-column grid ── */}
      <div className="grid grid-cols-5 px-4 sm:px-6 mb-1">
        {row1.map(cat => <ServiceChip key={cat.id} cat={cat} size={30} />)}
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 sm:mx-6 my-2" style={{ height: 1, background: "rgba(26,77,31,0.07)" }} />

      {/* ── Row 2: Horizontal scroll slider ── */}
      <div
        className="flex overflow-x-auto px-4 sm:px-6 pb-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", gap: 0 }}
      >
        {row2.map((cat, i) => (
          <div
            key={cat.id}
            className="flex-shrink-0"
            style={{
              transform: i % 2 === 0 ? "translateY(0px)" : "translateY(4px)",
              minWidth: "25%",
            }}
          >
            <ServiceChip cat={cat} size={30} />
          </div>
        ))}
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 sm:mx-6 my-2" style={{ height: 1, background: "rgba(26,77,31,0.07)" }} />

      {/* ── Row 3: Static 5-column grid ── */}
      <div className="grid grid-cols-5 px-4 sm:px-6 mt-1">
        {row3.map(cat => <ServiceChip key={cat.id} cat={cat} size={28} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS LOCATION PICKER
// ─────────────────────────────────────────────────────────────────────────────
function LocationPickerBar({ lang, t }: { lang: string; t: (ar: string, fr: string) => string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [cityName, setCityName] = useState<string>("");

  useEffect(() => {
    const cached = sessionStorage.getItem("sanad_gps_coords");
    if (cached) {
      try {
        const { city } = JSON.parse(cached);
        if (city) { setCityName(city); setStatus("granted"); }
        else setStatus("granted");
      } catch { /* ignore */ }
    }
  }, []);

  const requestGPS = () => {
    if (!navigator.geolocation) { setStatus("denied"); return; }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const payload = { lat: latitude, lng: longitude, city: "بن قردان" };
        sessionStorage.setItem("sanad_gps_coords", JSON.stringify(payload));
        setCityName("بن قردان");
        setStatus("granted");
      },
      () => setStatus("denied"),
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  return (
    <div className="px-4 sm:px-6 mt-4" dir="rtl">
      <button
        onClick={status === "idle" || status === "denied" ? requestGPS : undefined}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 active:scale-[0.98]"
        style={{
          background: "#ffffff",
          border: "1.5px solid rgba(26,77,31,0.15)",
          boxShadow: "0 2px 10px rgba(26,77,31,0.07)",
          cursor: status === "granted" ? "default" : "pointer",
        }}
      >
        {/* GPS Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: status === "granted" ? "#1A4D1F" : "rgba(26,77,31,0.08)" }}
        >
          {status === "loading" ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <MapPin size={17} style={{ color: "#1A4D1F" }} />
            </motion.div>
          ) : (
            <MapPin size={17} style={{ color: status === "granted" ? "#fff" : "#1A4D1F" }} />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 text-right">
          <p className="text-xs font-black text-[#1A4D1F]" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
            {status === "granted"
              ? t(`موقعك: ${cityName || "بن قردان"}`, `Votre position: ${cityName || "Ben Guerdane"}`)
              : status === "loading"
              ? t("جاري تحديد موقعك...", "Localisation en cours...")
              : status === "denied"
              ? t("تعذّر الوصول للموقع — اضغط للمحاولة", "Accès refusé — Réessayer")
              : t("المواقع القريبة منك", "Points proches de vous")}
          </p>
          <p className="text-[10px] text-[#1A4D1F]/50 mt-0.5" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
            {status === "granted"
              ? t("المحلات القريبة جاهزة للعرض", "Boutiques à proximité disponibles")
              : t("اضغط لتفعيل GPS وعرض المحلات القريبة", "Appuyez pour activer le GPS")}
          </p>
        </div>

        {/* Arrow / Check */}
        <div className="flex-shrink-0">
          {status === "granted"
            ? <CheckCircle size={16} style={{ color: "#1A4D1F" }} />
            : <ChevronLeft size={16} style={{ color: "#1A4D1F", opacity: 0.4 }} />}
        </div>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
      style={{ background: "#f8f8f8", borderColor: "rgba(0,0,0,0.07)" }}
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
// HOME SEARCH BAR
// ─────────────────────────────────────────────────────────────────────────────
interface SearchProvider {
  id: number; name: string; nameAr: string; category: string;
  photoUrl?: string | null; isAvailable: boolean; address?: string | null;
}
interface SearchArticle {
  id: number; nameAr: string; nameFr: string; price: string;
  photoUrl?: string | null; supplierId: number;
}
interface SearchResults { providers: SearchProvider[]; articles: SearchArticle[]; }

const CAT_LABELS: Record<string, { ar: string; emoji: string }> = {
  restaurant: { ar: "مطعم",    emoji: "🍽️" }, grocery:    { ar: "بقالة",   emoji: "🛒" },
  pharmacy:   { ar: "صيدلية",  emoji: "💊" }, bakery:     { ar: "مخبز",    emoji: "🥖" },
  butcher:    { ar: "جزار",    emoji: "🥩" }, cafe:       { ar: "مقهى",    emoji: "☕" },
  sweets:     { ar: "مرطبات",  emoji: "🍬" }, hotel:      { ar: "فندق",    emoji: "🏨" },
  car_rental: { ar: "سيارات",  emoji: "🚗" }, sos:        { ar: "إنقاذ",   emoji: "🚨" },
  lawyer:     { ar: "محامي",   emoji: "⚖️" }, doctor:     { ar: "طبيب",    emoji: "🩺" },
  taxi:       { ar: "تاكسي",   emoji: "🚕" },
  clothing:   { ar: "ملابس",   emoji: "👔" },
};

function HomeSearchBar({ lang, t }: { lang: string; t: (ar: string, fr: string) => string }) {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<SearchResults | null>(null);
  const [loading, setLoading]     = useState(false);
  const [focused, setFocused]     = useState(false);
  const [, navigate]              = useLocation();
  const inputRef                  = useRef<HTMLInputElement>(null);
  const timerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef              = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const data = await get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch { setResults(null); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 320);
  };

  const clear = () => { setQuery(""); setResults(null); inputRef.current?.focus(); };

  const isEmpty   = results && results.providers.length === 0 && results.articles.length === 0;
  const showPanel = focused && query.length >= 2;

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full" dir="rtl">
      {/* Input */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 transition-all duration-200"
        style={{
          background: "#fff",
          border: focused ? "2px solid #FFA500" : "2px solid rgba(26,77,31,0.22)",
          boxShadow: focused
            ? "0 4px 20px rgba(255,165,0,0.22)"
            : "0 3px 14px rgba(26,77,31,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
          height: 52,
        }}
      >
        {loading
          ? <div className="w-4 h-4 border-2 border-[#FFA500] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          : <Search size={18} className="flex-shrink-0" style={{ color: focused ? "#FFA500" : "rgba(26,77,31,0.4)" }} />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          placeholder={t("ابحث عن مزود، خدمة أو منتوج...", "Chercher fournisseur, service ou produit...")}
          className="flex-1 bg-transparent outline-none text-sm font-bold text-right"
          style={{
            color: "#1A4D1F",
            fontFamily: "'Cairo','Tajawal',sans-serif",
            caretColor: "#FFA500",
          }}
        />
        {query && (
          <button onClick={clear} className="flex-shrink-0 p-0.5 rounded-full hover:bg-gray-100 transition-colors">
            <XIcon size={15} style={{ color: "rgba(26,77,31,0.4)" }} />
          </button>
        )}
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute z-50 w-full mt-2 rounded-2xl overflow-hidden"
            style={{
              background: "#fff",
              border: "1.5px solid rgba(26,77,31,0.12)",
              boxShadow: "0 12px 40px rgba(26,77,31,0.14)",
              maxHeight: 380,
              overflowY: "auto",
            }}
          >
            {isEmpty && (
              <div className="py-8 text-center" dir="rtl">
                <Search size={28} className="mx-auto mb-2 opacity-20" style={{ color: "#1A4D1F" }} />
                <p className="text-sm font-bold" style={{ color: "rgba(26,77,31,0.4)", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  {t("لا توجد نتائج", "Aucun résultat")}
                </p>
              </div>
            )}

            {/* Providers */}
            {(results?.providers.length ?? 0) > 0 && (
              <div>
                <div
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                  style={{ color: "rgba(26,77,31,0.35)", borderBottom: "1px solid rgba(26,77,31,0.06)", background: "rgba(26,77,31,0.02)" }}
                  dir="rtl"
                >
                  <Store size={12} />
                  {t("المزودون", "Fournisseurs")} — {results!.providers.length}
                </div>
                {results!.providers.map(p => {
                  const cat = CAT_LABELS[p.category] ?? { ar: p.category, emoji: "🏪" };
                  return (
                    <button
                      key={p.id}
                      onClick={() => { navigate(p.category === "hotel" ? `/hotel/${p.id}` : `/store/${p.id}`); setFocused(false); setQuery(""); setResults(null); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right"
                      dir="rtl"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ background: "rgba(26,77,31,0.07)" }}
                      >
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.nameAr} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          : <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: "#1A4D1F", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                          {lang === "ar" ? p.nameAr || p.name : p.name || p.nameAr}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: "rgba(26,77,31,0.45)" }}>{cat.emoji} {cat.ar}</span>
                          {p.isAvailable && (
                            <span className="text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: "rgba(26,77,31,0.08)", color: "#1A4D1F" }}>
                              {t("متاح", "Disponible")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronLeft size={14} style={{ color: "rgba(26,77,31,0.3)" }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Articles */}
            {(results?.articles.length ?? 0) > 0 && (
              <div>
                <div
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                  style={{ color: "rgba(26,77,31,0.35)", borderBottom: "1px solid rgba(26,77,31,0.06)", background: "rgba(26,77,31,0.02)", borderTop: "1px solid rgba(26,77,31,0.06)" }}
                  dir="rtl"
                >
                  <ShoppingBag size={12} />
                  {t("المنتوجات", "Produits")} — {results!.articles.length}
                </div>
                {results!.articles.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { navigate(`/store/${a.supplierId}`); setFocused(false); setQuery(""); setResults(null); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right"
                    dir="rtl"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ background: "rgba(255,165,0,0.08)" }}
                    >
                      {a.photoUrl
                        ? <img src={a.photoUrl} alt={a.nameAr} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : <ShoppingBag size={18} style={{ color: "rgba(255,165,0,0.6)" }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate" style={{ color: "#1A4D1F", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                        {lang === "ar" ? a.nameAr : a.nameFr || a.nameAr}
                      </p>
                      <p className="text-xs font-bold" style={{ color: "#FFA500" }}>
                        {parseFloat(a.price).toFixed(3)} {t("د.ت", "TND")}
                      </p>
                    </div>
                    <ChevronLeft size={14} style={{ color: "rgba(26,77,31,0.3)" }} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WHY SANAD — لماذا سند؟
// ─────────────────────────────────────────────────────────────────────────────
const WHY_FEATURES = [
  { emoji: "🚀", ar: "توصيل سريع",      fr: "Livraison rapide",    desc_ar: "نوصّل لباب الدار",          desc_fr: "Jusqu'à votre porte",     color: "#FFA500", bg: "rgba(255,165,0,0.10)" },
  { emoji: "🏪", ar: "أفضل المحلات",    fr: "Meilleurs commerces", desc_ar: "محلات موثوقة في بنقردان",   desc_fr: "Commerces locaux vérifiés", color: "#1A4D1F", bg: "rgba(26,77,31,0.08)"  },
  { emoji: "🔐", ar: "آمن وموثوق",      fr: "Sûr & fiable",        desc_ar: "خصوصيتك مكفولة دائماً",    desc_fr: "Votre vie privée protégée", color: "#0369A1", bg: "rgba(3,105,161,0.08)" },
  { emoji: "📍", ar: "100% محلي",       fr: "100% Local",          desc_ar: "نخدم منطقة بنقردان",        desc_fr: "Service à Ben Guerdane",    color: "#7C3AED", bg: "rgba(124,58,237,0.08)"},
  { emoji: "🌍", ar: "ثنائي اللغة",     fr: "Bilingue",            desc_ar: "عربي وفرنسي",               desc_fr: "Arabe et Français",          color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  { emoji: "🕐", ar: "متاح دائماً",     fr: "Disponible 24/7",     desc_ar: "خدمة مستمرة كل يوم",       desc_fr: "Service continu chaque jour", color: "#059669", bg: "rgba(5,150,105,0.08)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRENDING NOW SECTION
// ─────────────────────────────────────────────────────────────────────────────
interface Supplier { id: number; name: string; nameAr: string; category: string; photoUrl?: string; rating?: string; isAvailable: boolean; }
interface TrendProduct { id: number; title: string; imageUrl?: string; salePrice?: string; originalPrice?: string; providerId: number; }

function TrendingSection({ lang, t }: { lang: string; t: (ar: string, fr: string) => string }) {
  const [vendors, setVendors]     = useState<Supplier[]>([]);
  const [products, setProducts]   = useState<TrendProduct[]>([]);

  useEffect(() => {
    get<Supplier[]>("/suppliers")
      .then(d => { if (Array.isArray(d)) setVendors(d.filter(s => s.isAvailable).slice(0, 12)); })
      .catch(() => {});
    get<TrendProduct[]>("/products/deals")
      .then(d => { if (Array.isArray(d)) setProducts(d.slice(0, 12)); })
      .catch(() => {});
  }, []);

  if (vendors.length === 0 && products.length === 0) return null;

  const FONT: React.CSSProperties = { fontFamily: "'Cairo','Tajawal',sans-serif" };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6 px-4 sm:px-6"
    >
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-4" dir="rtl">
        <span className="w-1.5 h-6 rounded-full bg-[#FFA500] block flex-shrink-0" />
        <h2 className="text-xl font-black text-[#1A4D1F]" style={FONT}>
          {t("الأكثر رواجاً", "Tendances")}
        </h2>
        <span className="text-lg select-none">🔥</span>
      </div>

      {/* ── Row 1: Trending Vendors ── */}
      {vendors.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-black text-[#1A4D1F]/50 mb-2 text-right" style={FONT}>
            {t("مزودون مميزون", "Fournisseurs vedettes")}
          </p>
          <div
            className="flex overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", gap: 12 }}
            dir="rtl"
          >
            {vendors.map(v => (
              <Link key={v.id} href={`/store/${v.id}`}>
                <div
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-100"
                  style={{ width: 72, background: "transparent" }}
                >
                  {/* Avatar */}
                  <div
                    className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center"
                    style={{ background: "transparent", border: "1.5px solid rgba(26,77,31,0.12)" }}
                  >
                    {v.photoUrl ? (
                      <img src={v.photoUrl} alt={lang === "ar" ? v.nameAr : v.name} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ fontSize: 26 }}>🏪</span>
                    )}
                  </div>
                  {/* Name */}
                  <p
                    className="text-center leading-tight"
                    style={{ ...FONT, fontSize: 9, fontWeight: 800, color: "#1A4D1F", width: "100%", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {lang === "ar" ? v.nameAr || v.name : v.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 2: Trending Products ── */}
      {products.length > 0 && (
        <div>
          <p className="text-xs font-black text-[#1A4D1F]/50 mb-2 text-right" style={FONT}>
            {t("منتجات رائجة", "Produits tendance")}
          </p>
          <div
            className="flex overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", gap: 10 }}
            dir="rtl"
          >
            {products.map(p => (
              <Link key={p.id} href={`/store/${p.providerId}`}>
                <div
                  className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform duration-100"
                  style={{ width: 80, background: "transparent" }}
                >
                  {/* Image */}
                  <div
                    className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                    style={{ background: "transparent", border: "1.5px solid rgba(26,77,31,0.1)" }}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ fontSize: 28 }}>🛍️</span>
                    )}
                  </div>
                  {/* Title */}
                  <p
                    className="text-center leading-tight"
                    style={{ ...FONT, fontSize: 9, fontWeight: 800, color: "#1A4D1F", width: "100%", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                  >
                    {p.title}
                  </p>
                  {/* Price */}
                  {p.salePrice && (
                    <p style={{ ...FONT, fontSize: 9, fontWeight: 900, color: "#B91C1C" }}>
                      {parseFloat(p.salePrice).toFixed(3)} DT
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function WhySanadSection({ lang, t }: { lang: string; t: (ar: string, fr: string) => string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="px-4 sm:px-6 lg:px-10 mt-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6" dir="rtl">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-6 rounded-full bg-[#FFA500] block" />
          <div>
            <h2 className="text-xl font-black text-[#1A4D1F]">{t("لماذا سند؟", "Pourquoi Sanad ?")}</h2>
            <p className="text-[10px] font-bold text-[#1A4D1F]/40 mt-0.5">{t("سندك في التوصيل.. لباب الدار", "Votre partenaire de livraison")}</p>
          </div>
        </div>
        <span
          className="text-2xl select-none"
          style={{ filter: "drop-shadow(0 2px 6px rgba(255,165,0,0.4))" }}
        >
          🌟
        </span>
      </div>

      {/* Feature cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {WHY_FEATURES.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden"
            style={{
              background: "#FFFFFF",
              border: `1.5px solid ${f.color}22`,
              boxShadow: `0 2px 12px ${f.color}14`,
            }}
          >
            {/* Color accent strip */}
            <div
              style={{
                position: "absolute", top: 0, right: 0, left: 0, height: 3,
                background: f.color, borderRadius: "12px 12px 0 0",
                opacity: 0.75,
              }}
            />
            {/* Icon */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mt-1"
              style={{ background: f.bg }}
            >
              <span style={{ fontSize: 22 }}>{f.emoji}</span>
            </div>
            {/* Text */}
            <div dir={lang === "ar" ? "rtl" : "ltr"}>
              <p
                style={{
                  fontFamily: "'Cairo','Tajawal',sans-serif",
                  fontWeight: 900,
                  fontSize: 13,
                  color: "#1A4D1F",
                  lineHeight: 1.2,
                }}
              >
                {lang === "ar" ? f.ar : f.fr}
              </p>
              <p
                style={{
                  fontFamily: "'Cairo','Tajawal',sans-serif",
                  fontWeight: 500,
                  fontSize: 10,
                  color: "rgba(26,77,31,0.45)",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {lang === "ar" ? f.desc_ar : f.desc_fr}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom slogan */}
      <div
        className="mt-5 rounded-2xl px-5 py-4 flex items-center justify-center gap-3"
        style={{
          background: "linear-gradient(100deg, #1A4D1F 0%, #0D3311 100%)",
          boxShadow: "0 4px 20px rgba(26,77,31,0.25)",
        }}
        dir="rtl"
      >
        <span style={{ fontSize: 20 }}>🤝</span>
        <p
          style={{
            fontFamily: "'Cairo','Tajawal',sans-serif",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: 14,
            color: "#FFA500",
            textAlign: "center",
          }}
        >
          {t("سندك في التوصيل.. لباب الدار", "Votre partenaire de confiance à Ben Guerdane")}
        </p>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED ADS SECTION — إعلانات متقدمة (full-width auto-slideshow)
// ─────────────────────────────────────────────────────────────────────────────
interface AdRow {
  id: number; title: string; imageUrl?: string | null;
  linkUrl?: string | null; isActive: boolean; expiresAt?: string | null;
}

const AD_PALETTES = [
  { bg: "linear-gradient(135deg,#1A4D1F 0%,#2E7D32 60%,#388E3C 100%)", accent: "#FFA500", circle: "rgba(255,165,0,0.18)" },
  { bg: "linear-gradient(135deg,#B45309 0%,#D97706 60%,#F59E0B 100%)", accent: "#fff",     circle: "rgba(255,255,255,0.18)" },
  { bg: "linear-gradient(135deg,#7C3AED 0%,#8B5CF6 60%,#A78BFA 100%)", accent: "#FCD34D", circle: "rgba(252,211,77,0.18)" },
  { bg: "linear-gradient(135deg,#0F766E 0%,#0D9488 60%,#14B8A6 100%)", accent: "#FFF",     circle: "rgba(255,255,255,0.18)" },
  { bg: "linear-gradient(135deg,#BE185D 0%,#EC4899 60%,#F472B6 100%)", accent: "#FCD34D", circle: "rgba(252,211,77,0.18)" },
];

function AdvancedAdsSection({ lang, t }: { lang: string; t: (ar: string, fr: string) => string }) {
  const [ads, setAds]       = useState<AdRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    get<AdRow[]>("/ads")
      .then(data => { setAds(Array.isArray(data) ? data : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % ads.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % ads.length);
    }, 5000);
  };

  const handleClick = (ad: AdRow) => {
    fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
    if (ad.linkUrl) window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
  };

  if (!loaded || ads.length === 0) return null;

  const ad = ads[current];
  const p = AD_PALETTES[current % AD_PALETTES.length];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3 px-4 sm:px-6 lg:px-10" dir="rtl">
        <span className="w-1.5 h-6 rounded-full bg-[#FFA500] block flex-shrink-0" />
        <Megaphone size={16} style={{ color: "#1A4D1F" }} />
        <h2 className="text-base font-black text-[#1A4D1F]">
          {t("إعلانات", "Annonces")}
        </h2>
        <span className="mr-auto text-xs font-bold text-[#1A4D1F]/40">
          {current + 1} / {ads.length}
        </span>
      </div>

      {/* Full-width slide */}
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={ad.id}
            initial={{ opacity: 0, x: lang === "ar" ? -40 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: lang === "ar" ? 40 : -40 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="absolute inset-0 cursor-pointer"
            onClick={() => handleClick(ad)}
            style={{ cursor: ad.linkUrl ? "pointer" : "default" }}
          >
            {ad.imageUrl ? (
              <>
                <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)" }} />
                <div className="absolute bottom-0 inset-x-0 px-5 py-3" dir="rtl">
                  <p className="text-white text-sm font-black line-clamp-2 leading-relaxed" style={{ fontFamily: "'Cairo','Tajawal',sans-serif", textShadow: "0 1px 5px rgba(0,0,0,0.6)" }}>
                    {ad.title}
                  </p>
                  {ad.linkUrl && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[11px] font-black text-[#FFA500]">{lang === "ar" ? "اضغط لمعرفة أكثر" : "Cliquer pour en savoir plus"}</span>
                      <ChevronLeft size={11} className="text-[#FFA500]" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full h-full relative" style={{ background: p.bg }}>
                <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full" style={{ background: p.circle }} />
                <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full" style={{ background: p.circle }} />
                <div className="absolute top-3 right-3 w-12 h-12 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="absolute inset-0 flex flex-col justify-between px-5 py-4" dir="rtl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                      <Megaphone size={14} style={{ color: p.accent }} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: p.accent, opacity: 0.9 }}>
                      {lang === "ar" ? "إعلان" : "Publicité"}
                    </span>
                  </div>
                  <p className="text-white text-lg font-black leading-snug line-clamp-2" style={{ fontFamily: "'Cairo','Tajawal',sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
                    {ad.title}
                  </p>
                  {ad.linkUrl ? (
                    <div className="flex items-center gap-1.5" style={{ color: p.accent }}>
                      <span className="text-xs font-black">{lang === "ar" ? "اضغط لمعرفة أكثر" : "Cliquer pour en savoir plus"}</span>
                      <ChevronLeft size={12} />
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Prev / Next arrows — only when 2+ ads */}
        {ads.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); goTo((current - 1 + ads.length) % ads.length); }}
              className="absolute top-1/2 right-3 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
            >
              <ChevronRight size={16} className="text-white" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); goTo((current + 1) % ads.length); }}
              className="absolute top-1/2 left-3 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
            >
              <ChevronLeft size={16} className="text-white" />
            </button>
          </>
        )}
      </div>

      {/* Dot indicators */}
      {ads.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: i === current ? "#FFA500" : "rgba(26,77,31,0.2)",
              }}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH DEALS BANNER — eye-catching rotating promo panel
// ─────────────────────────────────────────────────────────────────────────────
function PromoMarquee({ lang }: { lang: string }) {
  const [slides, setSlides] = useState<PromoSlide[]>(DEFAULT_SLIDES);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    get<PromoSlide[]>("/banners").then(data => {
      if (Array.isArray(data) && data.length > 0) setSlides(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActive(a => (a + 1) % slides.length);
        setVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[active];

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{
        background: "linear-gradient(100deg, #0D3311 0%, #1A4D1F 45%, #0D3311 100%)",
        borderRadius: 0,
        minHeight: 60,
      }}
    >
      {/* Shimmering animated border top */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 0%, #FFA500 30%, #FFD700 50%, #FFA500 70%, transparent 100%)",
          animation: "marquee-ltr 3s linear infinite",
        }}
      />
      {/* Shimmering animated border bottom */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 0%, #FFA500 30%, #FFD700 50%, #FFA500 70%, transparent 100%)",
          animation: "marquee-ltr 3s linear infinite reverse",
        }}
      />

      <div className="flex items-center h-full px-4 py-2 gap-3" dir={lang === "ar" ? "rtl" : "ltr"}>
        {/* Pulsing badge */}
        <div
          className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: "rgba(255,165,0,0.18)", border: "1px solid rgba(255,165,0,0.35)" }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: "#FFA500",
              animation: "pulse 1.2s ease-in-out infinite",
              boxShadow: "0 0 6px #FFA500",
            }}
          />
          <span
            style={{
              fontFamily: "'Outfit',sans-serif",
              fontWeight: 900,
              fontSize: 10,
              color: "#FFA500",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {lang === "ar" ? "عروض" : "OFFRES"}
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 30, background: "rgba(255,165,0,0.25)", flexShrink: 0 }} />

        {/* Rotating text */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 36 }}>
          <AnimatePresence mode="wait">
            {visible && (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col justify-center"
              >
                <p
                  style={{
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                    fontWeight: 900,
                    fontStyle: "italic",
                    fontSize: 15,
                    color: "#FFA500",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textShadow: "0 1px 8px rgba(255,165,0,0.35)",
                  }}
                >
                  {lang === "ar" ? slide.titleAr : slide.titleFr}
                </p>
                {(slide.subtitleAr || slide.subtitleFr) && (
                  <p
                    style={{
                      fontFamily: "'Cairo','Tajawal',sans-serif",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.55)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {lang === "ar" ? slide.subtitleAr : slide.subtitleFr}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dots indicator */}
        {slides.length > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActive(i); setVisible(true); }}
                style={{
                  width: i === active ? 16 : 5,
                  height: 5,
                  borderRadius: 3,
                  background: i === active ? "#FFA500" : "rgba(255,165,0,0.25)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>
        )}
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
      className="min-h-screen flex flex-col"
      style={{ background: "#ffffff", fontFamily: "'Cairo','Tajawal',sans-serif" }}
      dir="rtl"
    >

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-10 py-1.5 flex items-center justify-between"
        style={{
          background: "rgba(255,255,255,0.95)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          minHeight: 52,
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/home")}
        >
          <img src={appLogo} alt="سند" style={{ height: 46, width: "auto" }} draggable={false} />
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
          FLASH DEALS BANNER — eye-catching rotating promo
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="mt-3">
        <PromoMarquee lang={lang} />
      </div>

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
          1b. LOCATION PICKER — GPS nearby stores
      ══════════════════════════════════════════════════════════════════════ */}
      <LocationPickerBar lang={lang} t={t} />

      {/* ══════════════════════════════════════════════════════════════════════
          2. SERVICES
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="mt-4 relative overflow-hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-2 px-4 sm:px-6"
          dir="rtl"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 rounded-full bg-[#FFA500] block flex-shrink-0" />
            <h2 className="text-xl font-black text-[#1A4D1F]">{t("خدماتنا", "Nos Services")}</h2>
          </div>
          <Link href="/services">
            <span className="text-xs font-black text-[#FFA500] border border-[#FFA500]/30 px-3 py-1.5 rounded-full">
              {t("الكل", "Tout")} ←
            </span>
          </Link>
        </motion.div>

        {/* ── Services Marquee ── */}
        <ServicesMarquee lang={lang} />
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          3. SEARCH BAR — full width between services and orders
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-10 mt-4">
        {/* Label row */}
        <div className="flex items-center gap-2 mb-2" dir="rtl">
          <span className="w-1 h-5 rounded-full bg-[#FFA500] block" />
          <Search size={13} style={{ color: "#FFA500" }} />
          <span
            className="text-xs font-black"
            style={{ color: "#1A4D1F", opacity: 0.65, fontFamily: "'Cairo','Tajawal',sans-serif" }}
          >
            {t("ابحث في سند", "Rechercher dans Sanad")}
          </span>
        </div>
        <HomeSearchBar lang={lang} t={t} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3b. TRENDING NOW — الأكثر رواجاً
      ══════════════════════════════════════════════════════════════════════ */}
      <TrendingSection lang={lang} t={t} />

      {/* ══════════════════════════════════════════════════════════════════════
          3c. ADVANCED ADS — إعلانات متقدمة
      ══════════════════════════════════════════════════════════════════════ */}
      <AdvancedAdsSection lang={lang} t={t} />

      {/* ══════════════════════════════════════════════════════════════════════
          3c. WHY SANAD — لماذا سند؟
      ══════════════════════════════════════════════════════════════════════ */}
      <WhySanadSection lang={lang} t={t} />

      {/* ── PROFESSIONAL FOOTER ── */}
      <footer
        className="mt-10 w-full px-5 py-7"
        style={{ background: "#064e3b" }}
        dir="rtl"
      >
        {/* Logo line */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <span style={{ color: "#eab308", fontSize: 22, fontWeight: 900, fontFamily: "'Cairo','Tajawal',sans-serif", letterSpacing: 1 }}>
            سند · Sanad
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(234,179,8,0.25)", marginBottom: 18 }} />

        {/* Admin team */}
        <div className="mb-4">
          <p style={{ color: "#eab308", fontSize: 11, fontWeight: 300, fontFamily: "'Cairo','Tajawal',sans-serif", marginBottom: 6, opacity: 0.8 }}>
            {t("للانضمام لفريقنا الإداري:", "Pour rejoindre notre équipe administrative :")}
          </p>
          <div className="flex flex-col gap-1.5 pr-2">
            <span className="flex items-center gap-2" dir="ltr">
              <Phone size={11} style={{ color: "#eab308", opacity: 0.7, flexShrink: 0 }} />
              <span style={{ color: "#eab308", fontSize: 12, fontWeight: 300, letterSpacing: 0.5 }}>53 604 284</span>
            </span>
            <span className="flex items-center gap-2" dir="ltr">
              <span style={{ color: "#eab308", fontSize: 11, opacity: 0.7, flexShrink: 0 }}>✉</span>
              <span style={{ color: "#eab308", fontSize: 11, fontWeight: 300, letterSpacing: 0.3 }}>Sanad.administration@gmail.com</span>
            </span>
          </div>
        </div>

        {/* Tech team */}
        <div className="mb-5">
          <p style={{ color: "#eab308", fontSize: 11, fontWeight: 300, fontFamily: "'Cairo','Tajawal',sans-serif", marginBottom: 6, opacity: 0.8 }}>
            {t("للانضمام لفريقنا التقني:", "Pour rejoindre notre équipe technique :")}
          </p>
          <div className="flex flex-col gap-1.5 pr-2">
            <span className="flex items-center gap-2" dir="ltr">
              <Phone size={11} style={{ color: "#eab308", opacity: 0.7, flexShrink: 0 }} />
              <span style={{ color: "#eab308", fontSize: 12, fontWeight: 300, letterSpacing: 0.5 }}>27 777 589</span>
            </span>
            <span className="flex items-center gap-2" dir="ltr">
              <span style={{ color: "#eab308", fontSize: 11, opacity: 0.7, flexShrink: 0 }}>✉</span>
              <span style={{ color: "#eab308", fontSize: 11, fontWeight: 300, letterSpacing: 0.3 }}>Sanad.technique@gmail.com</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(234,179,8,0.2)", marginBottom: 14 }} />

        {/* App links */}
        <div className="flex gap-3 mb-5 justify-center">
          <Link href="/admin">
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl"
              style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)" }}
            >
              <Store size={12} style={{ color: "#eab308" }} />
              <span style={{ color: "#eab308", fontSize: 11, fontWeight: 400, fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                {t("لوحة الإدارة", "Administration")}
              </span>
            </button>
          </Link>
          <Link href="/delivery">
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl"
              style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)" }}
            >
              <Truck size={12} style={{ color: "#eab308" }} />
              <span style={{ color: "#eab308", fontSize: 11, fontWeight: 400, fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                {t("تطبيق السائق", "Livreur")}
              </span>
            </button>
          </Link>
        </div>

        {/* Copyright */}
        <p
          className="text-center"
          style={{ color: "rgba(234,179,8,0.5)", fontSize: 10, fontWeight: 300, fontFamily: "'Cairo','Tajawal',sans-serif", letterSpacing: 0.5 }}
        >
          سند · sanad &amp; جميع الحقوق محفوظة 2026
        </p>
      </footer>

    </div>
  );
}
