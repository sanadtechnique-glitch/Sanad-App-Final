import { Link, useLocation } from "wouter";
import { Home, Grid, ClipboardList, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home", labelAr: "الرئيسية" },
    { href: "/services", icon: Grid, label: "Services", labelAr: "الخدمات" },
    { href: "/admin", icon: LayoutDashboard, label: "Admin", labelAr: "الادارة" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col relative pb-20 md:pb-0 md:pl-24">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-24 glass-panel border-r border-white/5 z-50 py-8 items-center justify-between">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 gold-glow">
          <span className="font-display font-bold text-primary text-xl">DC</span>
        </div>
        
        <nav className="flex flex-col gap-8">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 group cursor-pointer">
                <div className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                    : "text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                )}>
                  <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] font-display font-semibold transition-colors duration-300",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )}>
                  {item.labelAr}
                </span>
              </Link>
            )
          })}
        </nav>
        
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground">AR</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-panel border-t border-white/10 px-6 py-3 pb-safe z-50 flex justify-between items-center rounded-t-2xl">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center w-16 gap-1">
              <div className={cn(
                "relative p-2 rounded-xl transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {isActive && (
                  <span className="absolute inset-0 bg-primary/20 rounded-xl blur-sm" />
                )}
                <item.icon className="w-6 h-6 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-display font-semibold",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.labelAr}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  );
}
