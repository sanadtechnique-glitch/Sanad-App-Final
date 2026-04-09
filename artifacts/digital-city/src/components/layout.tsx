import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Home, Grid, ShoppingCart, Plus, Minus, Trash2, X, LogOut, Bell, CheckCheck, Bike, History, UserCircle, LogIn, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { useCart } from "@/lib/cart";
import { getSession, clearSession } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { motion, AnimatePresence } from "framer-motion";
import { AdBanner } from "@/components/ad-banner";
import { PhotoAdGallery } from "@/components/PhotoAdGallery";
import { useAppLogo } from "@/lib/useAppLogo";

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function getRoleBadge(role: string) {
  const map: Record<string, { ar: string; fr: string; bg: string; border: string }> = {
    super_admin: { ar: "مدير النظام", fr: "Super Admin",  bg: "#B91C1C", border: "#991B1B" },
    admin:       { ar: "مدير النظام", fr: "Admin",        bg: "#B91C1C", border: "#991B1B" },
    manager:     { ar: "مدير النظام", fr: "Gestionnaire", bg: "#B91C1C", border: "#991B1B" },
    provider:    { ar: "مزود",        fr: "Fournisseur",  bg: "#1A4D1F", border: "#0D3311" },
    delivery:    { ar: "سائق/موزع",   fr: "Livreur",      bg: "#1565C0", border: "#0D47A1" },
    driver:      { ar: "سائق/موزع",   fr: "Livreur",      bg: "#1565C0", border: "#0D47A1" },
    client:      { ar: "عميل",        fr: "Client",       bg: "#0D3311", border: "#1A4D1F" },
  };
  return map[role] ?? map.client;
}

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-[#1A4D1F]/8 border border-[#1A4D1F]/12">
      <button
        onClick={() => setLang("ar")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "ar"
            ? "bg-[#1A4D1F] text-black shadow-[0_0_10px_rgba(46,125,50,0.4)]"
            : "text-[#1A4D1F]/50 hover:text-[#1A4D1F]"
        )}
      >AR</button>
      <button
        onClick={() => setLang("fr")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "fr"
            ? "bg-[#1A4D1F] text-black shadow-[0_0_10px_rgba(46,125,50,0.4)]"
            : "text-[#1A4D1F]/50 hover:text-[#1A4D1F]"
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
        "relative flex items-center gap-2 rounded-xl border border-[#1A4D1F]/40 bg-[#1A4D1F]/15 hover:bg-[#1A4D1F]/25 transition-all group",
        large ? "px-4 py-2.5" : "p-2"
      )}
    >
      <ShoppingCart size={large ? 20 : 19} className="text-[#1A4D1F] group-hover:scale-110 transition-transform" />
      {large && itemCount > 0 && (
        <span className="text-[#1A4D1F] font-black text-sm">
          {total.toFixed(2)} <span className="text-[10px] font-bold text-[#1A4D1F]/60">DT</span>
        </span>
      )}
      {itemCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
          style={{ background: "#1A4D1F" }}
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
            ? "border-[#1A4D1F]/50 bg-[#1A4D1F]/20 hover:bg-[#1A4D1F]/30"
            : "border-[#1A4D1F]/10 bg-[#1A4D1F]/5 hover:bg-[#1A4D1F]/10"
        )}
      >
        <Bell size={18} className={unreadCount > 0 ? "text-[#1A4D1F]" : "text-[#1A4D1F]/40"} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
            style={{ background: "#1A4D1F" }}
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
              background: "#FFA500",
              borderColor: "rgba(46,125,50,0.3)",
              insetInlineEnd: 0,
            }}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A4D1F]/8">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-[#1A4D1F]" />
                <span className="font-black text-[#1A4D1F] text-sm">
                  {lang === "ar" ? "الإشعارات" : "Notifications"}
                </span>
                {notifications.length > 0 && (
                  <span className="text-[10px] font-bold text-[#1A4D1F]/40">({notifications.length})</span>
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
                  <div className="w-12 h-12 rounded-2xl bg-[#1A4D1F]/5 border border-[#1A4D1F]/8 flex items-center justify-center">
                    <Bell size={20} className="text-[#1A4D1F]/20" />
                  </div>
                  <p className="text-[#1A4D1F]/30 text-sm font-bold text-center">
                    {lang === "ar" ? "لا توجد إشعارات" : "Aucune notification"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#1A4D1F]/5">
                  {notifications.map(n => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "px-4 py-3 flex items-start gap-3 transition-colors",
                        !n.read ? "bg-[#1A4D1F]/8" : ""
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
                        <p className="text-sm font-bold text-[#1A4D1F] leading-snug">
                          {lang === "ar" ? n.messageAr : n.messageFr}
                        </p>
                        <p className="text-[10px] text-[#1A4D1F]/30 mt-0.5">{timeAgo(n.timestamp)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#1A4D1F] flex-shrink-0 mt-1.5" />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-[#1A4D1F]/5 text-center">
                <p className="text-[10px] text-[#1A4D1F]/25">
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
            className="fixed inset-0 bg-[#FFA500]/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: isRTL ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cn("fixed top-0 h-full w-full max-w-sm z-[70] flex flex-col", isRTL ? "left-0" : "right-0")}
            style={{
              background: "#FFA500",
              borderLeft:  isRTL ? "none" : "2px solid #1A4D1F",
              borderRight: isRTL ? "2px solid #1A4D1F" : "none",
            }}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A4D1F]/20">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#1A4D1F]" />
                <h2 className="font-black text-[#1A4D1F] text-lg">{t("سلة التسوق", "Mon Panier")}</h2>
                {itemCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black text-black" style={{ background: "#1A4D1F" }}>
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
                  className="p-2 rounded-xl text-[#1A4D1F]/40 hover:text-[#1A4D1F] border border-[#1A4D1F]/10 hover:bg-[#1A4D1F]/5 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Supplier tag */}
            {cart.supplierName && (
              <div className="px-5 py-2 border-b border-[#1A4D1F]/5">
                <p className="text-xs text-[#1A4D1F]/60 font-bold">{cart.supplierName}</p>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <div className="w-16 h-16 rounded-2xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20 flex items-center justify-center">
                    <ShoppingCart size={28} className="text-[#1A4D1F]/40" />
                  </div>
                  <p className="text-[#1A4D1F]/30 font-bold text-center">{t("السلة فارغة", "Panier vide")}</p>
                </div>
              ) : (
                cart.items.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    className="rounded-[12px] border border-[#1A4D1F]/20 p-3 flex items-center gap-3"
                    style={{ background: "#FFFDE7" }}
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 rounded-lg object-cover border border-[#1A4D1F]/30 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#1A4D1F] text-sm truncate">
                        {lang === "ar" ? item.nameAr : item.name}
                      </p>
                      <p className="text-[#1A4D1F] font-bold text-sm mt-0.5">{(item.price * item.qty).toFixed(2)} DT</p>
                      <p className="text-[#1A4D1F]/30 text-xs">{item.price.toFixed(2)} DT × {item.qty}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#1A4D1F]/30 bg-[#1A4D1F]/10 hover:bg-[#1A4D1F]/20 text-[#1A4D1F] transition-all"
                      >
                        <Plus size={12} />
                      </button>
                      <span className="text-[#1A4D1F] font-black text-sm">{item.qty}</span>
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
              <div className="p-4 border-t border-[#1A4D1F]/20 space-y-3">
                <div className="rounded-[12px] p-3 space-y-2 border border-[#1A4D1F]/20" style={{ background: "#FFFDE7" }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#1A4D1F]/50">{t("المنتجات", "Produits")}</span>
                    <span className="text-[#1A4D1F] font-bold">{subTotal.toFixed(2)} DT</span>
                  </div>
                  {/* Delegation-based delivery fee */}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#1A4D1F]/50 flex items-center gap-1">
                      {t("التوصيل", "Livraison")}
                      {session?.delegationName && (
                        <span className="text-[10px] text-[#1A4D1F]/70 font-bold px-1.5 py-0.5 rounded-full bg-[#1A4D1F]/10">
                          {session.delegationName}
                        </span>
                      )}
                    </span>
                    <span className="text-[#1A4D1F] font-bold">{deliveryFee.toFixed(2)} DT</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#1A4D1F]/30">
                    <span className="font-black text-[#1A4D1F]">{t("الإجمالي", "Total")}</span>
                    <span className="font-black text-xl" style={{ color: "#1A4D1F" }}>{total.toFixed(2)} DT</span>
                  </div>
                </div>
                <button
                  onClick={placeOrder}
                  className="w-full py-3.5 rounded-[12px] font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: "#1A4D1F", color: "white", boxShadow: "0 4px 16px rgba(46,125,50,0.4)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0D3311")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#1A4D1F")}
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
  const { t, lang, isRTL } = useLang();
  const [cartOpen, setCartOpen] = useState(false);
  const session = getSession();
  const appLogo = useAppLogo();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const navItems = [
    { href: "/home",           icon: Home,    label: t("الرئيسية",  "Accueil")    },
    { href: "/services",       icon: Grid,    label: t("الخدمات",   "Services")   },
    { href: "/orders/history", icon: History, label: t("طلباتي",    "Mes ordres") },
  ];

  return (
    <div
      className={cn(
        "min-h-screen bg-background flex flex-col relative overflow-x-hidden",
        isRTL ? "md:pr-20" : "md:pl-20"
      )}
    >
      {/* ── Desktop Sidebar (navigation icons only) ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed top-0 h-screen w-20 z-50 py-6 items-center justify-between",
          isRTL
            ? "right-0 border-l-2 border-l-[#1A4D1F]"
            : "left-0 border-r-2 border-r-[#1A4D1F]"
        )}
        style={{ background: "#FFA500" }}
      >
        {/* Logo */}
        <img src={appLogo} alt="سند" style={{ height: 104, width: "auto" }} draggable={false} />

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
                      ? "bg-[#1A4D1F] text-black shadow-[0_0_14px_rgba(46,125,50,0.45)]"
                      : "text-[#1A4D1F]/40 group-hover:text-[#1A4D1F] group-hover:bg-[#1A4D1F]/10"
                  )}
                >
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span
                  className={cn(
                    "text-[9px] font-bold transition-colors duration-300 text-center",
                    isActive ? "text-[#1A4D1F]" : "text-[#1A4D1F]/40 group-hover:text-[#1A4D1F]"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User profile + Logout */}
        <div className="flex flex-col items-center gap-3">
          {session ? (
            <>
              {/* Avatar with role color */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base shadow-md ring-2 ring-white/30"
                  style={{ background: getRoleBadge(session.role).bg }}
                  title={session.name}
                >
                  {session.name?.charAt(0)?.toUpperCase() ?? "؟"}
                </div>
                {/* Role badge pill */}
                <span
                  className="text-[8px] font-black px-1.5 py-0.5 rounded-full text-white text-center leading-tight"
                  style={{
                    background: getRoleBadge(session.role).bg,
                    border: `1px solid ${getRoleBadge(session.role).border}`,
                    maxWidth: 60,
                  }}
                >
                  {lang === "ar"
                    ? getRoleBadge(session.role).ar
                    : getRoleBadge(session.role).fr}
                </span>
              </div>
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl text-[#1A4D1F]/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                title={t("تسجيل الخروج", "Déconnexion")}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link href="/auth">
              <button
                className="p-2.5 rounded-xl text-[#1A4D1F]/40 hover:text-[#1A4D1F] hover:bg-[#1A4D1F]/10 transition-all"
                title={t("دخول", "Connexion")}
              >
                <LogIn size={18} />
              </button>
            </Link>
          )}
        </div>
      </aside>

      {/* ── Desktop Top Header (sticky) ── */}
      <header
        className={cn(
          "hidden md:flex items-center justify-between px-6 py-3 sticky top-0 z-40 border-b-2 border-[#1A4D1F]",
          isRTL ? "md:pr-24" : "md:pl-24"
        )}
        style={{ background: "#FFA500" }}
      >
        {/* Greeting + user info */}
        <div className="flex items-center gap-3" dir={isRTL ? "rtl" : "ltr"}>
          {session ? (
            <div className="flex items-center gap-2.5" dir="rtl">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm shadow"
                style={{ background: getRoleBadge(session.role).bg }}
              >
                {session.name?.charAt(0)?.toUpperCase() ?? "؟"}
              </div>
              {/* Name + badge */}
              <div className="flex flex-col items-end">
                <span className="text-[#1A4D1F] font-black text-sm leading-tight">
                  {t("مرحباً،", "Bonjour,")} {session.name}
                </span>
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5"
                  style={{
                    background: getRoleBadge(session.role).bg,
                    color: "#fff",
                    border: `1px solid ${getRoleBadge(session.role).border}`,
                  }}
                >
                  {lang === "ar"
                    ? getRoleBadge(session.role).ar
                    : getRoleBadge(session.role).fr}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#1A4D1F]/30 bg-[#1A4D1F]/5">
              <UserCircle size={15} className="text-[#1A4D1F]/50" />
              <span className="text-[#1A4D1F]/60 text-sm font-bold">{t("زائر", "Visiteur")}</span>
            </div>
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
        className="md:hidden flex items-center justify-between px-4 pt-4 pb-3 border-b-2 border-[#1A4D1F] sticky top-0 z-50"
        style={{ background: "#FFA500" }}
      >
        {/* Logo */}
        <img src={appLogo} alt="سند" style={{ height: 88, width: "auto" }} draggable={false} />

        {/* User greeting (mobile — center) */}
        {session ? (
          <div className="flex items-center gap-2" dir="rtl">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm shadow ring-2 ring-white/20"
              style={{ background: getRoleBadge(session.role).bg }}
            >
              {session.name?.charAt(0)?.toUpperCase() ?? "؟"}
            </div>
            <div className="flex flex-col items-end leading-none">
              <span className="text-[#1A4D1F] font-black text-xs">
                {session.name?.split(" ")[0]}
              </span>
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full mt-0.5 text-white"
                style={{
                  background: getRoleBadge(session.role).bg,
                  border: `1px solid ${getRoleBadge(session.role).border}`,
                }}
              >
                {lang === "ar"
                  ? getRoleBadge(session.role).ar
                  : getRoleBadge(session.role).fr}
              </span>
            </div>
          </div>
        ) : (
          <Link href="/auth">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[#1A4D1F]/30 bg-[#1A4D1F]/5 cursor-pointer">
              <UserCircle size={14} className="text-[#1A4D1F]/50" />
              <span className="text-[#1A4D1F]/60 text-xs font-bold">{t("زائر", "Visiteur")}</span>
            </div>
          </Link>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <CartButton onClick={() => setCartOpen(true)} large />
          <NotificationBell />
          <LangToggle />
        </div>
      </header>

      {/* ── Main Content (grows to push footer down) ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto pb-4">
        {children}
      </main>

      {/* ══════════════════════════════════════════════════════════
          PAGE BOTTOM — شركاؤنا + footer  (always pinned to bottom)
          The outer div is min-h-screen flex flex-col, main is flex-1,
          so this section is always pushed to the very bottom.
      ══════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-7xl mx-auto pb-20 md:pb-4">
        {/* شركاؤنا */}
        <div className="px-4 sm:px-6 lg:px-10 mt-10">
          <PhotoAdGallery />
        </div>

        {/* Global Ad Banner */}
        <div className="px-4 sm:px-6 mt-6 mb-4">
          <AdBanner />
        </div>

        {/* Footer */}
        <footer className="mt-2 mb-4 flex flex-col items-center gap-1 select-none">
          <p
            className="text-[11px] font-bold tracking-wide"
            style={{ color: "rgba(27,94,32,0.55)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
          >
            جميع الحقوق محفوظة © سند · Sanad
          </p>
          <a
            href="tel:27777589"
            dir="ltr"
            className="inline-flex items-center gap-1.5 group"
            style={{ fontFamily: "'Outfit',sans-serif" }}
          >
            <Phone size={12} style={{ color: "#1A4D1F" }} />
            <span
              className="text-[12px] font-black tracking-widest group-hover:underline"
              style={{ color: "rgba(27,94,32,0.70)", letterSpacing: "0.12em" }}
            >
              27 777 589
            </span>
          </a>
        </footer>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 w-full border-t-2 border-[#FFD700] px-6 py-3 z-50 flex justify-around items-center rounded-t-2xl"
        style={{ background: "#FFA500" }}
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
                  isActive ? "text-[#1A4D1F]" : "text-[#1A4D1F]/40"
                )}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-[#1A4D1F]/20 rounded-xl blur-sm" />
                )}
                <item.icon
                  className="w-6 h-6 relative z-10"
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  isActive ? "text-[#1A4D1F]" : "text-[#1A4D1F]/40"
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
            <div className="p-2 rounded-xl text-[#1A4D1F]/30 hover:text-red-400 transition-all">
              <LogOut className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-[#1A4D1F]/30">
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
