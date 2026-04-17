import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Percent, Tag, ArrowRight, RefreshCw, Search, X,
  Store, MapPin, Navigation, RotateCcw, ChevronDown,
  Package, Sparkles, ShoppingBag, Globe,
} from "lucide-react";
import { get } from "@/lib/admin-api";
import { useLang } from "@/lib/language";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DealProduct {
  id:            number;
  providerId:    number;
  title:         string;
  titleFr?:      string;
  description?:  string;
  imageUrl?:     string;
  category?:     string;
  supplierName?: string;
  originalPrice?: string;
  salePrice?:    string;
  delegationAr?: string;
  providerLat?:  number | null;
  providerLng?:  number | null;
  isAvailable:   boolean;
  createdAt:     string;
  isFallback?:   boolean;
  // computed client-side
  _distKm?: number;
}

// ── GPS storage keys (same as order.tsx) ──────────────────────────────────────
const GPS_STORE_KEY = "sanad_gps_v2";
const SAVED_LOC_KEY = "sanad_location_v1";
const GPS_ACCURACY_THRESHOLD_M = 2000;

interface GpsState {
  lat?: number; lng?: number;
  delegation?: string; governorate?: string; gov_fr?: string;
  accuracy?: number; _ts?: number;
}

function readGpsStore(): GpsState | null {
  // 1. sessionStorage (home.tsx GPS store — most up-to-date)
  try {
    const raw = sessionStorage.getItem(GPS_STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as GpsState;
      const accuracyOk = typeof p.accuracy === "number" && p.accuracy < GPS_ACCURACY_THRESHOLD_M;
      const fresh = !p._ts || (Date.now() - p._ts) < 3 * 60 * 1000;
      if (accuracyOk && fresh && p.delegation) return p;
    }
  } catch { /* ignore */ }
  // 2. localStorage permanent pick
  try {
    const raw = localStorage.getItem(SAVED_LOC_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { lat: number; lng: number; source: string; accuracy?: number; savedAt?: number; delegation?: string };
      if (p.source === "manual") return { lat: p.lat, lng: p.lng, delegation: p.delegation };
      const ageOk = !p.savedAt || (Date.now() - p.savedAt) < 6 * 60 * 60 * 1000;
      const accOk = typeof p.accuracy === "number" && p.accuracy < GPS_ACCURACY_THRESHOLD_M;
      if (ageOk && accOk) return { lat: p.lat, lng: p.lng, delegation: p.delegation };
    }
  } catch { /* ignore */ }
  return null;
}

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Category labels ───────────────────────────────────────────────────────────
const CAT_AR: Record<string, string> = {
  restaurant: "مطعم", grocery: "بقالة", pharmacy: "صيدلية",
  bakery: "مخبزة", butcher: "قصاب", cafe: "مقهى", sweets: "حلويات",
  hotel: "فندق", car_rental: "كراء سيارات", sos: "SOS", lawyer: "محامي",
  clothing: "ملابس", vegetables: "خضر وغلال", doctor: "طبيب",
};
const CAT_FR: Record<string, string> = {
  restaurant: "Restaurant", grocery: "Épicerie", pharmacy: "Pharmacie",
  bakery: "Boulangerie", butcher: "Boucherie", cafe: "Café", sweets: "Pâtisserie",
  hotel: "Hôtel", car_rental: "Location auto", sos: "SOS", lawyer: "Avocat",
  clothing: "Vêtements", vegetables: "Légumes", doctor: "Médecin",
};

function discountPct(orig?: string, sale?: string): number {
  const o = parseFloat(orig ?? "0"), s = parseFloat(sale ?? "0");
  if (!o || !s) return 0;
  return Math.round(((o - s) / o) * 100);
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ p, t, lang, userLat, userLng }: {
  p: DealProduct;
  t: (ar: string, fr: string) => string;
  lang: string;
  userLat?: number;
  userLng?: number;
}) {
  const [, navigate] = useLocation();
  const pct      = discountPct(p.originalPrice, p.salePrice);
  const catLabel = p.category
    ? (lang === "ar" ? (CAT_AR[p.category] ?? p.category) : (CAT_FR[p.category] ?? p.category))
    : null;
  const distKm = (userLat && userLng && p.providerLat && p.providerLng)
    ? haversineKm(userLat, userLng, p.providerLat, p.providerLng)
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => p.providerId && navigate(`/store/${p.providerId}`)}
      className="rounded-2xl border overflow-hidden flex flex-col cursor-pointer active:scale-95 transition-transform"
      style={{ background: p.isFallback ? "#f8faff" : "#f0fdf4", borderColor: p.isFallback ? "rgba(99,102,241,0.12)" : "rgba(46,125,50,0.12)" }}
    >
      {/* Image */}
      <div className="flex flex-col items-center pt-3 pb-1 px-2"
        style={{ background: p.isFallback ? "#e0e7ff" : "#dcfce7" }}>
        <div className="relative">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-white/40 flex items-center justify-center">
            {p.imageUrl
              ? <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
              : <Package size={22} className="text-[#1A4D1F]/20" />}
          </div>
          {pct > 0 && (
            <div className="absolute -top-0.5 -end-0.5 bg-red-500 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
              -{pct}%
            </div>
          )}
          {p.isFallback && (
            <div className="absolute -bottom-0.5 -end-0.5 bg-indigo-500 text-white text-[7px] font-black px-1 py-px rounded-full shadow-sm whitespace-nowrap">
              {t("جديد","Nouveau")}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col flex-1 gap-0.5" dir="rtl">
        <p className="font-black text-xs text-[#1A4D1F] text-center leading-tight line-clamp-2">{p.title}</p>
        {p.supplierName && (
          <span className="inline-flex items-center justify-center gap-0.5 text-[8px] font-bold text-[#1A4D1F]/45">
            <Store size={7} />{p.supplierName}
          </span>
        )}
        {catLabel && (
          <span className="text-center text-[7px] font-bold text-[#1A4D1F]/30">{catLabel}</span>
        )}

        {/* Distance badge */}
        {distKm !== null && (
          <span className="inline-flex items-center justify-center gap-0.5 text-[8px] font-black text-[#1A4D1F]/50 mt-0.5">
            <Navigation size={7} />
            {distKm < 1 ? `${Math.round(distKm * 1000)} م` : `${distKm.toFixed(1)} km`}
          </span>
        )}

        {/* Prices */}
        <div className="flex flex-col items-center mt-auto pt-0.5">
          {p.salePrice && (
            <span className="text-sm font-black text-red-600">
              {parseFloat(p.salePrice).toFixed(3)} <span className="text-[9px]">TND</span>
            </span>
          )}
          {p.originalPrice && (
            <span className="text-[9px] font-bold line-through text-[#1A4D1F]/30">
              {parseFloat(p.originalPrice).toFixed(3)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Delegation Picker Dropdown ────────────────────────────────────────────────
function DelegationPicker({
  delegations, selected, onSelect, t, isRTL,
}: {
  delegations: string[];
  selected: string | null;
  onSelect: (d: string | null) => void;
  t: (ar: string, fr: string) => string;
  isRTL: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = selected ?? t("كل المناطق", "Toutes les zones");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all"
        style={{
          borderColor: selected ? "#1A4D1F" : "rgba(26,77,31,0.2)",
          color:       selected ? "#1A4D1F" : "#1A4D1F",
          background:  selected ? "rgba(26,77,31,0.06)" : "transparent",
        }}
      >
        <Globe size={12} />
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-1 z-40 bg-white rounded-2xl border border-[#1A4D1F]/15 shadow-2xl overflow-hidden min-w-[180px]"
              style={{ [isRTL ? "right" : "left"]: 0 }}
            >
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-xs font-black transition-colors text-right",
                  !selected ? "bg-[#1A4D1F] text-white" : "hover:bg-[#1A4D1F]/5 text-[#1A4D1F]",
                )}
              >
                <Globe size={12} />
                {t("كل المناطق", "Toutes les zones")}
              </button>
              <div className="border-t border-[#1A4D1F]/8" />
              {delegations.map(d => (
                <button
                  key={d}
                  onClick={() => { onSelect(d); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-xs font-black transition-colors",
                    selected === d ? "bg-[#1A4D1F] text-white" : "hover:bg-[#1A4D1F]/5 text-[#1A4D1F]",
                  )}
                >
                  <MapPin size={12} />
                  {d}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Deals() {
  const { lang, t, isRTL } = useLang();
  const [, navigate] = useLocation();

  // ── GPS state ──────────────────────────────────────────────────────────────
  const gps = useMemo(() => readGpsStore(), []);
  const userLat = gps?.lat;
  const userLng = gps?.lng;
  const autoZone = gps?.delegation ?? null; // e.g. "بن قردان"

  // ── Zone selection ─────────────────────────────────────────────────────────
  // null = show all zones;  string = a specific delegation
  const [selectedZone, setSelectedZone] = useState<string | null>(autoZone);
  const [isManual, setIsManual]         = useState(false);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [products, setProducts]     = useState<DealProduct[]>([]);
  const [allZoneList, setAllZoneList] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("all");

  // Fetch deals for the current zone filter (or all zones)
  const loadDeals = useCallback(async (zone: string | null, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (zone) params.set("delegation", zone);
      const data = await get<DealProduct[]>(`/products/deals?${params}`);
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Separately fetch all zones once (for the picker dropdown)
  useEffect(() => {
    get<DealProduct[]>("/products/deals?fallback=none")
      .then(data => {
        if (!Array.isArray(data)) return;
        const zones = [...new Set(
          data.map(p => p.delegationAr).filter(Boolean) as string[]
        )].sort();
        setAllZoneList(zones);
      })
      .catch(() => {});
  }, []);

  // Initial load
  useEffect(() => { loadDeals(selectedZone); }, []);  // eslint-disable-line

  // Reload when zone changes
  const handleZoneChange = (zone: string | null) => {
    setSelectedZone(zone);
    setIsManual(zone !== autoZone);
    loadDeals(zone);
  };

  const handleResetToMyLocation = () => {
    setSelectedZone(autoZone);
    setIsManual(false);
    loadDeals(autoZone);
  };

  // ── Sorting & filtering ────────────────────────────────────────────────────
  const categories = useMemo(() =>
    ["all", ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))],
    [products],
  );

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = products.filter(p => {
      const matchSearch = !q || p.title.toLowerCase().includes(q);
      const matchCat    = catFilter === "all" || p.category === catFilter;
      return matchSearch && matchCat;
    });

    return [...filtered].sort((a, b) => {
      // Primary: distance from user (if GPS available and provider has coords)
      if (userLat && userLng) {
        const dA = (a.providerLat && a.providerLng)
          ? haversineKm(userLat, userLng, a.providerLat, a.providerLng) : 9999;
        const dB = (b.providerLat && b.providerLng)
          ? haversineKm(userLat, userLng, b.providerLat, b.providerLng) : 9999;
        if (Math.abs(dA - dB) > 0.3) return dA - dB; // significant diff → sort by distance
      }
      // Secondary: discount % descending (bigger discount first)
      const pA = discountPct(a.originalPrice, a.salePrice);
      const pB = discountPct(b.originalPrice, b.salePrice);
      return pB - pA;
    });
  }, [products, search, catFilter, userLat, userLng]);

  const totalSaved = useMemo(() =>
    products.reduce((sum, p) => {
      const o = parseFloat(p.originalPrice ?? "0"), s = parseFloat(p.salePrice ?? "0");
      return sum + Math.max(0, o - s);
    }, 0),
    [products],
  );

  const dealCount   = products.filter(p => !p.isFallback).length;
  const hasFallback = products.some(p => p.isFallback) && dealCount === 0;

  // ── Zone display label ─────────────────────────────────────────────────────
  const zoneLabel = selectedZone
    ? (isManual
        ? t(`عروض في: ${selectedZone}`, `Offres à : ${selectedZone}`)
        : t(`عروض بالقرب منك في: ${selectedZone}`, `Offres près de vous à : ${selectedZone}`))
    : t("عروض من جميع المناطق", "Offres de toutes les zones");

  const zoneSubLabel = selectedZone
    ? (isManual
        ? t("موقع يدوي مختار", "Sélection manuelle")
        : t("موقعك الحالي · GPS", "Votre position · GPS"))
    : t("عرض شامل — اختر منطقة للتصفية", "Vue globale — filtrez par zone");

  return (
    <div className="min-h-screen bg-white" dir="rtl" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-4 py-3 border-b"
        style={{ background: "rgba(255,255,255,0.97)", borderColor: "rgba(46,125,50,0.08)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <button
            onClick={() => navigate("/home")}
            className="p-2 rounded-xl text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:bg-[#1A4D1F]/8 transition-all"
          >
            <ArrowRight size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-[#1A4D1F] flex items-center gap-2">
              <Percent size={15} className="text-red-500" />
              {t("منتجات في التخفيض", "Produits en promotion")}
            </h1>
          </div>
          <button
            onClick={() => loadDeals(selectedZone, true)}
            disabled={refreshing}
            className="p-2 rounded-xl text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-all"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* ── Zone bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Location context badge */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(26,77,31,0.05)" }}>
            <MapPin size={11} className={isManual ? "text-[#FFA500]" : "text-[#1A4D1F]"} />
            <div className="min-w-0">
              <p className="text-[10px] font-black text-[#1A4D1F] truncate leading-tight">{zoneLabel}</p>
              <p className="text-[9px] font-medium text-[#1A4D1F]/40 truncate leading-tight">{zoneSubLabel}</p>
            </div>
          </div>

          {/* Manual zone picker */}
          <DelegationPicker
            delegations={allZoneList}
            selected={selectedZone}
            onSelect={handleZoneChange}
            t={t}
            isRTL={isRTL}
          />

          {/* Reset to GPS button (only visible in manual mode) */}
          {isManual && autoZone && (
            <button
              onClick={handleResetToMyLocation}
              title={t("العودة لموقعي", "Retour à ma position")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all"
              style={{ background: "rgba(255,165,0,0.1)", color: "#b45309" }}
            >
              <RotateCcw size={11} />
              {t("موقعي", "GPS")}
            </button>
          )}
        </div>
      </header>

      {/* ── Summary banner ─────────────────────────────────────────────────── */}
      {!loading && products.length > 0 && (
        <motion.div
          key={selectedZone ?? "all"}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, #1A4D1F 0%, #0D3311 100%)" }}
        >
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-[#FFA500]" />
          </div>
          <div className="flex-1 min-w-0">
            {hasFallback ? (
              <>
                <p className="text-white font-black text-sm">
                  {t("لا توجد عروض حالياً في منطقتك", "Pas de promotions dans votre zone")}
                </p>
                <p className="text-white/60 text-[10px] font-bold mt-0.5">
                  {t("نعرض أحدث المنتجات المتاحة بدلاً منها", "Affichage des derniers articles disponibles")}
                </p>
              </>
            ) : (
              <>
                <p className="text-white font-black text-sm">
                  {dealCount} {t("عرض تخفيض", "promotion(s)")}
                  {selectedZone ? ` · ${selectedZone}` : ""}
                </p>
                {totalSaved > 0 && (
                  <p className="text-white/60 text-[10px] font-bold mt-0.5">
                    {t("وفّر حتى", "Économisez jusqu'à")} {totalSaved.toFixed(3)} TND
                    {userLat && userLng && t(" · مرتب حسب المسافة", " · Trié par distance")}
                  </p>
                )}
              </>
            )}
          </div>
          <Tag size={18} className="text-[#FFA500] flex-shrink-0" />
        </motion.div>
      )}

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-3">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A4D1F]/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("ابحث عن منتج...", "Rechercher un produit...")}
            className="w-full pr-8 pl-8 py-2.5 rounded-xl border text-sm font-bold text-[#1A4D1F] bg-white outline-none focus:border-[#1A4D1F]/40 transition-colors"
            style={{ borderColor: "rgba(46,125,50,0.2)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X size={13} className="text-[#1A4D1F]/30" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category chips ──────────────────────────────────────────────────── */}
      {categories.length > 1 && (
        <div className="px-4 mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black transition-all",
                catFilter === c
                  ? "text-white shadow-sm"
                  : "text-[#1A4D1F]/50 border border-[#1A4D1F]/15 hover:border-[#1A4D1F]/40",
              )}
              style={catFilter === c ? { background: "#1A4D1F" } : {}}
            >
              {c === "all"
                ? t("الكل", "Tout")
                : (lang === "ar" ? (CAT_AR[c] ?? c) : (CAT_FR[c] ?? c))}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="px-4 mt-3 pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw size={24} className="animate-spin text-[#1A4D1F]/30" />
            <p className="text-sm font-bold text-[#1A4D1F]/30">{t("جارٍ التحميل...", "Chargement...")}</p>
          </div>
        ) : sorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="w-20 h-20 rounded-full bg-[#1A4D1F]/5 flex items-center justify-center">
              <ShoppingBag size={32} className="text-[#1A4D1F]/20" />
            </div>
            <div className="text-center">
              <p className="font-black text-[#1A4D1F]/40 text-base">
                {search || catFilter !== "all"
                  ? t("لا توجد نتائج مطابقة", "Aucun résultat")
                  : t("لا توجد عروض في هذه المنطقة", "Aucune promotion dans cette zone")}
              </p>
              <p className="text-xs text-[#1A4D1F]/25 mt-1 font-bold">
                {t("جرّب منطقة أخرى أو تحقق لاحقاً", "Essayez une autre zone ou revenez plus tard")}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              {(search || catFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setCatFilter("all"); }}
                  className="px-4 py-2 rounded-xl text-xs font-black text-[#1A4D1F] border border-[#1A4D1F]/20 hover:bg-[#1A4D1F]/5 transition-all"
                >
                  {t("مسح الفلاتر", "Effacer les filtres")}
                </button>
              )}
              {selectedZone && (
                <button
                  onClick={() => handleZoneChange(null)}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white"
                  style={{ background: "#1A4D1F" }}
                >
                  <Globe size={11} className="inline me-1" />
                  {t("عرض كل المناطق", "Voir toutes les zones")}
                </button>
              )}
              {isManual && autoZone && (
                <button
                  onClick={handleResetToMyLocation}
                  className="px-4 py-2 rounded-xl text-xs font-black border"
                  style={{ borderColor: "#FFA500", color: "#b45309" }}
                >
                  <RotateCcw size={11} className="inline me-1" />
                  {t("العودة لموقعي", "Retour à ma position")}
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Section heading: deals vs fallback */}
            {hasFallback && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-indigo-100" />
                <span className="text-[10px] font-black text-indigo-400 flex items-center gap-1">
                  <Sparkles size={9} /> {t("أحدث المنتجات المتاحة", "Derniers articles disponibles")}
                </span>
                <div className="flex-1 h-px bg-indigo-100" />
              </div>
            )}
            {!hasFallback && userLat && userLng && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-[#1A4D1F]/8" />
                <span className="text-[10px] font-black text-[#1A4D1F]/35 flex items-center gap-1">
                  <Navigation size={9} /> {t("مرتب حسب المسافة", "Trié par distance")}
                </span>
                <div className="flex-1 h-px bg-[#1A4D1F]/8" />
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              <AnimatePresence>
                {sorted.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <ProductCard p={p} t={t} lang={lang} userLat={userLat} userLng={userLng} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
