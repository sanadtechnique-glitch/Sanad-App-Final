import { Link, useLocation } from "wouter";
import { Home, Grid, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
      <button
        onClick={() => setLang("ar")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "ar"
            ? "bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.4)]"
            : "text-white/50 hover:text-white"
        )}
      >
        AR
      </button>
      <button
        onClick={() => setLang("fr")}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold transition-all duration-300",
          lang === "fr"
            ? "bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.4)]"
            : "text-white/50 hover:text-white"
        )}
      >
        FR
      </button>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, isRTL } = useLang();

  const navItems = [
    { href: "/",        icon: Home,          label: t("الرئيسية", "Accueil") },
    { href: "/services", icon: Grid,         label: t("الخدمات",  "Services") },
    { href: "/admin",   icon: LayoutDashboard, label: t("الادارة", "Admin") },
  ];

  return (
    <div
      className={cn(
        "min-h-screen bg-background flex flex-col relative pb-20",
        isRTL ? "md:pb-0 md:pr-24" : "md:pb-0 md:pl-24"
      )}
    >
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed top-0 h-screen w-24 z-50 py-8 items-center justify-between",
          isRTL
            ? "right-0 border-l-2 border-l-[#D4AF37]"
            : "left-0 border-r-2 border-r-[#D4AF37]"
        )}
        style={{ background: "#121212" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_20px_-5px_rgba(212,175,55,0.4)]">
            <span className="font-bold text-[#D4AF37] text-xl">DC</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-8">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  isActive
                    ? "bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                    : "text-white/40 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/10"
                )}>
                  <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold transition-colors duration-300 text-center",
                  isActive ? "text-[#D4AF37]" : "text-white/40 group-hover:text-[#D4AF37]"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <LangToggle />
      </aside>

      {/* ── Mobile Top Bar (language + logo) ── reference: border-bottom 2px solid gold */}
      <header className="md:hidden flex items-center justify-between px-4 pt-4 pb-3 border-b-2 border-[#D4AF37] sticky top-0 z-50" style={{ background: "#121212" }}>
        <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center border border-[#D4AF37]/30">
          <span className="font-bold text-[#D4AF37] text-sm">DC</span>
        </div>
        <LangToggle />
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full border-t-2 border-[#D4AF37] px-6 py-3 z-50 flex justify-around items-center rounded-t-2xl" style={{ background: "#121212" }}>
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center gap-1 w-16">
              <div className={cn(
                "relative p-2 rounded-xl transition-all duration-300",
                isActive ? "text-[#D4AF37]" : "text-white/40"
              )}>
                {isActive && <span className="absolute inset-0 bg-[#D4AF37]/20 rounded-xl blur-sm" />}
                <item.icon className="w-6 h-6 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-bold",
                isActive ? "text-[#D4AF37]" : "text-white/40"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
