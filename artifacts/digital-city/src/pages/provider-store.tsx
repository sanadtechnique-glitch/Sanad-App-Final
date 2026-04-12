import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { get } from "@/lib/admin-api";
import { Plus, Minus, Package, Star, ArrowRight, ChevronLeft } from "lucide-react";
import { AdCarousel } from "@/components/AdCarousel";
import { ImageGallery } from "@/components/ImageGallery";

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

function getImages(a: Article): string[] {
  try {
    const parsed = a.images ? JSON.parse(a.images) : [];
    return parsed.length > 0 ? parsed : (a.photoUrl ? [a.photoUrl] : []);
  } catch {
    return a.photoUrl ? [a.photoUrl] : [];
  }
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
      <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
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

        {/* Product grid — Neubrutalist */}
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-[#1A4D1F]/10 mx-auto mb-4" />
            <p className="text-[#1A4D1F]/40 font-bold">{t("لا توجد منتجات متاحة حالياً", "Aucun produit disponible")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {articles.map((article) => {
              const qty = getQty(article.id);
              const imgs = getImages(article);
              const hasSale = !!(article.originalPrice && article.originalPrice > article.price);
              const discountPct = hasSale ? Math.round(((article.originalPrice! - article.price) / article.originalPrice!) * 100) : 0;
              return (
                <div
                  key={article.id}
                  className="bg-white border-2 border-black flex flex-col overflow-hidden"
                  style={{ boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}>

                  {/* Image — fixed height, object-contain, transparent-friendly */}
                  <div className="relative bg-white border-b-2 border-black" style={{ height: 120 }}>
                    {imgs.length > 0 ? (
                      <ImageGallery images={imgs} alt={lang === "ar" ? article.nameAr : article.nameFr} aspectRatio="none" objectFit="contain" className="h-full bg-white" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={32} className="text-black/10" />
                      </div>
                    )}
                    {hasSale && (
                      <div className="absolute top-1 start-1 z-20 bg-black text-white text-[8px] font-black px-1.5 py-0.5 pointer-events-none">
                        -{discountPct}%
                      </div>
                    )}
                    {qty > 0 && (
                      <div className="absolute top-1 end-1 z-20 w-5 h-5 bg-black flex items-center justify-center pointer-events-none">
                        <span className="text-white text-[9px] font-black">{qty}</span>
                      </div>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div className="p-2 flex flex-col flex-1 gap-2" dir="rtl">
                    <p className="text-[11px] font-black text-black leading-snug line-clamp-2">
                      {lang === "ar" ? article.nameAr : article.nameFr}
                    </p>

                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[#166534] font-black text-sm">{article.price.toFixed(2)} DT</span>
                        {hasSale && (
                          <span className="text-gray-400 text-[10px] font-bold line-through">{article.originalPrice!.toFixed(2)}</span>
                        )}
                      </div>

                      {qty > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQty(article.id, qty - 1)}
                            className="w-7 h-7 border-2 border-black bg-white flex items-center justify-center font-black active:translate-x-px active:translate-y-px"
                            style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}>
                            <Minus size={10} />
                          </button>
                          <span className="flex-1 text-center font-black text-xs text-black">{qty}</span>
                          <button
                            onClick={() => updateQty(article.id, qty + 1)}
                            className="w-7 h-7 border-2 border-black bg-white flex items-center justify-center font-black active:translate-x-px active:translate-y-px"
                            style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}>
                            <Plus size={10} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdd(article)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 border-2 border-black bg-black text-white font-black text-[10px] active:translate-x-px active:translate-y-px"
                          style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}>
                          <Plus size={10} />
                          {t("أضف", "Ajouter")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </Layout>
  );
}
