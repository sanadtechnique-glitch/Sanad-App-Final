import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { useCart, WEIGHTED_STEP } from "@/lib/cart";
import {
  Plus, Minus, Trash2, ShoppingCart, ArrowLeft, ArrowRight,
  ShoppingBag, PackageOpen,
} from "lucide-react";

function formatPrice(n: number) {
  return n.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " DT";
}

export default function CartPage() {
  const { t, isRTL } = useLang();
  const { cart, itemCount, updateQty, removeItem } = useCart();
  const [, navigate] = useLocation();

  const [removing, setRemoving] = useState<number | null>(null);

  const subtotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasItems = cart.items.length > 0 && cart.supplierId !== null;

  const handleRemove = (id: number) => {
    setRemoving(id);
    setTimeout(() => {
      removeItem(id);
      setRemoving(null);
    }, 280);
  };

  const handleCheckout = () => {
    if (cart.supplierId) navigate(`/order/${cart.supplierId}`);
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <Layout>
      <div className="min-h-screen bg-white" dir={isRTL ? "rtl" : "ltr"}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-30 bg-white border-b border-[#1A4D1F]/10 px-4 py-3 flex items-center gap-3"
        >
          <button
            onClick={() => navigate(-1 as never)}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#1A4D1F]/8 transition-colors text-[#1A4D1F]"
          >
            <BackIcon size={20} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-[#1A4D1F] leading-tight">
              {t("سلة التسوق", "Panier")}
            </h1>
            {hasItems && (
              <p className="text-[11px] text-[#1A4D1F]/50 font-semibold">
                {t(`من: ${cart.supplierName}`, `Chez : ${cart.supplierName}`)}
              </p>
            )}
          </div>
          {hasItems && (
            <span className="px-2.5 py-1 rounded-full text-xs font-black"
              style={{ background: "rgba(26,77,31,0.08)", color: "#1A4D1F" }}>
              {itemCount} {t("عنصر", "article")}
            </span>
          )}
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!hasItems ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center gap-5 px-8 py-24 text-center"
          >
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(26,77,31,0.06)" }}
            >
              <PackageOpen size={44} strokeWidth={1.4} color="#1A4D1F" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-[#1A4D1F]">
                {t("سلتك فارغة!", "Votre panier est vide !")}
              </h2>
              <p className="text-sm text-[#1A4D1F]/55 font-medium leading-relaxed max-w-[240px] mx-auto">
                {t(
                  "أضف بعض المنتجات من المتاجر لتبدأ طلبك",
                  "Ajoutez des articles depuis nos boutiques pour commencer",
                )}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/services")}
              className="mt-2 px-6 py-3 rounded-2xl font-black text-white text-sm flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#1A4D1F,#2E7D32)" }}
            >
              <ShoppingBag size={16} />
              {t("تصفح الخدمات", "Découvrir les services")}
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* ── Item list ───────────────────────────────────────────────── */}
            <div className="px-4 pt-4 pb-2 space-y-3">
              <AnimatePresence initial={false}>
                {cart.items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: removing === item.id ? 0 : 1, x: removing === item.id ? (isRTL ? 60 : -60) : 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="flex items-center gap-3 rounded-2xl p-3 border border-[#1A4D1F]/8"
                    style={{ background: "#FAFFF8" }}
                  >
                    {/* Product image */}
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[#1A4D1F]/10"
                      style={{ background: "rgba(26,77,31,0.04)" }}
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingCart size={20} color="#1A4D1F" strokeWidth={1.5} opacity={0.3} />
                        </div>
                      )}
                    </div>

                    {/* Info + controls */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#1A4D1F] truncate leading-tight">
                        {item.nameAr || item.name}
                      </p>
                      <p className="text-xs font-bold text-[#FFA500] mt-0.5">
                        {formatPrice(item.price)}
                      </p>
                      <p className="text-[10px] text-[#1A4D1F]/40 font-medium mt-0.5">
                        {t("الإجمالي","Total")} : {formatPrice(item.price * item.qty)}
                      </p>
                    </div>

                    {/* Qty controls */}
                    {(() => {
                      const step    = item.isWeighted ? WEIGHTED_STEP : 1;
                      const isMin   = item.qty <= step;
                      const newMinus = Math.round((item.qty - step) * 1000) / 1000;
                      const newPlus  = Math.round((item.qty + step) * 1000) / 1000;
                      const qtyLabel = item.isWeighted
                        ? `${item.qty.toFixed(2)} kg`
                        : `${item.qty}`;
                      return (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <motion.button
                            whileTap={{ scale: 0.88 }}
                            onClick={() => isMin ? handleRemove(item.id) : updateQty(item.id, newMinus)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              background: isMin ? "rgba(239,68,68,0.1)" : "rgba(26,77,31,0.08)",
                              color: isMin ? "#ef4444" : "#1A4D1F",
                            }}
                          >
                            {isMin
                              ? <Trash2 size={13} strokeWidth={2.5} />
                              : <Minus size={13} strokeWidth={2.5} />}
                          </motion.button>

                          <span className="text-center text-xs font-black text-[#1A4D1F]"
                            style={{ minWidth: item.isWeighted ? 44 : 16 }}>
                            {qtyLabel}
                          </span>

                          <motion.button
                            whileTap={{ scale: 0.88 }}
                            onClick={() => updateQty(item.id, newPlus)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: "rgba(26,77,31,0.08)", color: "#1A4D1F" }}
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </motion.button>
                        </div>
                      );
                    })()}

                    {/* Delete button */}
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => handleRemove(item.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* ── Subtotal card ────────────────────────────────────────────── */}
            <div className="px-4 pt-2 pb-4">
              <div
                className="rounded-2xl p-4 border border-[#1A4D1F]/12"
                style={{ background: "rgba(26,77,31,0.03)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[#1A4D1F]/60">
                    {t(`المنتجات (${itemCount})`, `Articles (${itemCount})`)}
                  </span>
                  <span className="text-sm font-black text-[#1A4D1F]">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#1A4D1F]/10">
                  <span className="text-xs font-medium text-[#1A4D1F]/40">
                    {t("رسوم التوصيل", "Frais de livraison")}
                  </span>
                  <span className="text-xs font-bold text-[#1A4D1F]/40 italic">
                    {t("تُحسب عند التأكيد", "Calculé à la confirmation")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-[#1A4D1F]">
                    {t("مجموع المنتجات", "Sous-total")}
                  </span>
                  <motion.span
                    key={subtotal}
                    initial={{ scale: 1.15, color: "#FFA500" }}
                    animate={{ scale: 1, color: "#1A4D1F" }}
                    transition={{ duration: 0.35 }}
                    className="text-xl font-black"
                  >
                    {formatPrice(subtotal)}
                  </motion.span>
                </div>
              </div>
            </div>

            {/* ── Checkout button (sticky bottom) ──────────────────────────── */}
            <div
              className="sticky bottom-0 bg-white border-t border-[#1A4D1F]/10 px-4 py-4"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCheckout}
                className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2.5"
                style={{ background: "linear-gradient(135deg,#1A4D1F 0%,#2E7D32 100%)" }}
              >
                <ShoppingCart size={18} strokeWidth={2.5} />
                {t("أكمل الطلب ←", "Passer la commande →")}
              </motion.button>
              <p className="text-center text-[10px] text-[#1A4D1F]/35 font-medium mt-2">
                {t(
                  "ستُحدَّد رسوم التوصيل بعد تأكيد موقعك",
                  "Les frais de livraison seront calculés après confirmation de votre position",
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
