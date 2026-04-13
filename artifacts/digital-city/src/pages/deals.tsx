import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Percent, Tag, ArrowRight, RefreshCw, Search, X,
  Store, Star, ShoppingBag,
  Package, Sparkles,
} from "lucide-react";
import { get } from "@/lib/admin-api";
import { useLang } from "@/lib/language";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DealProduct {
  id: number;
  providerId: number;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  supplierName?: string;
  originalPrice?: string;
  salePrice?: string;
  isAvailable: boolean;
  createdAt: string;
}

// Category labels for display
const CAT_AR: Record<string, string> = {
  restaurant: "مطعم", grocery: "بقالة", pharmacy: "صيدلية",
  bakery: "مخبزة", butcher: "ملّاح", cafe: "مقهى", sweets: "حلويات",
  hotel: "فندق", car_rental: "كراء سيارات", sos: "SOS", lawyer: "محامي",
};
const CAT_FR: Record<string, string> = {
  restaurant: "Restaurant", grocery: "Épicerie", pharmacy: "Pharmacie",
  bakery: "Boulangerie", butcher: "Boucherie", cafe: "Café", sweets: "Pâtisserie",
  hotel: "Hôtel", car_rental: "Location auto", sos: "SOS", lawyer: "Avocat",
};

// ── Price helpers ─────────────────────────────────────────────────────────────
function discountPct(orig: string, sale: string) {
  const o = parseFloat(orig), s = parseFloat(sale);
  if (!o || !s) return 0;
  return Math.round(((o - s) / o) * 100);
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ p, t, lang }: { p: DealProduct; t: (ar: string, fr: string) => string; lang: string }) {
  const [, navigate] = useLocation();
  const pct = discountPct(p.originalPrice ?? "0", p.salePrice ?? "0");
  const catLabel = p.category
    ? (lang === "ar" ? (CAT_AR[p.category] ?? p.category) : (CAT_FR[p.category] ?? p.category))
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => p.providerId && navigate(`/store/${p.providerId}`)}
      className="rounded-2xl border overflow-hidden flex flex-col cursor-pointer"
      style={{ background: "#f0fdf4", borderColor: "rgba(46,125,50,0.12)" }}
    >
      {/* Circle image area */}
      <div className="flex flex-col items-center pt-3 pb-1 px-2"
        style={{ background: "#dcfce7" }}>
        <div className="relative">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-[#1A4D1F]/5 flex items-center justify-center">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
            ) : (
              <Package size={22} className="text-[#1A4D1F]/20" />
            )}
          </div>
          {pct > 0 && (
            <div className="absolute -top-0.5 -end-0.5 bg-red-500 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
              -{pct}%
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col flex-1 gap-0.5" dir="rtl">
        <p className="font-black text-xs text-[#1A4D1F] text-center leading-tight line-clamp-2">{p.title}</p>

        {/* Supplier */}
        {p.supplierName && (
          <span className="inline-flex items-center justify-center gap-0.5 text-[8px] font-bold text-[#1A4D1F]/45">
            <Store size={7} />
            {p.supplierName}
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

// ── Main Deals Page ───────────────────────────────────────────────────────────
export default function Deals() {
  const { lang, t, isRTL } = useLang();
  const [, navigate] = useLocation();
  const [products, setProducts]   = useState<DealProduct[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await get<DealProduct[]>("/products/deals");
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ["all", ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    const matchCat = catFilter === "all" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  // Group by discount %
  const sorted = [...filtered].sort((a, b) => {
    const pa = discountPct(a.originalPrice ?? "0", a.salePrice ?? "0");
    const pb = discountPct(b.originalPrice ?? "0", b.salePrice ?? "0");
    return pb - pa;
  });

  const totalSaved = filtered.reduce((sum, p) => {
    const o = parseFloat(p.originalPrice ?? "0");
    const s = parseFloat(p.salePrice ?? "0");
    return sum + Math.max(0, o - s);
  }, 0);

  return (
    <div className="min-h-screen" style={{ background: "#ffffff", fontFamily: "'Cairo','Tajawal',sans-serif" }} dir="rtl">

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(255,255,255,0.95)", borderColor: "rgba(46,125,50,0.08)", backdropFilter: "blur(10px)" }}
      >
        <button
          onClick={() => navigate("/home")}
          className="p-2 rounded-xl text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:bg-[#1A4D1F]/8 transition-all"
        >
          <ArrowRight size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black text-[#1A4D1F] flex items-center gap-2">
            <Percent size={16} className="text-red-500" />
            {t("منتجات في التخفيض", "Produits en promotion")}
          </h1>
          <p className="text-[10px] font-bold text-[#1A4D1F]/40">
            {t("أفضل العروض من جميع المزودين", "Meilleures offres de tous les fournisseurs")}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 rounded-xl text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-all"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {/* ── Summary Banner ── */}
      {!loading && products.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, #1A4D1F 0%, #0D3311 100%)" }}
        >
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles size={22} className="text-[#FFA500]" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black text-sm">
              {products.length} {t("منتج بتخفيض", "produit(s) en promo")}
            </p>
            {totalSaved > 0 && (
              <p className="text-white/70 text-xs font-bold">
                {t("وفّر حتى", "Économisez jusqu'à")} {totalSaved.toFixed(3)} TND
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[#FFA500] text-2xl font-black">%</p>
          </div>
        </motion.div>
      )}

      {/* ── Search ── */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A4D1F]/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("ابحث عن منتج...", "Rechercher un produit...")}
            className="w-full pr-9 pl-8 py-2.5 rounded-xl border text-sm font-bold text-[#1A4D1F] bg-white outline-none"
            style={{ borderColor: "rgba(46,125,50,0.2)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-[#1A4D1F]/30" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category filter ── */}
      {categories.length > 1 && (
        <div className="px-4 mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black transition-all",
                catFilter === c
                  ? "text-white shadow-sm"
                  : "text-[#1A4D1F]/50 border border-[#1A4D1F]/15 hover:border-[#1A4D1F]/40"
              )}
              style={catFilter === c ? { background: "#1A4D1F" } : {}}
            >
              {c === "all" ? t("الكل", "Tout") : c}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-4 mt-4 pb-24">
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
                  : t("لا توجد عروض حالياً", "Aucune promotion pour l'instant")
                }
              </p>
              <p className="text-xs text-[#1A4D1F]/25 mt-1 font-bold">
                {t("تحقق لاحقاً للعروض الجديدة", "Revenez plus tard pour de nouvelles offres")}
              </p>
            </div>
            {(search || catFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setCatFilter("all"); }}
                className="px-4 py-2 rounded-xl text-xs font-black text-[#1A4D1F] border border-[#1A4D1F]/20 hover:bg-[#1A4D1F]/5 transition-all"
              >
                {t("مسح الفلاتر", "Effacer les filtres")}
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {sorted.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <ProductCard p={p} t={t} lang={lang} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
