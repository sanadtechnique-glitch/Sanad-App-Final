import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
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
  const { addItem, updateQty, cart } = useCart();
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
        <div style={{ background: "#FFFFFF", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid black", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      </Layout>
    );
  }

  if (!supplier) {
    return (
      <Layout>
        <div style={{ background: "#FFFFFF", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#000", fontWeight: 900, marginBottom: 16 }}>{t("المزود غير موجود", "Fournisseur introuvable")}</p>
            <Link href="/services">
              <button className="neubrutal-btn" style={{ padding: "8px 24px", fontSize: 13 }}>{t("العودة", "Retour")}</button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* ── PAGE WRAPPER — pure white background ── */}
      <div style={{ background: "#FFFFFF", minHeight: "100vh" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 120px" }} dir={isRTL ? "rtl" : "ltr"}>

          {/* Back button */}
          <Link href={supplier.category ? `/services?category=${supplier.category}` : "/services"}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", fontWeight: 900, fontSize: 13, color: "#000", marginBottom: 20, cursor: "pointer" }}>
              {isRTL ? <ChevronLeft size={15} /> : <ArrowRight size={15} style={{ transform: "rotate(180deg)" }} />}
              {t("العودة للخدمات", "Retour aux services")}
            </button>
          </Link>

          {/* ── Supplier header card ── */}
          <div className="neubrutal" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", border: "3px solid black",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0, background: "#fff",
            }}>
              {supplier.photoUrl
                ? <img src={supplier.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Package size={24} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 17, fontWeight: 900, color: "#000", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lang === "ar" ? supplier.nameAr : supplier.name}
              </h1>
              {supplier.rating && (
                <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={11} style={{ color: i <= Math.round(supplier.rating!) ? "#166534" : "#ccc", fill: i <= Math.round(supplier.rating!) ? "#166534" : "none" }} />
                  ))}
                  <span style={{ fontSize: 10, color: "#555", marginRight: 4 }}>{supplier.rating.toFixed(1)}</span>
                </div>
              )}
              <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lang === "ar" ? supplier.descriptionAr : supplier.description}
              </p>
            </div>
          </div>

          {/* Ad Carousel */}
          <div style={{ marginBottom: 20 }}>
            <AdCarousel supplierId={parseInt(id!)} height={90} />
          </div>

          {/* Section title */}
          {articles.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, borderBottom: "3px solid black", paddingBottom: 8 }}>
              <span style={{ width: 4, height: 22, background: "#000", display: "block", borderRadius: 2 }} />
              <h2 style={{ fontSize: 16, fontWeight: 900, color: "#000", margin: 0 }}>
                {t("المنتجات المتاحة", "Produits disponibles")}
              </h2>
              <span style={{ fontSize: 11, fontWeight: 900, border: "2px solid black", padding: "0 6px", borderRadius: 4 }}>
                {articles.length}
              </span>
            </div>
          )}

          {/* ══ PRODUCT GRID — 2 columns, full neubrutal ══ */}
          {articles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Package size={48} style={{ color: "#ccc", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 900, color: "#888" }}>{t("لا توجد منتجات متاحة حالياً", "Aucun produit disponible")}</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {articles.map((article) => {
                const qty = getQty(article.id);
                const imgs = getImages(article);
                const hasSale = !!(article.originalPrice && article.originalPrice > article.price);
                const discountPct = hasSale
                  ? Math.round(((article.originalPrice! - article.price) / article.originalPrice!) * 100)
                  : 0;

                return (
                  <div
                    key={article.id}
                    className="neubrutal"
                    style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
                  >
                    {/* ── Image area — transparent bg, object-contain ── */}
                    <div style={{ height: 130, background: "transparent", borderBottom: "3px solid black", position: "relative", overflow: "hidden" }}>
                      {imgs.length > 0 ? (
                        <ImageGallery
                          images={imgs}
                          alt={lang === "ar" ? article.nameAr : article.nameFr}
                          aspectRatio="none"
                          objectFit="contain"
                          className="h-full !bg-transparent"
                          showDots={false}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Package size={34} style={{ color: "#ccc" }} />
                        </div>
                      )}
                      {hasSale && (
                        <div style={{
                          position: "absolute", top: 6, insetInlineStart: 6, zIndex: 20,
                          background: "#000", color: "#fff", fontSize: 9, fontWeight: 900,
                          padding: "2px 6px", border: "2px solid black",
                        }}>
                          -{discountPct}%
                        </div>
                      )}
                      {qty > 0 && (
                        <div style={{
                          position: "absolute", top: 6, insetInlineEnd: 6, zIndex: 20,
                          width: 22, height: 22, background: "#000", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 900, border: "2px solid black",
                        }}>
                          {qty}
                        </div>
                      )}
                    </div>

                    {/* ── Info + action area ── */}
                    <div style={{ padding: "10px 10px 10px", display: "flex", flexDirection: "column", flex: 1, gap: 8 }} dir="rtl">
                      <p style={{ fontSize: 12, fontWeight: 900, color: "#000", lineHeight: 1.35, margin: 0,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {lang === "ar" ? article.nameAr : article.nameFr}
                      </p>

                      <div style={{ marginTop: "auto" }}>
                        {/* Price row */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: "#166534" }}>
                            {article.price.toFixed(2)} DT
                          </span>
                          {hasSale && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#999", textDecoration: "line-through" }}>
                              {article.originalPrice!.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Qty controls or Add button */}
                        {qty > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              className="neubrutal-btn"
                              onClick={() => updateQty(article.id, qty - 1)}
                              style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                            >
                              <Minus size={11} />
                            </button>
                            <span style={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: 14, color: "#000" }}>{qty}</span>
                            <button
                              className="neubrutal-btn"
                              onClick={() => updateQty(article.id, qty + 1)}
                              style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="neubrutal-btn-black"
                            onClick={() => handleAdd(article)}
                            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0", fontSize: 11 }}
                          >
                            <Plus size={11} />
                            {t("أضف للسلة", "Ajouter")}
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
