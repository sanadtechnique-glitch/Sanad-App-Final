import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { get } from "@/lib/admin-api";
import { Plus, Minus, Package, Star, ChevronLeft, ChevronRight, ArrowRight, Search, X, ShoppingCart } from "lucide-react";
import { ProductReviews } from "@/components/product-reviews";
import { AdCarousel } from "@/components/AdCarousel";

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
  category?: string;
  isWeighted?: boolean;
}

function getImages(a: Article): string[] {
  try {
    const parsed = a.images ? JSON.parse(a.images) : [];
    return parsed.length > 0 ? parsed : (a.photoUrl ? [a.photoUrl] : []);
  } catch {
    return a.photoUrl ? [a.photoUrl] : [];
  }
}

function formatPrice(n: number) {
  return n.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " DT";
}

export default function ProviderStore() {
  const { id } = useParams<{ id: string }>();
  const { lang, t, isRTL } = useLang();
  const { addItem, updateQty, cart } = useCart();
  const [, navigate] = useLocation();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [detailImgIdx, setDetailImgIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      get<Supplier>(`/suppliers/${id}`).catch(() => null),
      get<Article[]>(`/articles?supplierId=${id}`).catch(() => []),
    ]).then(([sup, arts]) => {
      if (sup && CATEGORY_REDIRECT[sup.category]) {
        navigate(CATEGORY_REDIRECT[sup.category]);
        return;
      }
      setSupplier(sup || null);
      setArticles(Array.isArray(arts) ? arts.filter((a: Article) => a.isAvailable) : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const WEIGHTED_STEP = 0.25;

  const handleAdd = (article: Article) => {
    if (!supplier) return;
    addItem(
      supplier.id,
      lang === "ar" ? supplier.nameAr : supplier.name,
      { id: article.id, name: article.nameFr, nameAr: article.nameAr, price: article.price, image: article.photoUrl, isWeighted: article.isWeighted ?? false },
      supplier.deliveryFee ?? 0,
    );
  };

  const getStep = (article: Article) => article.isWeighted ? WEIGHTED_STEP : 1;
  const fmtQty  = (qty: number, article: Article) =>
    article.isWeighted ? `${qty.toFixed(2)} kg` : `${qty}`;

  const getQty = (articleId: number) =>
    cart.items.find(i => i.id === articleId)?.qty ?? 0;

  /* ── derive unique categories from articles ── */
  const rawCats = Array.from(new Set(articles.map(a => a.category).filter(Boolean)));
  const tabs = [
    { key: "all", label: t("الكل", "Tout") },
    ...rawCats.map(c => ({ key: c!, label: c! })),
  ];

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (a.nameAr || "").toLowerCase().includes(q) ||
      (a.nameFr || "").toLowerCase().includes(q);
    const matchTab = activeTab === "all" || a.category === activeTab;
    return matchSearch && matchTab;
  });

  /* ── Loading ── */
  if (loading) {
    return (
      <Layout>
        <div style={{ background: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #1A4D1F", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      </Layout>
    );
  }

  if (!supplier) {
    return (
      <Layout>
        <div style={{ background: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#000", fontWeight: 700, marginBottom: 16 }}>{t("المزود غير موجود", "Fournisseur introuvable")}</p>
            <Link href="/services">
              <button style={{ background: "#1A4D1F", color: "#fff", border: "none", borderRadius: 20, padding: "8px 24px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                {t("العودة", "Retour")}
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ background: "#fff", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 100 }} dir={isRTL ? "rtl" : "ltr"}>

          {/* ── Supplier banner header ── */}
          <div style={{ padding: "14px 16px 0" }}>
            {/* Back link */}
            <Link href={supplier.category ? `/services?category=${supplier.category}` : "/services"}>
              <button style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "none", fontWeight: 600, fontSize: 13,
                color: "#1A4D1F", cursor: "pointer", marginBottom: 12, padding: 0,
              }}>
                {isRTL ? <ChevronLeft size={15} /> : <ArrowRight size={15} style={{ transform: "rotate(180deg)" }} />}
                {t("العودة", "Retour")}
              </button>
            </Link>

            {/* Supplier info — clean row, no border */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                overflow: "hidden", flexShrink: 0,
                background: "#f5f5f5",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {supplier.photoUrl
                  ? <img src={supplier.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Package size={22} color="#bbb" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: "#000", margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lang === "ar" ? supplier.nameAr : supplier.name}
                </h1>
                {supplier.rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 3 }}>
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={10} style={{
                        color: i <= Math.round(supplier.rating!) ? "#FFA500" : "#ddd",
                        fill: i <= Math.round(supplier.rating!) ? "#FFA500" : "none",
                      }} />
                    ))}
                    <span style={{ fontSize: 10, color: "#888", marginInlineStart: 3 }}>{supplier.rating.toFixed(1)}</span>
                  </div>
                )}
                <p style={{ fontSize: 11, color: "#888", margin: "3px 0 0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lang === "ar" ? supplier.descriptionAr : supplier.description}
                </p>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600, padding: "3px 9px",
                borderRadius: 20, flexShrink: 0,
                background: supplier.isAvailable ? "#e8f5e9" : "#fdecea",
                color: supplier.isAvailable ? "#1A4D1F" : "#c0392b",
              }}>
                {supplier.isAvailable ? t("مفتوح", "Ouvert") : t("مغلق", "Fermé")}
              </div>
            </div>
          </div>

          {/* ── Ad Carousel ── */}
          <div style={{ paddingInline: 16, marginBottom: 14 }}>
            <AdCarousel supplierId={parseInt(id!)} height={90} />
          </div>

          {/* ── Search bar ── */}
          <div style={{ paddingInline: 16, marginBottom: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f5f5f5", borderRadius: 24,
              padding: "8px 14px",
            }}>
              <Search size={15} color="#aaa" style={{ flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("ابحث عن منتج...", "Rechercher un produit...")}
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: 13, color: "#000", outline: "none",
                  fontFamily: "'Cairo','Tajawal',sans-serif",
                  textAlign: isRTL ? "right" : "left",
                }}
              />
            </div>
          </div>

          {/* ── Category tabs — underline style ── */}
          {tabs.length > 1 && (
            <div style={{
              display: "flex", gap: 0,
              overflowX: "auto", paddingInline: 16,
              borderBottom: "1px solid #eee", marginBottom: 14,
              scrollbarWidth: "none",
            }}
            className="scrollbar-hide"
            >
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flexShrink: 0,
                    background: "none", border: "none",
                    padding: "8px 14px",
                    fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 400,
                    color: activeTab === tab.key ? "#1A4D1F" : "#888",
                    borderBottom: activeTab === tab.key ? "2px solid #1A4D1F" : "2px solid transparent",
                    cursor: "pointer",
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                    marginBottom: -1,
                    transition: "color 0.15s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Product grid — 3 columns ── */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <Package size={42} style={{ color: "#ddd", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "#aaa" }}>
                {search ? t("لا نتائج", "Aucun résultat") : t("لا توجد منتجات متاحة حالياً", "Aucun produit disponible")}
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "4px 4px",
              paddingInline: 8,
            }}>
              {filtered.map((article) => {
                const qty = getQty(article.id);
                const imgs = getImages(article);
                const hasSale = !!(article.originalPrice && article.originalPrice > article.price);
                const discountPct = hasSale
                  ? Math.round(((article.originalPrice! - article.price) / article.originalPrice!) * 100)
                  : 0;

                return (
                  <div
                    key={article.id}
                    style={{
                      display: "flex", flexDirection: "column",
                      background: "#fff",
                      borderRadius: 10,
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                    onClick={() => { setDetailArticle(article); setDetailImgIdx(0); }}
                  >
                    {/* ── Image area — transparent, object-contain ── */}
                    <div style={{
                      position: "relative",
                      height: 120,
                      background: "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {imgs.length > 0 ? (
                        <img
                          src={imgs[0]}
                          alt={lang === "ar" ? article.nameAr : article.nameFr}
                          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
                        />
                      ) : (
                        <Package size={32} color="#ccc" />
                      )}

                      {/* Discount badge */}
                      {hasSale && (
                        <div style={{
                          position: "absolute", top: 5, insetInlineStart: 5,
                          background: "#e53935", color: "#fff",
                          fontSize: 8, fontWeight: 700,
                          padding: "2px 5px", borderRadius: 4,
                        }}>
                          -{discountPct}%
                        </div>
                      )}

                      {/* Qty badge */}
                      {qty > 0 && (
                        <div style={{
                          position: "absolute", top: 5, insetInlineEnd: 32,
                          background: "#1A4D1F", color: "#fff",
                          minWidth: 18, height: 18, borderRadius: 9,
                          padding: "0 4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 700, whiteSpace: "nowrap",
                        }}>
                          {article.isWeighted ? `${qty.toFixed(2)}kg` : qty}
                        </div>
                      )}

                      {/* FAB (+) button — bottom-right of image */}
                      {qty === 0 ? (
                        <button
                          onClick={() => handleAdd(article)}
                          style={{
                            position: "absolute", bottom: 6, insetInlineEnd: 6,
                            width: 26, height: 26, borderRadius: "50%",
                            background: "#1A4D1F", color: "#fff", border: "none",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                            zIndex: 5,
                          }}
                          aria-label={t("أضف", "Ajouter")}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      ) : (
                        /* Inline qty controls when already in cart */
                        <div style={{
                          position: "absolute", bottom: 5, insetInlineEnd: 5,
                          display: "flex", alignItems: "center", gap: 3,
                          background: "rgba(255,255,255,0.92)", borderRadius: 14,
                          padding: "2px 4px",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.14)",
                          zIndex: 5,
                        }}>
                          <button
                            onClick={() => updateQty(article.id, Math.round((qty - getStep(article)) * 1000) / 1000)}
                            style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: "#f0f0f0", border: "none",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <Minus size={10} />
                          </button>
                          <span style={{ fontSize: 10, fontWeight: 700, minWidth: 14, textAlign: "center" }}>
                            {fmtQty(qty, article)}
                          </span>
                          <button
                            onClick={() => updateQty(article.id, Math.round((qty + getStep(article)) * 1000) / 1000)}
                            style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: "#1A4D1F", border: "none", color: "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Text area ── */}
                    <div style={{ padding: "6px 6px 10px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 2 }}>
                        <p style={{
                          fontSize: 11, color: "#222", lineHeight: 1.35, margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {lang === "ar" ? article.nameAr : article.nameFr}
                        </p>
                        {article.isWeighted && (
                          <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, color: "#FFA500", background: "rgba(255,165,0,0.12)", borderRadius: 4, padding: "1px 4px" }}>
                            kg
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#000" }}>
                          {formatPrice(article.price)}
                          {article.isWeighted && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: "#777" }}>/{lang === "ar" ? "كغ" : "kg"}</span>
                          )}
                        </span>
                        {hasSale && (
                          <span style={{ fontSize: 9, color: "#aaa", textDecoration: "line-through" }}>
                            {formatPrice(article.originalPrice!)}
                          </span>
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

      {/* ── Product Detail Modal with Image Gallery ── */}
      <AnimatePresence>
        {detailArticle && (() => {
          const imgs = getImages(detailArticle);
          const qty = getQty(detailArticle.id);
          const hasSale = !!(detailArticle.originalPrice && detailArticle.originalPrice > detailArticle.price);
          const discountPct = hasSale
            ? Math.round(((detailArticle.originalPrice! - detailArticle.price) / detailArticle.price) * 100)
            : 0;
          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100 }}
                onClick={() => setDetailArticle(null)}
              />
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                style={{
                  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
                  background: "#fff", borderRadius: "20px 20px 0 0",
                  maxHeight: "88vh", overflowY: "auto",
                  paddingBottom: 32,
                }}
                dir={isRTL ? "rtl" : "ltr"}
                onClick={e => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => setDetailArticle(null)}
                  style={{
                    position: "absolute", top: 12, insetInlineEnd: 14, zIndex: 10,
                    background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%",
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} color="#555" />
                </button>

                {/* ── Image Gallery / Slider ── */}
                <div style={{ position: "relative", background: "#f8f8f8", height: 240, overflow: "hidden", borderRadius: "20px 20px 0 0" }}>
                  {imgs.length > 0 ? (
                    <>
                      <motion.img
                        key={detailImgIdx}
                        initial={{ opacity: 0, scale: 1.03 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        src={imgs[detailImgIdx]}
                        alt={lang === "ar" ? detailArticle.nameAr : detailArticle.nameFr}
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }}
                      />
                      {/* Nav arrows */}
                      {imgs.length > 1 && (
                        <>
                          <button
                            onClick={() => setDetailImgIdx(i => (i - 1 + imgs.length) % imgs.length)}
                            style={{
                              position: "absolute", top: "50%", insetInlineStart: 10, transform: "translateY(-50%)",
                              background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%",
                              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                            }}
                          >
                            {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                          </button>
                          <button
                            onClick={() => setDetailImgIdx(i => (i + 1) % imgs.length)}
                            style={{
                              position: "absolute", top: "50%", insetInlineEnd: 10, transform: "translateY(-50%)",
                              background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%",
                              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                            }}
                          >
                            {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                          </button>
                          {/* Dots */}
                          <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
                            {imgs.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setDetailImgIdx(i)}
                                style={{
                                  width: i === detailImgIdx ? 18 : 6, height: 6,
                                  borderRadius: 3, border: "none",
                                  background: i === detailImgIdx ? "#1A4D1F" : "rgba(0,0,0,0.2)",
                                  cursor: "pointer", transition: "all 0.2s",
                                  padding: 0,
                                }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      {/* Thumbnail strip */}
                      {imgs.length > 1 && (
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", gap: 4, padding: "0 10px 26px", overflowX: "auto", scrollbarWidth: "none" }}>
                          {imgs.map((src, i) => (
                            <button
                              key={i}
                              onClick={() => setDetailImgIdx(i)}
                              style={{
                                flexShrink: 0, width: 38, height: 38, borderRadius: 8, overflow: "hidden",
                                border: `2px solid ${i === detailImgIdx ? "#1A4D1F" : "transparent"}`,
                                background: "#fff", padding: 0, cursor: "pointer",
                              }}
                            >
                              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package size={52} color="#ddd" />
                    </div>
                  )}

                  {/* Discount badge */}
                  {hasSale && (
                    <div style={{
                      position: "absolute", top: 12, insetInlineStart: 12,
                      background: "#e53935", color: "#fff", fontSize: 11, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 6,
                    }}>
                      -{discountPct}%
                    </div>
                  )}
                </div>

                {/* ── Info section ── */}
                <div style={{ padding: "16px 18px 0" }}>
                  <h2 style={{
                    fontSize: 17, fontWeight: 800, color: "#111", margin: "0 0 4px",
                    fontFamily: "'Cairo','Tajawal',sans-serif",
                  }}>
                    {lang === "ar" ? detailArticle.nameAr : detailArticle.nameFr}
                  </h2>

                  {detailArticle.descriptionAr && (
                    <p style={{ fontSize: 12, color: "#777", margin: "0 0 12px", fontFamily: "'Cairo','Tajawal',sans-serif", lineHeight: 1.5 }}>
                      {lang === "ar" ? detailArticle.descriptionAr : detailArticle.descriptionFr || detailArticle.descriptionAr}
                    </p>
                  )}

                  {/* Price row */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "#1A4D1F" }}>
                      {formatPrice(detailArticle.price)}
                    </span>
                    {hasSale && (
                      <span style={{ fontSize: 13, color: "#bbb", textDecoration: "line-through" }}>
                        {formatPrice(detailArticle.originalPrice!)}
                      </span>
                    )}
                  </div>

                  {/* Cart controls */}
                  {qty === 0 ? (
                    <button
                      onClick={() => { handleAdd(detailArticle); }}
                      style={{
                        width: "100%", padding: "14px 0", borderRadius: 16,
                        background: "#1A4D1F", color: "#fff", border: "none",
                        fontSize: 15, fontWeight: 800, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        fontFamily: "'Cairo','Tajawal',sans-serif",
                        boxShadow: "0 4px 14px rgba(26,77,31,0.3)",
                      }}
                    >
                      <ShoppingCart size={18} />
                      {t("أضف للسلة", "Ajouter au panier")}
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                      <button
                        onClick={() => updateQty(detailArticle.id, qty - 1)}
                        style={{
                          width: 44, height: 44, borderRadius: "50%",
                          background: "#f0f0f0", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Minus size={18} />
                      </button>
                      <span style={{ fontSize: 20, fontWeight: 900, minWidth: 32, textAlign: "center", color: "#1A4D1F" }}>{qty}</span>
                      <button
                        onClick={() => updateQty(detailArticle.id, qty + 1)}
                        style={{
                          width: 44, height: 44, borderRadius: "50%",
                          background: "#1A4D1F", border: "none", color: "#fff", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(26,77,31,0.3)",
                        }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Reviews section ── */}
                <ProductReviews
                  articleId={detailArticle.id}
                  supplierId={detailArticle.supplierId}
                  lang={lang}
                />
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </Layout>
  );
}
