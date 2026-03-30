import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { SanadBrand } from "@/components/sanad-brand";
import { AdBanner } from "@/components/ad-banner";
import { useLang } from "@/lib/language";
import { getSession, clearSession } from "@/lib/auth";
import { get } from "@/lib/admin-api";
import {
  Utensils, Pill, Scale, ShoppingCart, Wrench, Stethoscope,
  Car, Hotel, LogIn, UserCircle, ChevronLeft, ChevronRight,
  MapPin, Truck, Eye, Grid, LogOut, Clock, CheckCircle, XCircle,
  Package, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Bike,
  Percent, Tag,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function getRoleBadge(role: string) {
  const map: Record<string, { ar: string; fr: string; bg: string; border: string }> = {
    super_admin: { ar: "مدير النظام", fr: "Super Admin",  bg: "#B91C1C", border: "#991B1B" },
    admin:       { ar: "مدير النظام", fr: "Admin",        bg: "#B91C1C", border: "#991B1B" },
    manager:     { ar: "مدير النظام", fr: "Gestionnaire", bg: "#B91C1C", border: "#991B1B" },
    provider:    { ar: "مزود",        fr: "Fournisseur",  bg: "#2E7D32", border: "#1B5E20" },
    delivery:    { ar: "سائق/موزع",   fr: "Livreur",      bg: "#1565C0", border: "#0D47A1" },
    driver:      { ar: "سائق/موزع",   fr: "Livreur",      bg: "#1565C0", border: "#0D47A1" },
    client:      { ar: "عميل",        fr: "Client",       bg: "#388E3C", border: "#2E7D32" },
  };
  return map[role] ?? map.client;
}

// ─────────────────────────────────────────────────────────────────────────────
// PANORAMIC PROMO SLIDES
// ─────────────────────────────────────────────────────────────────────────────
const PROMO_SLIDES = [
  {
    id: 1,
    imageUrl: "",
    titleAr: "عروض رمضان الحصرية",
    titleFr: "Offres exclusives Ramadan",
    subtitleAr: "أفضل العروض من مطاعم ومحلات بن قردان",
    subtitleFr: "Les meilleures offres des restaurants de Ben Guerdane",
    bgFrom: "#2E7D32",
    bgTo: "#1B5E20",
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

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "restaurant", icon: Utensils,     ar: "مطاعم",    fr: "Restaurants" },
  { id: "pharmacy",   icon: Pill,         ar: "صيدلية",   fr: "Pharmacie"   },
  { id: "lawyer",     icon: Scale,        ar: "محامي",    fr: "Avocat"      },
  { id: "grocery",    icon: ShoppingCart, ar: "بقالة",    fr: "Épicerie"    },
  { id: "mechanic",   icon: Wrench,       ar: "ميكانيكي", fr: "Mécanicien"  },
  { id: "doctor",     icon: Stethoscope,  ar: "طبيب",     fr: "Médecin"     },
  { id: "car",        icon: Car,          ar: "سيارات",   fr: "Voitures"    },
  { id: "hotel",      icon: Hotel,        ar: "فنادق",    fr: "Hôtels"      },
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
          <p className="font-black text-sm text-[#2E7D32] truncate">
            {order.serviceProviderName}
          </p>
          <p className="text-[10px] font-bold text-[#2E7D32]/50 truncate">
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
          <span className="text-[10px] font-black text-[#2E7D32]/30">#{order.id}</span>
          {expanded
            ? <ChevronUp size={14} className="text-[#2E7D32]/30" />
            : <ChevronDown size={14} className="text-[#2E7D32]/30" />
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
                    <MapPin size={12} className="text-[#2E7D32]/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-[#2E7D32]/40">{t("العنوان","Adresse")}</p>
                      <p className="text-xs font-black text-[#2E7D32]/70">{order.customerAddress}</p>
                    </div>
                  </div>
                )}
                {order.deliveryFee !== undefined && (
                  <div className="flex items-start gap-1.5">
                    <Truck size={12} className="text-[#2E7D32]/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-[#2E7D32]/40">{t("رسوم التوصيل","Livraison")}</p>
                      <p className="text-xs font-black text-[#2E7D32]/70">{order.deliveryFee} TND</p>
                    </div>
                  </div>
                )}
              </div>
              {order.notes && (
                <div className="flex items-start gap-1.5">
                  <Package size={12} className="text-[#2E7D32]/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold text-[#2E7D32]/40">{t("ملاحظات","Notes")}</p>
                    <p className="text-xs font-black text-[#2E7D32]/70">{order.notes}</p>
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
        <RefreshCw size={20} className="animate-spin text-[#2E7D32]/40" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8" dir="rtl">
        <ShoppingCart size={32} className="mx-auto mb-2 text-[#2E7D32]/20" />
        <p className="text-sm font-black text-[#2E7D32]/30">
          {t("لا توجد طلبات بعد", "Aucune commande pour l'instant")}
        </p>
        <p className="text-xs text-[#2E7D32]/20 mt-1">
          {t("ستظهر طلباتك هنا بمجرد إرسالها", "Vos commandes apparaîtront ici")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#2E7D32]/40">
          {orders.length} {t("طلب", "commande(s)")}
        </span>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs font-bold text-[#2E7D32]/50 hover:text-[#2E7D32] transition-all"
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
            <Clock size={12} className="text-[#2E7D32]/40" />
            <span className="text-xs font-black text-[#2E7D32]/50">
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
              className="w-full mt-2 py-2 rounded-xl text-xs font-black text-[#2E7D32]/50 hover:text-[#2E7D32] border border-[#2E7D32]/10 hover:border-[#2E7D32]/30 transition-all"
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(i => (i + 1) % PROMO_SLIDES.length);
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const slide = PROMO_SLIDES[active];

  const goTo = (idx: number) => {
    setActive(idx);
    resetTimer();
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg"
      style={{ aspectRatio: "21/9", minHeight: 140, maxHeight: 320 }}>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center px-8 sm:px-14"
          style={{
            background: `linear-gradient(135deg, ${slide.bgFrom} 0%, ${slide.bgTo} 100%)`,
          }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.25) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)",
            }} />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full opacity-15"
            style={{ background: slide.accent }} />
          <div className="relative z-10 text-center" dir="rtl">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-bold mb-1 opacity-80"
              style={{ color: slide.accent, fontFamily: "'Cairo','Tajawal',sans-serif" }}
            >
              {lang === "ar" ? slide.subtitleAr : slide.subtitleFr}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-black text-white leading-snug"
              style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
            >
              {lang === "ar" ? slide.titleAr : slide.titleFr}
            </motion.h2>
          </div>
        </motion.div>
      </AnimatePresence>

      <button
        onClick={() => goTo((active - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/35 transition-all"
        aria-label="Previous"
      >
        <ChevronRight size={16} className="text-white" />
      </button>
      <button
        onClick={() => goTo((active + 1) % PROMO_SLIDES.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/35 transition-all"
        aria-label="Next"
      >
        <ChevronLeft size={16} className="text-white" />
      </button>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {PROMO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === active ? 20 : 8,
              height: 8,
              background: i === active ? "#2E7D32" : "rgba(255,255,255,0.5)",
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
          <span style={{ fontSize: "1.65rem", fontWeight: 900, lineHeight: 1 }}>
            <SanadBrand color="#2E7D32" innerColor="#FFF3E0" />
          </span>
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
                  <span className="text-xs font-black leading-tight" style={{ color: "#2E7D32" }}>
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
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#2E7D32]/20"
                style={{ background: "rgba(46,125,50,0.05)" }}>
                <UserCircle size={14} className="text-[#2E7D32]/40" />
                <span className="text-xs font-bold text-[#2E7D32]/50">{t("زائر", "Visiteur")}</span>
              </div>
              {/* Login button */}
              <button
                onClick={() => navigate("/auth")}
                className="flex items-center gap-2 px-4 py-2 rounded-full font-black text-sm text-white transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: "#2E7D32",
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
          2. SERVICES GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-10 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-5 text-right"
        >
          <h2 className="text-xl font-black text-[#2E7D32]">
            {t("خدماتنا", "Nos Services")}
          </h2>
          <p className="text-sm font-medium" style={{ color: "rgba(46,125,50,0.5)" }}>
            {t("اختر الخدمة المناسبة", "Choisissez votre service")}
          </p>
        </motion.div>

        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
          {CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            const label = lang === "ar" ? cat.ar : cat.fr;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 280, damping: 22 }}
              >
                <Link href={`/services?category=${cat.id}`}>
                  <div className="flex flex-col items-center text-center gap-2 cursor-pointer group">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                      style={{
                        border: "2.5px solid rgba(46,125,50,0.65)",
                        background: "rgba(46,125,50,0.06)",
                      }}
                    >
                      <Icon size={24} style={{ color: "#2E7D32" }} />
                    </div>
                    <p className="font-black text-[11px] leading-snug" style={{ color: "#2E7D32" }}>
                      {label}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
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
              <h2 className="text-lg font-black text-[#2E7D32]">
                {t("طلباتي", "Mes commandes")}
              </h2>
              <p className="text-xs font-bold text-[#2E7D32]/40">
                {t("جميع طلباتك من كل المزودين", "Toutes vos commandes")}
              </p>
            </div>
            <Link href="/services">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90"
                style={{ background: "#2E7D32" }}
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
          <MapPin size={18} style={{ color: "#2E7D32", flexShrink: 0 }} />
          <div className="flex-1 h-px" style={{ background: "rgba(46,125,50,0.18)" }} />
        </div>

        <h2
          className="text-2xl font-black text-center mb-8"
          style={{ color: "#2E7D32", fontFamily: "'Cairo','Tajawal',sans-serif" }}
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
                style={{ background: "#2E7D32" }}>
                <Icon size={18} className="text-white" />
              </div>
              <p className="font-black text-base mb-1" style={{ color: "#2E7D32", fontFamily: "'Cairo','Tajawal',sans-serif" }} dir="rtl">
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
          GLOBAL AD BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-10 mt-8">
        <AdBanner />
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
          جميع الحقوق محفوظة © سند · Sanad — بن قردان
        </p>
        <p className="text-xs mt-1" style={{ color: "rgba(46,125,50,0.4)", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          📞 27 777 589
        </p>
      </footer>

    </div>
  );
}
