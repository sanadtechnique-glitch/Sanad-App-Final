import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Grid, ShoppingCart, Plus, Minus, Trash2, X, LogOut, Bell, CheckCheck, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { getSession, clearSession } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { motion, AnimatePresence } from "framer-motion";

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-[#66BB6A]/8 border border-[#66BB6A]/12">
      <button
        onClick={() => setLang("ar")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "ar"
            ? "bg-[#66BB6A] text-black shadow-[0_0_10px_rgba(102,187,106,0.4)]"
            : "text-[#66BB6A]/50 hover:text-[#66BB6A]"
        )}
      >AR</button>
      <button
        onClick={() => setLang("fr")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "fr"
            ? "bg-[#66BB6A] text-black shadow-[0_0_10px_rgba(102,187,106,0.4)]"
            : "text-[#66BB6A]/50 hover:text-[#66BB6A]"
        )}
      >FR</button>
    </div>
  );
}

function CartButton({ onClick, large }: { onClick: () => void; large?: boolean }) {
  const { itemCount, total } = useCart();
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-xl border border-[#66BB6A]/40 bg-[#66BB6A]/15 hover:bg-[#66BB6A]/25 transition-all group",
        large ? "px-4 py-2.5" : "p-2"
      )}
    >
      <ShoppingCart size={large ? 20 : 19} className="text-[#66BB6A] group-hover:scale-110 transition-transform" />
      {large && itemCount > 0 && (
        <span className="text-[#66BB6A] font-black text-sm">
          {total.toFixed(2)} <span className="text-[10px] font-bold text-[#66BB6A]/60">DT</span>
        </span>
      )}
      {itemCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
          style={{ background: "#66BB6A" }}
        >
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      )}
    </button>
  );
}

function NotificationBell() {
  const { lang } = useLang();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const timeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
    if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
    if (diff < 1440) return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
    return lang === "ar" ? `${Math.floor(diff / 1440)} ي` : `${Math.floor(diff / 1440)}j`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markAllRead(); }}
        className={cn(
          "relative p-2.5 rounded-xl border transition-all",
          unreadCount > 0
            ? "border-[#66BB6A]/50 bg-[#66BB6A]/20 hover:bg-[#66BB6A]/30"
            : "border-[#66BB6A]/10 bg-[#66BB6A]/5 hover:bg-[#66BB6A]/10"
        )}
      >
        <Bell size={18} className={unreadCount > 0 ? "text-[#66BB6A]" : "text-[#66BB6A]/40"} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
            style={{ background: "#66BB6A" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-80 rounded-2xl shadow-2xl border z-[80] overflow-hidden"
            style={{
              background: "#FF8C00",
              borderColor: "rgba(102,187,106,0.3)",
              insetInlineEnd: 0,
            }}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#66BB6A]/8">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-[#66BB6A]" />
                <span className="font-black text-[#66BB6A] text-sm">
                  {lang === "ar" ? "الإشعارات" : "Notifications"}
                </span>
                {notifications.length > 0 && (
                  <span className="text-[10px] font-bold text-[#66BB6A]/40">({notifications.length})</span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] font-bold text-red-400/60 hover:text-red-400 transition-colors"
                >
                  {lang === "ar" ? "مسح الكل" : "Effacer"}
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#66BB6A]/5 border border-[#66BB6A]/8 flex items-center justify-center">
                    <Bell size={20} className="text-[#66BB6A]/20" />
                  </div>
                  <p className="text-[#66BB6A]/30 text-sm font-bold text-center">
                    {lang === "ar" ? "لا توجد إشعارات" : "Aucune notification"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#66BB6A]/5">
                  {notifications.map(n => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "px-4 py-3 flex items-start gap-3 transition-colors",
                        !n.read ? "bg-[#66BB6A]/8" : ""
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                        n.type === "accepted" ? "bg-blue-400/15 border border-blue-400/20" : "bg-emerald-400/15 border border-emerald-400/20"
                      )}>
                        {n.type === "accepted"
                          ? <CheckCheck size={15} className="text-blue-400" />
                          : <Bike size={15} className="text-emerald-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#66BB6A] leading-snug">
                          {lang === "ar" ? n.messageAr : n.messageFr}
                        </p>
                        <p className="text-[10px] text-[#66BB6A]/30 mt-0.5">{timeAgo(n.timestamp)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#66BB6A] flex-shrink-0 mt-1.5" />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-[#66BB6A]/5 text-center">
                <p className="text-[10px] text-[#66BB6A]/25">
                  {lang === "ar" ? "إشعارات حالة طلباتك" : "Statut de vos commandes"}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, isRTL } = useLang();
  const { cart, removeItem, updateQty, clearCart, itemCount } = useCart();
  const [, navigate] = useLocation();
  const session = getSession();

  const subTotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = (session?.role === "client" && session?.delegationFee !== undefined && session.delegationFee > 0)
    ? session.delegationFee
    : cart.deliveryFee;
  const total = subTotal + deliveryFee;

  const placeOrder = () => {
    if (!cart.supplierId || cart.items.length === 0) return;
    const lines = cart.items
      .map(i => `${lang === "ar" ? i.nameAr : i.name} x${i.qty} — ${(i.price * i.qty).toFixed(2)} DT`)
      .join("\n");
    const notes = encodeURIComponent(
      `🛒 ${t("المنتجات", "Produits")}:\n${lines}\n\n💰 ${t("المجموع", "Sous-total")}: ${subTotal.toFixed(2)} DT\n🚗 ${t("التوصيل", "Livraison")}: ${deliveryFee.toFixed(2)} DT\n✅ ${t("الإجمالي", "Total")}: ${total.toFixed(2)} DT`
    );
    onClose();
    navigate(`/order/${cart.supplierId}?notes=${notes}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#FF8C00]/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: isRTL ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cn("fixed top-0 h-full w-full max-w-sm z-[70] flex flex-col", isRTL ? "left-0" : "right-0")}
            style={{
              background: "#FF8C00",
              borderLeft:  isRTL ? "none" : "2px solid #66BB6A",
              borderRight: isRTL ? "2px solid #66BB6A" : "none",
            }}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#66BB6A]/20">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#66BB6A]" />
                <h2 className="font-black text-[#66BB6A] text-lg">{t("سلة التسوق", "Mon Panier")}</h2>
                {itemCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black text-black" style={{ background: "#66BB6A" }}>
                    {itemCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {itemCount > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded-lg border border-red-400/20 hover:bg-red-400/10 transition-all"
                  >
                    {t("إفراغ", "Vider")}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-[#66BB6A]/40 hover:text-[#66BB6A] border border-[#66BB6A]/10 hover:bg-[#66BB6A]/5 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Supplier tag */}
            {cart.supplierName && (
              <div className="px-5 py-2 border-b border-[#66BB6A]/5">
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
                  <p className="text-[#66BB6A]/30 font-bold text-center">{t("السلة فارغة", "Panier vide")}</p>
                </div>
              ) : (
                cart.items.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    className="rounded-[12px] border border-[#66BB6A]/20 p-3 flex items-center gap-3"
                    style={{ background: "#FFFDE7" }}
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 rounded-lg object-cover border border-[#66BB6A]/30 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#66BB6A] text-sm truncate">
                        {lang === "ar" ? item.nameAr : item.name}
                      </p>
                      <p className="text-[#66BB6A] font-bold text-sm mt-0.5">{(item.price * item.qty).toFixed(2)} DT</p>
                      <p className="text-[#66BB6A]/30 text-xs">{item.price.toFixed(2)} DT × {item.qty}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#66BB6A]/30 bg-[#66BB6A]/10 hover:bg-[#66BB6A]/20 text-[#66BB6A] transition-all"
                      >
                        <Plus size={12} />
                      </button>
                      <span className="text-[#66BB6A] font-black text-sm">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 text-red-400 transition-all"
                      >
                        <Minus size={12} />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer — total + order */}
            {cart.items.length > 0 && (
              <div className="p-4 border-t border-[#66BB6A]/20 space-y-3">
                <div className="rounded-[12px] p-3 space-y-2 border border-[#66BB6A]/20" style={{ background: "#FFFDE7" }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#66BB6A]/50">{t("المنتجات", "Produits")}</span>
                    <span className="text-[#66BB6A] font-bold">{subTotal.toFixed(2)} DT</span>
                  </div>
                  {/* Delegation-based delivery fee */}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#66BB6A]/50 flex items-center gap-1">
                      {t("التوصيل", "Livraison")}
                      {session?.delegationName && (
                        <span className="text-[10px] text-[#66BB6A]/70 font-bold px-1.5 py-0.5 rounded-full bg-[#66BB6A]/10">
                          {session.delegationName}
                        </span>
                      )}
                    </span>
                    <span className="text-[#66BB6A] font-bold">{deliveryFee.toFixed(2)} DT</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#66BB6A]/30">
                    <span className="font-black text-[#66BB6A]">{t("الإجمالي", "Total")}</span>
                    <span className="font-black text-xl" style={{ color: "#66BB6A" }}>{total.toFixed(2)} DT</span>
                  </div>
                </div>
                <button
                  onClick={placeOrder}
                  className="w-full py-3.5 rounded-[12px] font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #FF8C00, #FFD700)", color: "#66BB6A", textShadow: "0 1px 2px rgba(0,0,0,0.12)", boxShadow: "0 4px 16px rgba(255,140,0,0.35)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "linear-gradient(135deg, #FFD700, #FF8C00)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(135deg, #FF8C00, #FFD700)")}
                >
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
  const [location, navigate] = useLocation();
  const { t, isRTL } = useLang();
  const [cartOpen, setCartOpen] = useState(false);
  const session = getSession();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const navItems = [
    { href: "/",         icon: Home, label: t("الرئيسية", "Accueil")  },
    { href: "/services", icon: Grid, label: t("الخدمات",  "Services") },
  ];

  return (
    <div
      className={cn(
        "min-h-screen bg-background flex flex-col relative",
        isRTL ? "md:pr-20" : "md:pl-20"
      )}
    >
      {/* ── Desktop Sidebar (navigation icons only) ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed top-0 h-screen w-20 z-50 py-6 items-center justify-between",
          isRTL
            ? "right-0 border-l-2 border-l-[#66BB6A]"
            : "left-0 border-r-2 border-r-[#66BB6A]"
        )}
        style={{ background: "#FF8C00" }}
      >
        {/* Logo */}
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#FFFDE7] border border-[#66BB6A]/20 shadow-[0_0_14px_-4px_rgba(255,140,0,0.5)] flex items-center justify-center">
          <img src="/logo.png" alt="سند" className="w-full h-full object-contain p-0.5" draggable={false} />
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col gap-7">
          {navItems.map(item => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-all duration-300",
                    isActive
                      ? "bg-[#66BB6A] text-black shadow-[0_0_14px_rgba(102,187,106,0.45)]"
                      : "text-[#66BB6A]/40 group-hover:text-[#66BB6A] group-hover:bg-[#66BB6A]/10"
                  )}
                >
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold transition-colors duration-300 text-center",
                    isActive ? "text-[#66BB6A]" : "text-[#66BB6A]/40 group-hover:text-[#66BB6A]"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        {session && (
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-[#66BB6A]/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
            title={t("تسجيل الخروج", "Déconnexion")}
          >
            <LogOut size={18} />
          </button>
        )}
      </aside>

      {/* ── Desktop Top Header (sticky) ── */}
      <header
        className={cn(
          "hidden md:flex items-center justify-between px-6 py-3 sticky top-0 z-40 border-b-2 border-[#66BB6A]",
          isRTL ? "md:pr-24" : "md:pl-24"
        )}
        style={{ background: "#FF8C00" }}
      >
        {/* Greeting + session name */}
        <div className="flex items-center gap-3" dir={isRTL ? "rtl" : "ltr"}>
          {session && (
            <span className="text-[#66BB6A]/60 text-sm font-bold">
              {t("أهلاً،", "Bonjour,")} <span className="text-[#66BB6A]">{session.name}</span>
            </span>
          )}
        </div>

        {/* Cart + Notifications + Lang */}
        <div className="flex items-center gap-3">
          <CartButton onClick={() => setCartOpen(true)} large />
          <NotificationBell />
          <LangToggle />
        </div>
      </header>

      {/* ── Mobile Top Bar ── */}
      <header
        className="md:hidden flex items-center justify-between px-4 pt-4 pb-3 border-b-2 border-[#66BB6A] sticky top-0 z-50"
        style={{ background: "#FF8C00" }}
      >
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#FFFDE7] border border-[#66BB6A]/20 flex items-center justify-center shadow-[0_0_10px_-3px_rgba(255,140,0,0.45)]">
          <img src="/logo.png" alt="سند" className="w-full h-full object-contain p-0.5" draggable={false} />
        </div>
        <div className="flex items-center gap-2">
          <CartButton onClick={() => setCartOpen(true)} large />
          <NotificationBell />
          <LangToggle />
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto pb-20 md:pb-4">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 w-full border-t-2 border-[#FFD700] px-6 py-3 z-50 flex justify-around items-center rounded-t-2xl"
        style={{ background: "#FF8C00" }}
      >
        {navItems.map(item => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 w-16"
            >
              <div
                className={cn(
                  "relative p-2 rounded-xl transition-all duration-300",
                  isActive ? "text-[#66BB6A]" : "text-[#66BB6A]/40"
                )}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-[#66BB6A]/20 rounded-xl blur-sm" />
                )}
                <item.icon
                  className="w-6 h-6 relative z-10"
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  isActive ? "text-[#66BB6A]" : "text-[#66BB6A]/40"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        {/* Mobile logout */}
        {session && (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 w-16"
          >
            <div className="p-2 rounded-xl text-[#66BB6A]/30 hover:text-red-400 transition-all">
              <LogOut className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-[#66BB6A]/30">
              {t("خروج", "Sortir")}
            </span>
          </button>
        )}
      </nav>

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
