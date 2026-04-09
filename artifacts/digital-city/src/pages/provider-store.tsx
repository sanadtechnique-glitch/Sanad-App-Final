import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { get } from "@/lib/admin-api";
import { Plus, Minus, Package, Star, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { AdCarousel } from "@/components/AdCarousel";
import { cn } from "@/lib/utils";

const CATEGORY_REDIRECT: Record<string, string> = {
  car_rental: "/car-rental",
  sos: "/sos",
  lawyer: "/lawyer",
  taxi: "/taxi",
};

interface Supplier {
  id: number; name: string; nameAr: string; category: string;
  description: string; descriptionAr: string; address: string;
  rating?: number; isAvailable: boolean; photoUrl?: string;
  deliveryFee?: number;
}
interface Article {
  id: number; supplierId: number; nameAr: string; nameFr: string;
  descriptionAr: string; descriptionFr: string; price: number;
  originalPrice?: number; photoUrl?: string; images?: string | null; isAvailable: boolean;
}

function parseImages(a: Article): string[] {
  try { return a.images ? JSON.parse(a.images) : []; } catch { return []; }
}
function getImages(a: Article): string[] {
  const imgs = parseImages(a);
  return imgs.length > 0 ? imgs : (a.photoUrl ? [a.photoUrl] : []);
}

/** Swipeable image mini-slider for product cards */
function ProductImageSlider({ images, nameAr }: { images: string[]; nameAr: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return (
    <div className="w-full aspect-[4/3] bg-[#FFF8E7] flex items-center justify-center">
      <Package size={26} className="text-[#1A4D1F]/15" />
    </div>
  );
  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden bg-[#FFF8E7] group">
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={idx}
          src={images[idx]}
          alt={nameAr}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <ChevronRight size={12} />
          </button>
          {/* Dots */}
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className={cn("rounded-full transition-all", i === idx ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProviderStore() {
  const { id } = useParams<{ id: string }>();
  const { lang, t, isRTL } = useLang();
  const { addItem, updateQty, removeItem, cart } = useCart();
  const [, navigate] = useLocation();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      get<Supplier>(`/suppliers/${id}`).catch(() => null),
      get<Article[]>(`/articles?supplierId=${id}`).catch(() => []),
    ]).then(([sup, arts]) => {
      // Suppliers with dedicated pages — redirect there instead of showing product catalog
      if (sup && CATEGORY_REDIRECT[sup.category]) {
        navigate(CATEGORY_REDIRECT[sup.category]);
        return;
      }
      setSupplier(sup || null);
      setArticles(Array.isArray(arts) ? arts.filter((a: Article) => a.isAvailable) : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAdd = (article: Article) => {
    if (!supplier) return;
    addItem(
      supplier.id,
      lang === "ar" ? supplier.nameAr : supplier.name,
      { id: article.id, name: article.nameFr, nameAr: article.nameAr, price: article.price, image: article.photoUrl },
      supplier.deliveryFee ?? 0,
    );
  };

  const getQty = (articleId: number) =>
    cart.items.find(i => i.id === articleId)?.qty ?? 0;

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#1A4D1F] border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!supplier) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#1A4D1F]/40 mb-4">{t("المزود غير موجود", "Fournisseur introuvable")}</p>
            <Link href="/services">
              <button className="text-[#1A4D1F] text-sm underline">{t("العودة", "Retour")}</button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-36" dir={isRTL ? "rtl" : "ltr"}>

        {/* Back button — goes back to the supplier's category filter */}
        <Link href={supplier.category ? `/services?category=${supplier.category}` : "/services"}>
          <button className="flex items-center gap-2 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-colors mb-6 text-sm font-bold">
            {isRTL ? <ChevronLeft size={16} /> : <ArrowRight size={16} className="rotate-180" />}
            <span>{t("العودة للخدمات", "Retour aux services")}</span>
          </button>
        </Link>

        {/* Supplier header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] p-5 mb-8 border border-[#1A4D1F]/20 flex items-center gap-4"
          style={{ background: "#FFFFFF" }}>
          <div className="w-16 h-16 rounded-full border-2 border-[#1A4D1F]/30 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md"
            style={{ background: "#FFF3E0" }}>
            {supplier.photoUrl
              ? <img src={supplier.photoUrl} alt="" className="w-full h-full object-cover" />
              : <Package size={26} className="text-[#1A4D1F]" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-[#1A4D1F] truncate">
              {lang === "ar" ? supplier.nameAr : supplier.name}
            </h1>
            {supplier.rating && (
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={11}
                    className={i <= Math.round(supplier.rating!) ? "text-[#1A4D1F] fill-[#1A4D1F]" : "text-[#1A4D1F]/20"} />
                ))}
                <span className="text-xs text-[#1A4D1F]/40 ms-1">{supplier.rating.toFixed(1)}</span>
              </div>
            )}
            <p className="text-xs text-[#1A4D1F]/30 mt-1 leading-relaxed truncate">
              {lang === "ar" ? supplier.descriptionAr : supplier.description}
            </p>
          </div>
        </motion.div>

        {/* Ad Carousel for this supplier */}
        <div className="mb-6">
          <AdCarousel supplierId={parseInt(id!)} height={100} />
        </div>

        {/* Section title */}
        {articles.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 rounded-full bg-[#1A4D1F]" />
            <h2 className="text-lg font-black text-[#1A4D1F]">{t("المنتجات المتاحة", "Produits disponibles")}</h2>
            <span className="text-xs text-[#1A4D1F]/30 px-2 py-0.5 rounded-full border border-[#1A4D1F]/10">{articles.length}</span>
          </div>
        )}

        {/* Product grid */}
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-[#1A4D1F]/10 mx-auto mb-4" />
            <p className="text-[#1A4D1F]/40 font-bold">{t("لا توجد منتجات متاحة حالياً", "Aucun produit disponible")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {articles.map((article, i) => {
              const qty = getQty(article.id);
              const imgs = getImages(article);
              const hasSale = !!(article.originalPrice && article.originalPrice > article.price);
              const discountPct = hasSale ? Math.round(((article.originalPrice! - article.price) / article.originalPrice!) * 100) : 0;
              return (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "rounded-2xl border overflow-hidden flex flex-col transition-all duration-300",
                    qty > 0
                      ? "border-[#1A4D1F]/50 shadow-[0_2px_16px_rgba(26,77,31,0.10)]"
                      : "border-[#1A4D1F]/12 hover:border-[#1A4D1F]/35"
                  )}
                  style={{ background: "#FFFFFF" }}>

                  {/* Rectangular image with slider */}
                  <div className="relative">
                    <ProductImageSlider images={imgs} nameAr={article.nameAr} />
                    {/* Sale badge */}
                    {hasSale && (
                      <div className="absolute top-2 start-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg">
                        -{discountPct}%
                      </div>
                    )}
                    {/* Cart quantity badge */}
                    {qty > 0 && (
                      <div className="absolute top-2 end-2 w-6 h-6 rounded-full bg-[#1A4D1F] flex items-center justify-center shadow">
                        <span className="text-white text-[10px] font-black">{qty}</span>
                      </div>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div className="p-2.5 flex flex-col flex-1 gap-1.5" dir="rtl">
                    <p className="text-xs font-black text-[#1A4D1F] leading-snug line-clamp-2">
                      {lang === "ar" ? article.nameAr : article.nameFr}
                    </p>
                    {article.descriptionAr && (
                      <p className="text-[10px] text-[#1A4D1F]/40 font-bold leading-tight line-clamp-1">
                        {lang === "ar" ? article.descriptionAr : article.descriptionFr}
                      </p>
                    )}
                    <div className="mt-auto space-y-2">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[#1A4D1F] font-black text-sm">{article.price.toFixed(2)} DT</span>
                        {hasSale && (
                          <span className="text-[#1A4D1F]/25 text-[10px] font-bold line-through">{article.originalPrice!.toFixed(2)}</span>
                        )}
                      </div>
                      {qty > 0 ? (
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            onClick={() => updateQty(article.id, qty - 1)}
                            className="flex-1 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-400 hover:bg-red-100 transition-all">
                            <Minus size={11} />
                          </button>
                          <span className="text-[#1A4D1F] font-black text-sm w-6 text-center">{qty}</span>
                          <button
                            onClick={() => updateQty(article.id, qty + 1)}
                            className="flex-1 h-7 rounded-lg bg-[#1A4D1F]/10 border border-[#1A4D1F]/25 flex items-center justify-center text-[#1A4D1F] hover:bg-[#1A4D1F]/20 transition-all">
                            <Plus size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdd(article)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl font-black text-[10px] transition-all"
                          style={{ background: "#1A4D1F", color: "#fff" }}>
                          <Plus size={11} />
                          {t("أضف للسلة", "Ajouter")}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
