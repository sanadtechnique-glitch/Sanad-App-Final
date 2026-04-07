import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { get } from "@/lib/admin-api";
import { Plus, Minus, Package, Star, ArrowRight, ChevronLeft } from "lucide-react";
import { AdCarousel } from "@/components/AdCarousel";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number; name: string; nameAr: string; category: string;
  description: string; descriptionAr: string; address: string;
  rating?: number; isAvailable: boolean; photoUrl?: string;
  deliveryFee?: number;
}
interface Article {
  id: number; supplierId: number; nameAr: string; nameFr: string;
  descriptionAr: string; descriptionFr: string; price: number;
  originalPrice?: number; photoUrl?: string; isAvailable: boolean;
}

export default function ProviderStore() {
  const { id } = useParams<{ id: string }>();
  const { lang, t, isRTL } = useLang();
  const { addItem, updateQty, removeItem, cart } = useCart();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      get<Supplier>(`/suppliers/${id}`),
      get<Article[]>(`/articles?supplierId=${id}`),
    ]).then(([sup, arts]) => {
      setSupplier(sup || null);
      setArticles(arts.filter((a: Article) => a.isAvailable));
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
          {articles.length === 0 && (
            <Link href={`/order/${supplier.id}`}>
              <button className="px-4 py-2 rounded-xl bg-[#1A4D1F] text-black font-black text-sm hover:bg-[#1A4D1F] transition-all flex-shrink-0">
                {t("اطلب", "Commander")}
              </button>
            </Link>
          )}
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
            <p className="text-[#1A4D1F]/30 mb-6">{t("لا توجد منتجات متاحة", "Aucun produit disponible")}</p>
            <Link href={`/order/${supplier.id}`}>
              <button className="px-6 py-3 rounded-xl bg-[#1A4D1F] text-black font-black hover:bg-[#1A4D1F] transition-all">
                {t("اطلب مباشرة", "Commander directement")}
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {articles.map((article, i) => {
              const qty = getQty(article.id);
              return (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "rounded-[15px] border overflow-hidden flex flex-col transition-all duration-300",
                    qty > 0
                      ? "border-[#1A4D1F]/60 shadow-[0_0_20px_rgba(46,125,50,0.12)]"
                      : "border-[#1A4D1F]/20 hover:border-[#1A4D1F]/45"
                  )}
                  style={{ background: "#FFFFFF" }}>

                  {/* Circular product image */}
                  <div className="flex flex-col items-center pt-3 pb-1 px-2 relative"
                    style={{ background: "linear-gradient(to bottom, #FFF8E7, #FFFFFF)" }}>
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-[#FFA500]/10 flex items-center justify-center">
                        {article.photoUrl ? (
                          <img src={article.photoUrl} alt={article.nameAr} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={22} className="text-[#1A4D1F]/20" />
                        )}
                      </div>
                      {qty > 0 && (
                        <div className="absolute -top-0.5 -end-0.5 w-5 h-5 rounded-full bg-[#1A4D1F] flex items-center justify-center shadow-sm">
                          <span className="text-black text-[9px] font-black">{qty}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2 flex flex-col flex-1">
                    <p className="text-xs font-black text-[#1A4D1F] leading-tight mb-1 line-clamp-2">
                      {lang === "ar" ? article.nameAr : article.nameFr}
                    </p>
                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <p className="text-[#1A4D1F] font-black text-sm">{article.price.toFixed(2)} DT</p>
                        {article.originalPrice && article.originalPrice > article.price && (
                          <p className="text-[#1A4D1F]/25 text-[10px] line-through">{article.originalPrice.toFixed(2)}</p>
                        )}
                      </div>
                      {qty > 0 ? (
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => updateQty(article.id, qty - 1)}
                            className="w-6 h-6 rounded-lg bg-[#1A4D1F]/5 border border-[#1A4D1F]/10 flex items-center justify-center hover:border-red-400/30 hover:text-red-400 transition-all text-[#1A4D1F]/60">
                            <Minus size={10} />
                          </button>
                          <span className="text-[#1A4D1F] font-black text-xs flex-1 text-center">{qty}</span>
                          <button
                            onClick={() => updateQty(article.id, qty + 1)}
                            className="w-6 h-6 rounded-lg bg-[#1A4D1F]/20 border border-[#1A4D1F]/40 flex items-center justify-center hover:bg-[#1A4D1F]/30 transition-all text-[#1A4D1F]">
                            <Plus size={10} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAdd(article)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#1A4D1F]/15 border border-[#1A4D1F]/30 text-[#1A4D1F] text-[10px] font-black hover:bg-[#1A4D1F]/25 transition-all">
                          <Plus size={10} />
                          {t("+", "+")}
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
