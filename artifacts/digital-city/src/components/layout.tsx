import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Grid, ShoppingCart, Plus, Minus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { motion, AnimatePresence } from "framer-motion";

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-[#004D40]/5 border border-[#004D40]/10">
      <button
        onClick={() => setLang("ar")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "ar"
            ? "bg-[#66BB6A] text-black shadow-[0_0_10px_rgba(102,187,106,0.4)]"
            : "text-[#004D40]/50 hover:text-[#004D40]"
        )}
      >AR</button>
      <button
        onClick={() => setLang("fr")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "fr"
            ? "bg-[#66BB6A] text-black shadow-[0_0_10px_rgba(102,187,106,0.4)]"
            : "text-[#004D40]/50 hover:text-[#004D40]"
        )}
      >FR</button>
    </div>
  );
}

function CartButton({ onClick }: { onClick: () => void }) {
  const { itemCount } = useCart();
  return (
    <button onClick={onClick}
      className="relative p-2 rounded-xl border border-[#66BB6A]/30 bg-[#66BB6A]/10 hover:bg-[#66BB6A]/20 transition-all">
      <ShoppingCart size={20} className="text-[#66BB6A]" />
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
          style={{ background: "#66BB6A" }}>
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      )}
    </button>
  );
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, isRTL } = useLang();
  const { cart, removeItem, updateQty, clearCart, total, itemCount } = useCart();
  const [, navigate] = useLocation();

  const placeOrder = () => {
    if (!cart.supplierId || cart.items.length === 0) return;
    const lines = cart.items.map(i =>
      `${lang === "ar" ? i.nameAr : i.name} x${i.qty} — ${(i.price * i.qty).toFixed(2)} DT`
    ).join("\n");
    const subTotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
    const notes = encodeURIComponent(
      `🛒 ${t("المنتجات", "Produits")}:\n${lines}\n\n💰 ${t("المجموع", "Sous-total")}: ${subTotal.toFixed(2)} DT\n🚗 ${t("التوصيل", "Livraison")}: ${cart.deliveryFee.toFixed(2)} DT\n✅ ${t("الإجمالي", "Total")}: ${total.toFixed(2)} DT`
    );
    onClose();
    navigate(`/order/${cart.supplierId}?notes=${notes}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#E1AD01]/70 z-[60]" onClick={onClose} />
          <motion.div
            initial={{ x: isRTL ? "-100%" : "100%" }} animate={{ x: 0 }} exit={{ x: isRTL ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cn("fixed top-0 h-full w-full max-w-sm z-[70] flex flex-col", isRTL ? "left-0" : "right-0")}
            style={{ background: "#C99900", borderLeft: isRTL ? "none" : "2px solid #66BB6A", borderRight: isRTL ? "2px solid #66BB6A" : "none" }}
            dir={isRTL ? "rtl" : "ltr"}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#66BB6A]/20">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#66BB6A]" />
                <h2 className="font-black text-[#004D40] text-lg">{t("سلة التسوق", "Mon Panier")}</h2>
                {itemCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black text-black" style={{ background: "#66BB6A" }}>
                    {itemCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {itemCount > 0 && (
                  <button onClick={clearCart}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-lg border border-red-400/20 hover:bg-red-400/10 transition-all">
                    {t("إفراغ", "Vider")}
                  </button>
                )}
                <button onClick={onClose}
                  className="p-2 rounded-xl text-[#004D40]/40 hover:text-[#004D40] border border-[#004D40]/10 hover:bg-[#004D40]/5 transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Supplier tag */}
            {cart.supplierName && (
              <div className="px-5 py-2 border-b border-[#004D40]/5">
                <p className="text-xs text-[#66BB6A]/60 font-bold">{cart.supplierName}</p>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <div className="w-16 h-16 rounded-2xl bg-[#66BB6A]/10 border border-[#66BB6A]/20 flex items-center justify-center">
                    <ShoppingCart size={28} className="text-[#66BB6A]/40" />
                  </div>
                  <p className="text-[#004D40]/30 font-bold text-center">{t("السلة فارغة", "Panier vide")}</p>
                </div>
              ) : cart.items.map(item => (
                <motion.div key={item.id} layout
                  className="rounded-[12px] border border-[#66BB6A]/20 p-3 flex items-center gap-3"
                  style={{ background: "#D4A800" }}>
                  {item.image && (
                    <img src={item.image} alt={item.name}
                      className="w-14 h-14 rounded-lg object-cover border border-[#66BB6A]/30 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[#004D40] text-sm truncate">{lang === "ar" ? item.nameAr : item.name}</p>
                    <p className="text-[#66BB6A] font-bold text-sm mt-0.5">{(item.price * item.qty).toFixed(2)} DT</p>
                    <p className="text-[#004D40]/30 text-xs">{item.price.toFixed(2)} DT × {item.qty}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button onClick={() => updateQty(item.id, item.qty + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#66BB6A]/30 bg-[#66BB6A]/10 hover:bg-[#66BB6A]/20 text-[#66BB6A] transition-all">
                      <Plus size={12} />
                    </button>
                    <span className="text-[#004D40] font-black text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 text-red-400 transition-all">
                      <Minus size={12} />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.id)}
                    className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Footer — total + order */}
            {cart.items.length > 0 && (
              <div className="p-4 border-t border-[#66BB6A]/20 space-y-3">
                <div className="rounded-[12px] p-3 space-y-2 border border-[#66BB6A]/20" style={{ background: "#D4A800" }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#004D40]/50">{t("المنتجات", "Produits")}</span>
                    <span className="text-[#004D40] font-bold">
                      {cart.items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)} DT
                    </span>
                  </div>
                  {cart.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#004D40]/50">{t("التوصيل", "Livraison")}</span>
                      <span className="text-[#004D40] font-bold">{cart.deliveryFee.toFixed(2)} DT</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-[#66BB6A]/30">
                    <span className="font-black text-[#004D40]">{t("الإجمالي", "Total")}</span>
                    <span className="font-black text-lg" style={{ color: "#66BB6A" }}>{total.toFixed(2)} DT</span>
                  </div>
                </div>
                <button onClick={placeOrder}
                  className="w-full py-3.5 rounded-[12px] font-black text-black text-base flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: "#66BB6A" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#4CAF50")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#66BB6A")}>
                  <ShoppingCart size={18} />
                  {t("تأكيد الطلب", "Passer la commande")}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, isRTL } = useLang();
  const [cartOpen, setCartOpen] = useState(false);

  const navItems = [
    { href: "/",         icon: Home,         label: t("الرئيسية", "Accueil") },
    { href: "/services", icon: Grid,         label: t("الخدمات",  "Services") },
  ];

  return (
    <div className={cn("min-h-screen bg-background flex flex-col relative pb-20", isRTL ? "md:pb-0 md:pr-24" : "md:pb-0 md:pl-24")}>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn("hidden md:flex flex-col fixed top-0 h-screen w-24 z-50 py-8 items-center justify-between",
          isRTL ? "right-0 border-l-2 border-l-[#66BB6A]" : "left-0 border-r-2 border-r-[#66BB6A]")}
        style={{ background: "#C99900" }}>
        <div className="w-12 h-12 rounded-full bg-[#66BB6A]/20 flex items-center justify-center border border-[#66BB6A]/30 shadow-[0_0_20px_-5px_rgba(102,187,106,0.4)]">
          <span className="font-bold text-[#66BB6A] text-xl">DC</span>
        </div>
        <nav className="flex flex-col gap-8">
          {navItems.map(item => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className={cn("p-3 rounded-xl transition-all duration-300",
                  isActive ? "bg-[#66BB6A] text-black shadow-[0_0_15px_rgba(102,187,106,0.4)]" : "text-[#004D40]/40 group-hover:text-[#66BB6A] group-hover:bg-[#66BB6A]/10")}>
                  <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn("text-[10px] font-bold transition-colors duration-300 text-center",
                  isActive ? "text-[#66BB6A]" : "text-[#004D40]/40 group-hover:text-[#66BB6A]")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          {/* Cart button in desktop sidebar */}
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => setCartOpen(true)}
              className="relative p-3 rounded-xl text-[#004D40]/40 hover:text-[#66BB6A] hover:bg-[#66BB6A]/10 transition-all duration-300">
              <CartIcon />
            </button>
            <span className="text-[10px] font-bold text-[#004D40]/40">{t("السلة", "Panier")}</span>
          </div>
        </nav>
        <LangToggle />
      </aside>

      {/* ── Mobile Top Bar ── */}
      <header className="md:hidden flex items-center justify-between px-4 pt-4 pb-3 border-b-2 border-[#66BB6A] sticky top-0 z-50" style={{ background: "#C99900" }}>
        <div className="w-9 h-9 rounded-full bg-[#66BB6A]/20 flex items-center justify-center border border-[#66BB6A]/30">
          <span className="font-bold text-[#66BB6A] text-sm">DC</span>
        </div>
        <div className="flex items-center gap-3">
          <CartButton onClick={() => setCartOpen(true)} />
          <LangToggle />
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full border-t-2 border-[#66BB6A] px-6 py-3 z-50 flex justify-around items-center rounded-t-2xl" style={{ background: "#C99900" }}>
        {navItems.map(item => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center gap-1 w-16">
              <div className={cn("relative p-2 rounded-xl transition-all duration-300", isActive ? "text-[#66BB6A]" : "text-[#004D40]/40")}>
                {isActive && <span className="absolute inset-0 bg-[#66BB6A]/20 rounded-xl blur-sm" />}
                <item.icon className="w-6 h-6 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn("text-[10px] font-bold", isActive ? "text-[#66BB6A]" : "text-[#004D40]/40")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function CartIcon() {
  const { itemCount } = useCart();
  return (
    <div className="relative">
      <ShoppingCart className="w-6 h-6" strokeWidth={2} />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-black"
          style={{ background: "#66BB6A" }}>
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      )}
    </div>
  );
}
