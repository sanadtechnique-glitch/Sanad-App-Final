import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { get } from "@/lib/admin-api";
import {
  ShoppingCart, Plus, Minus, Trash2, Package,
  X, Star, ArrowRight, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number; name: string; nameAr: string; category: string;
  description: string; descriptionAr: string; address: string;
  rating?: number; isAvailable: boolean; photoUrl?: string;
}
interface Article {
  id: number; supplierId: number; nameAr: string; nameFr: string;
  descriptionAr: string; descriptionFr: string; price: number;
  originalPrice?: number; photoUrl?: string; isAvailable: boolean;
}
interface CartItem { article: Article; qty: number; }

export default function ProviderStore() {
  const { id } = useParams<{ id: string }>();
  const { lang, t, isRTL } = useLang();
  const [, navigate] = useLocation();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      get<Supplier[]>("/admin/suppliers"),
      get<Article[]>(`/articles?supplierId=${id}`),
    ]).then(([suppliers, arts]) => {
      const sup = suppliers.find(s => s.id === parseInt(id));
      setSupplier(sup || null);
      setArticles(arts.filter((a: Article) => a.isAvailable));
    }).finally(() => setLoading(false));
  }, [id]);

  const addToCart = (article: Article) => {
    setCart(prev => {
      const existing = prev.find(c => c.article.id === article.id);
      if (existing) return prev.map(c => c.article.id === article.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { article, qty: 1 }];
    });
  };

  const changeQty = (articleId: number, delta: number) => {
    setCart(prev =>
      prev.map(c => c.article.id === articleId ? { ...c, qty: c.qty + delta } : c)
        .filter(c => c.qty > 0)
    );
  };

  const removeFromCart = (articleId: number) => setCart(prev => prev.filter(c => c.article.id !== articleId));

  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cart.reduce((s, c) => s + c.article.price * c.qty, 0);

  const placeOrder = () => {
    if (!supplier) return;
    const lines = cart.map(c =>
      `${lang === "ar" ? c.article.nameAr : c.article.nameFr} x${c.qty} — ${(c.article.price * c.qty).toFixed(2)} DT`
    ).join("\n");
    const notes = encodeURIComponent(`🛒 المنتجات:\n${lines}\n\n💰 الإجمالي: ${totalPrice.toFixed(2)} DT`);
    navigate(`/order/${supplier.id}?notes=${notes}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!supplier) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/40 mb-4">{t("المزود غير موجود", "Fournisseur introuvable")}</p>
            <Link href="/services">
              <button className="text-[#D4AF37] text-sm underline">{t("العودة", "Retour")}</button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-36" dir={isRTL ? "rtl" : "ltr"}>

        {/* Back button */}
        <Link href="/services">
          <button className="flex items-center gap-2 text-white/40 hover:text-[#D4AF37] transition-colors mb-6 text-sm font-bold">
            {isRTL ? <ChevronLeft size={16} /> : <ArrowRight size={16} className="rotate-180" />}
            <span>{t("العودة للخدمات", "Retour aux services")}</span>
          </button>
        </Link>

        {/* Supplier header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] p-5 mb-8 border border-[#D4AF37]/20 flex items-center gap-4"
          style={{ background: "#121212" }}>
          <div
            className="w-16 h-16 rounded-2xl border-2 border-[#D4AF37]/40 flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: "#0f0f00" }}>
            {supplier.photoUrl
              ? <img src={supplier.photoUrl} alt="" className="w-full h-full object-cover" />
              : <Package size={26} className="text-[#D4AF37]" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white truncate">
              {lang === "ar" ? supplier.nameAr : supplier.name}
            </h1>
            {supplier.rating && (
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={11}
                    className={i <= Math.round(supplier.rating!) ? "text-[#D4AF37] fill-[#D4AF37]" : "text-white/20"} />
                ))}
                <span className="text-xs text-white/40 ms-1">{supplier.rating.toFixed(1)}</span>
              </div>
            )}
            <p className="text-xs text-white/30 mt-1 leading-relaxed truncate">
              {lang === "ar" ? supplier.descriptionAr : supplier.description}
            </p>
          </div>
          {articles.length === 0 && (
            <Link href={`/order/${supplier.id}`}>
              <button className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-black text-sm hover:bg-[#C09B28] transition-all flex-shrink-0">
                {t("اطلب", "Commander")}
              </button>
            </Link>
          )}
        </motion.div>

        {/* Section title */}
        {articles.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 rounded-full bg-[#D4AF37]" />
            <h2 className="text-lg font-black text-white">{t("المنتجات المتاحة", "Produits disponibles")}</h2>
            <span className="text-xs text-white/30 px-2 py-0.5 rounded-full border border-white/10">{articles.length}</span>
          </div>
        )}

        {/* Product grid */}
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/30 mb-6">{t("لا توجد منتجات متاحة", "Aucun produit disponible")}</p>
            <Link href={`/order/${supplier.id}`}>
              <button className="px-6 py-3 rounded-xl bg-[#D4AF37] text-black font-black hover:bg-[#C09B28] transition-all">
                {t("اطلب مباشرة", "Commander directement")}
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {articles.map((article, i) => {
              const inCart = cart.find(c => c.article.id === article.id);
              return (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "rounded-[15px] border overflow-hidden flex flex-col transition-all duration-300",
                    inCart
                      ? "border-[#D4AF37]/60 shadow-[0_0_20px_rgba(212,175,55,0.12)]"
                      : "border-[#D4AF37]/20 hover:border-[#D4AF37]/45"
                  )}
                  style={{ background: "#0a0a0a" }}>

                  {/* 1:1 image */}
                  <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                    <div className="absolute inset-0 border-b border-[#D4AF37]/15" style={{ background: "#000" }}>
                      {article.photoUrl ? (
                        <img
                          src={article.photoUrl}
                          alt={article.nameAr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={32} className="text-[#D4AF37]/15" />
                        </div>
                      )}
                      {inCart && (
                        <div className="absolute top-2 end-2 w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center">
                          <span className="text-black text-[10px] font-black">{inCart.qty}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-sm font-black text-white leading-tight mb-1">
                      {lang === "ar" ? article.nameAr : article.nameFr}
                    </p>
                    {(lang === "ar" ? article.descriptionAr : article.descriptionFr) && (
                      <p className="text-[11px] text-white/30 leading-tight line-clamp-2 mb-2">
                        {lang === "ar" ? article.descriptionAr : article.descriptionFr}
                      </p>
                    )}
                    <div className="mt-auto space-y-2">
                      <p className="text-[#D4AF37] font-black text-base">{article.price.toFixed(2)} DT</p>
                      {inCart ? (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => changeQty(article.id, -1)}
                            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-red-400/30 hover:text-red-400 transition-all text-white/60">
                            <Minus size={12} />
                          </button>
                          <span className="text-white font-black text-sm flex-1 text-center">{inCart.qty}</span>
                          <button
                            onClick={() => changeQty(article.id, 1)}
                            className="w-8 h-8 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center hover:bg-[#D4AF37]/30 transition-all text-[#D4AF37]">
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(article)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-black hover:bg-[#D4AF37]/25 transition-all">
                          <Plus size={12} />
                          {t("إضافة للسلة", "Ajouter")}
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

      {/* Floating cart button */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-black border border-[#D4AF37]/20"
            style={{ background: "#D4AF37", boxShadow: "0 0 35px rgba(212,175,55,0.4)" }}>
            <ShoppingCart size={18} />
            <span>{t("السلة", "Panier")}</span>
            <span className="bg-black/20 rounded-full w-6 h-6 flex items-center justify-center text-xs">{totalItems}</span>
            <span className="text-sm">{totalPrice.toFixed(2)} DT</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowCart(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[#D4AF37]/25 overflow-hidden"
              style={{ background: "#0f0f0f" }}
              onClick={e => e.stopPropagation()}>
              <div className="p-5" dir={isRTL ? "rtl" : "ltr"}>
                {/* Cart header */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <ShoppingCart size={18} className="text-[#D4AF37]" />
                    {t("سلة التسوق", "Mon panier")}
                    <span className="text-xs text-white/30 font-normal">{totalItems} {t("صنف", "article(s)")}</span>
                  </h2>
                  <button onClick={() => setShowCart(false)} className="p-2 rounded-xl text-white/30 hover:text-white transition-all">
                    <X size={18} />
                  </button>
                </div>

                {/* Items */}
                <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                  {cart.map(item => (
                    <div key={item.article.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5" style={{ background: "#1a1a1a" }}>
                      <div className="w-12 h-12 rounded-xl border border-[#D4AF37]/20 overflow-hidden flex-shrink-0 bg-black flex items-center justify-center">
                        {item.article.photoUrl
                          ? <img src={item.article.photoUrl} alt="" className="w-full h-full object-cover" />
                          : <Package size={16} className="text-[#D4AF37]/20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">
                          {lang === "ar" ? item.article.nameAr : item.article.nameFr}
                        </p>
                        <p className="text-xs text-[#D4AF37]">{(item.article.price * item.qty).toFixed(2)} DT</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(item.article.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-red-400 transition-all">
                          <Minus size={10} />
                        </button>
                        <span className="text-white font-black text-sm w-5 text-center">{item.qty}</span>
                        <button onClick={() => changeQty(item.article.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                          <Plus size={10} />
                        </button>
                        <button onClick={() => removeFromCart(item.article.id)}
                          className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center ms-1 text-red-400">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total + Order */}
                <div className="mt-5 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/50 text-sm">{t("الإجمالي", "Total")}</span>
                    <span className="text-[#D4AF37] font-black text-xl">{totalPrice.toFixed(2)} DT</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    className="w-full py-3.5 rounded-xl font-black text-base text-black transition-all"
                    style={{ background: "#D4AF37", boxShadow: "0 0 25px rgba(212,175,55,0.3)" }}>
                    {t("إتمام الطلب ←", "Passer la commande →")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
