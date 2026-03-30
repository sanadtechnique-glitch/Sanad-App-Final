import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Percent, Tag, ArrowRight, RefreshCw, Search, X,
  ShoppingBag, Store, ChevronDown, ChevronUp, Star,
  Package, Truck, Sparkles,
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
  originalPrice?: string;
  salePrice?: string;
  isAvailable: boolean;
  createdAt: string;
}

// ── Price helpers ─────────────────────────────────────────────────────────────
function discountPct(orig: string, sale: string) {
  const o = parseFloat(orig), s = parseFloat(sale);
  if (!o || !s) return 0;
  return Math.round(((o - s) / o) * 100);
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ p, t }: { p: DealProduct; t: (ar: string, fr: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const pct = discountPct(p.originalPrice ?? "0", p.salePrice ?? "0");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden cursor-pointer"
      style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.15)" }}
      onClick={() => setExpanded(e => !e)}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex gap-3 p-4" dir="rtl">
        {/* Image */}
        <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden border border-[#2E7D32]/10 bg-[#2E7D32]/5 flex items-center justify-center relative">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
          ) : (
            <Package size={22} className="text-[#2E7D32]/20" />
          )}
          {pct > 0 && (
            <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-bl-xl rounded-tr-xl">
              -{pct}%
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-[#2E7D32] truncate">{p.title}</p>
          {p.category && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2E7D32]/40 bg-[#2E7D32]/5 px-2 py-0.5 rounded-full mt-0.5">
              <Tag size={9} />
              {p.category}
            </span>
          )}
          {/* Prices */}
          <div className="flex items-center gap-2 mt-2">
            {p.salePrice && (
              <span className="text-lg font-black" style={{ color: "#2E7D32" }}>
                {parseFloat(p.salePrice).toFixed(3)} TND
              </span>
            )}
            {p.originalPrice && (
              <span className="text-sm font-bold line-through" style={{ color: "#9CA3AF" }}>
                {parseFloat(p.originalPrice).toFixed(3)}
              </span>
            )}
          </div>
        </div>

        {/* Expand */}
        <div className="flex-shrink-0 self-center">
          {expanded
            ? <ChevronUp size={16} className="text-[#2E7D32]/30" />
            : <ChevronDown size={16} className="text-[#2E7D32]/30" />
          }
        </div>
      </div>

      {/* Expanded description */}
      <AnimatePresence>
        {expanded && p.description && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "rgba(46,125,50,0.08)" }} dir="rtl">
              <p className="text-xs font-bold text-[#2E7D32]/60 leading-relaxed">{p.description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="min-h-screen" style={{ background: "#FFF3E0", fontFamily: "'Cairo','Tajawal',sans-serif" }} dir="rtl">

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(255,243,224,0.95)", borderColor: "rgba(46,125,50,0.12)", backdropFilter: "blur(10px)" }}
      >
        <button
          onClick={() => navigate("/home")}
          className="p-2 rounded-xl text-[#2E7D32]/50 hover:text-[#2E7D32] hover:bg-[#2E7D32]/8 transition-all"
        >
          <ArrowRight size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black text-[#2E7D32] flex items-center gap-2">
            <Percent size={16} className="text-red-500" />
            {t("منتجات في التخفيض", "Produits en promotion")}
          </h1>
          <p className="text-[10px] font-bold text-[#2E7D32]/40">
            {t("أفضل العروض من جميع المزودين", "Meilleures offres de tous les fournisseurs")}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 rounded-xl text-[#2E7D32]/40 hover:text-[#2E7D32] transition-all"
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
          style={{ background: "linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)" }}
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
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2E7D32]/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("ابحث عن منتج...", "Rechercher un produit...")}
            className="w-full pr-9 pl-8 py-2.5 rounded-xl border text-sm font-bold text-[#2E7D32] bg-white outline-none"
            style={{ borderColor: "rgba(46,125,50,0.2)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-[#2E7D32]/30" />
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
                  : "text-[#2E7D32]/50 border border-[#2E7D32]/15 hover:border-[#2E7D32]/40"
              )}
              style={catFilter === c ? { background: "#2E7D32" } : {}}
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
            <RefreshCw size={24} className="animate-spin text-[#2E7D32]/30" />
            <p className="text-sm font-bold text-[#2E7D32]/30">{t("جارٍ التحميل...", "Chargement...")}</p>
          </div>
        ) : sorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="w-20 h-20 rounded-full bg-[#2E7D32]/5 flex items-center justify-center">
              <ShoppingBag size={32} className="text-[#2E7D32]/20" />
            </div>
            <div className="text-center">
              <p className="font-black text-[#2E7D32]/40 text-base">
                {search || catFilter !== "all"
                  ? t("لا توجد نتائج مطابقة", "Aucun résultat")
                  : t("لا توجد عروض حالياً", "Aucune promotion pour l'instant")
                }
              </p>
              <p className="text-xs text-[#2E7D32]/25 mt-1 font-bold">
                {t("تحقق لاحقاً للعروض الجديدة", "Revenez plus tard pour de nouvelles offres")}
              </p>
            </div>
            {(search || catFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setCatFilter("all"); }}
                className="px-4 py-2 rounded-xl text-xs font-black text-[#2E7D32] border border-[#2E7D32]/20 hover:bg-[#2E7D32]/5 transition-all"
              >
                {t("مسح الفلاتر", "Effacer les filtres")}
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {sorted.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ProductCard p={p} t={t} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
