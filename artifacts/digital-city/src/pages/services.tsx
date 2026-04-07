import { useState, useEffect } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { get } from "@/lib/admin-api";
import {
  Star, ChevronRight, Utensils, Pill, Scale,
  ShoppingCart, Wrench, Stethoscope, Car, Hotel,
  Moon, Sun, AlertTriangle, KeyRound, Cake, Coffee,
  Beef, Scissors,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number; name: string; nameAr: string; category: string;
  description: string; descriptionAr: string; address: string;
  rating?: number; isAvailable: boolean; shift?: string;
  photoUrl?: string | null;
}

// Matches exact DB category values
const CATS = [
  { id: "all",        ar: "الكل",         fr: "Tous",          icon: null,         gradient: "from-[#1A4D1F]/20 to-[#8B7329]/10", iconColor: "text-[#1A4D1F]",   border: "hover:border-[#1A4D1F]/30",  href: null },
  { id: "restaurant", ar: "مطاعم",        fr: "Restaurants",   icon: Utensils,     gradient: "from-orange-500/20 to-red-500/10",   iconColor: "text-orange-400",  border: "hover:border-orange-500/30", href: null },
  { id: "grocery",    ar: "بقالة",        fr: "Épicerie",      icon: ShoppingCart, gradient: "from-blue-500/20 to-cyan-500/10",    iconColor: "text-blue-400",    border: "hover:border-blue-500/30",   href: null },
  { id: "bakery",     ar: "مخبزة",        fr: "Boulangerie",   icon: Cake,         gradient: "from-yellow-500/20 to-amber-500/10", iconColor: "text-yellow-400",  border: "hover:border-yellow-500/30", href: null },
  { id: "butcher",    ar: "ملحمة",        fr: "Boucherie",     icon: Beef,         gradient: "from-red-500/20 to-rose-500/10",     iconColor: "text-red-400",     border: "hover:border-red-500/30",    href: null },
  { id: "cafe",       ar: "مقهى",         fr: "Café",          icon: Coffee,       gradient: "from-amber-800/20 to-amber-500/10",  iconColor: "text-amber-700",   border: "hover:border-amber-500/30",  href: null },
  { id: "sweets",     ar: "حلويات",       fr: "Pâtisserie",    icon: Scissors,     gradient: "from-pink-500/20 to-rose-500/10",    iconColor: "text-pink-400",    border: "hover:border-pink-500/30",   href: null },
  { id: "pharmacy",   ar: "صيدلية",       fr: "Pharmacie",     icon: Pill,         gradient: "from-emerald-500/20 to-teal-500/10", iconColor: "text-emerald-400", border: "hover:border-emerald-500/30",href: null },
  { id: "hotel",      ar: "فنادق",        fr: "Hôtels",        icon: Hotel,        gradient: "from-violet-500/20 to-purple-500/10",iconColor: "text-violet-400",  border: "hover:border-violet-500/30", href: null },
  { id: "car_rental", ar: "كراء سيارات", fr: "Location auto", icon: KeyRound,     gradient: "from-sky-500/20 to-blue-500/10",     iconColor: "text-sky-400",     border: "hover:border-sky-500/30",    href: null },
  { id: "lawyer",     ar: "محامي",        fr: "Avocat",        icon: Scale,        gradient: "from-amber-500/20 to-yellow-500/10", iconColor: "text-amber-400",   border: "hover:border-amber-500/30",  href: null },
  { id: "mechanic",   ar: "ميكانيكي",    fr: "Mécanicien",    icon: Wrench,       gradient: "from-zinc-400/20 to-slate-500/10",   iconColor: "text-zinc-400",    border: "hover:border-zinc-500/30",   href: null },
  { id: "doctor",     ar: "طبيب",         fr: "Médecin",       icon: Stethoscope,  gradient: "from-rose-500/20 to-pink-500/10",    iconColor: "text-rose-400",    border: "hover:border-rose-500/30",   href: null },
  // Taxi lives in its own table — link directly instead of filtering
  { id: "taxi",       ar: "تاكسي",        fr: "Taxi",          icon: Car,          gradient: "from-[#FFA500]/20 to-yellow-500/10", iconColor: "text-[#FFA500]",   border: "hover:border-[#FFA500]/30",  href: "/taxi" },
];


const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 22 } },
};

function isPharmacyShiftActive(shift?: string): boolean {
  if (!shift || shift === "all") return true;
  const hour = new Date().getHours();
  const isDay = hour >= 8 && hour < 20;
  return shift === "day" ? isDay : !isDay;
}

// Special card shown in "all" and "taxi" tabs that redirects to /taxi page
function TaxiShortcutCard({ t }: { t: (ar: string, fr: string) => string; isRTL: boolean }) {
  const [, navigate] = useLocation();
  const taxi = CATS.find(c => c.id === "taxi")!;
  const Icon = taxi.icon!;
  return (
    <motion.div variants={cardAnim}>
      <div
        className="flex flex-col items-center gap-2 p-2 cursor-pointer group"
        onClick={() => navigate("/taxi")}
      >
        <div className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-[#FFA500]/60 shadow-md bg-gradient-to-br from-[#FFA500]/20 to-yellow-500/10 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
          <Icon size={28} className="text-[#FFA500]" />
          <div className="absolute bottom-1 end-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-sm" />
        </div>
        <span className="text-xs font-black text-center text-[#1A4D1F] leading-tight line-clamp-2 max-w-[72px]">
          {t("تاكسي", "Taxi")}
        </span>
      </div>
    </motion.div>
  );
}

export default function Services() {
  const { lang, t, isRTL } = useLang();
  const search = useSearch();
  const urlCategory = new URLSearchParams(search).get("category") || "all";
  const [active, setActive] = useState(urlCategory);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [, navigate] = useLocation();

  // Sync with URL changes (e.g. pressing back then navigating again)
  useEffect(() => {
    setActive(new URLSearchParams(search).get("category") || "all");
  }, [search]);

  useEffect(() => {
    // Taxi has its own page — redirect immediately
    if (active === "taxi") { navigate("/taxi"); return; }

    setLoading(true); setHasError(false);
    const path = active === "all" ? "/services" : `/services?category=${active}`;
    get<Supplier[]>(path)
      .then(data => { setSuppliers(data); setLoading(false); })
      .catch(() => { setHasError(true); setLoading(false); });
  }, [active, navigate]);

  const cfg = (id: string) => CATS.find(c => c.id === id) ?? CATS[0];

  const effectivelyAvailable = (s: Supplier) => {
    if (!s.isAvailable) return false;
    if (s.category === "pharmacy") return isPharmacyShiftActive(s.shift);
    return true;
  };

  const showTaxiCard = active === "all";

  return (
    <Layout>
      <div className="pt-6 px-4 sm:px-6 lg:px-8 pb-28" dir={isRTL ? "rtl" : "ltr"}>

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <div className="w-11 h-11 rounded-2xl glass-panel border border-[#1A4D1F]/10 flex items-center justify-center hover:bg-[#1A4D1F]/10 hover:border-[#1A4D1F]/30 transition-all cursor-pointer">
              <ChevronRight size={18} className={cn("text-[#1A4D1F]/60", !isRTL && "rotate-180")} />
            </div>
          </Link>
          <div>
            <h1 className="text-3xl font-black text-[#1A4D1F] leading-tight">
              {t("مقدمو الخدمات", "Prestataires")}
            </h1>
            <p className="text-[#1A4D1F]/30 text-sm mt-0.5 font-medium">
              {t("اختر الخدمة المناسبة لك", "Choisissez votre prestataire")}
            </p>
          </div>
        </div>

        {/* ── Category Filter ── */}
        <div className="flex gap-2.5 pb-3 mb-6 overflow-x-auto no-scrollbar">
          {CATS.map(cat => {
            const isAct = active === cat.id;
            const Icon = cat.icon;
            const isTaxi = cat.id === "taxi";
            return (
              <button
                key={cat.id}
                onClick={() => isTaxi ? navigate("/taxi") : setActive(cat.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm border transition-all duration-300",
                  isAct
                    ? isTaxi
                      ? "bg-[#FFA500] text-white border-[#FFA500] shadow-[0_0_22px_rgba(255,165,0,0.35)]"
                      : "bg-[#1A4D1F] text-black border-[#1A4D1F] shadow-[0_0_22px_rgba(46,125,50,0.35)]"
                    : isTaxi
                      ? "bg-[#FFA500]/8 text-[#FFA500]/70 border-[#FFA500]/20 hover:text-[#FFA500] hover:border-[#FFA500]/40"
                      : "bg-[#1A4D1F]/5 text-[#1A4D1F]/50 border-[#1A4D1F]/10 hover:text-[#1A4D1F] hover:border-[#1A4D1F]/25"
                )}>
                {Icon && <Icon size={14} className={isAct ? (isTaxi ? "text-white" : "text-black") : cat.iconColor} />}
                <span>{lang === "ar" ? cat.ar : cat.fr}</span>
              </button>
            );
          })}
        </div>

        {/* ── States ── */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex flex-col items-center gap-2 p-2">
                <div className="w-20 h-20 rounded-full animate-pulse bg-[#1A4D1F]/8" style={{ animationDelay: `${i * 60}ms` }} />
                <div className="h-3 w-14 rounded-full animate-pulse bg-[#1A4D1F]/8" />
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="glass-panel rounded-3xl p-14 text-center flex flex-col items-center border border-red-500/20 mt-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-red-400" />
            </div>
            <h3 className="text-xl font-black text-[#1A4D1F] mb-2">{t("حدث خطأ", "Erreur de chargement")}</h3>
            <p className="text-[#1A4D1F]/30 text-sm">{t("حاول مرة أخرى", "Veuillez réessayer")}</p>
          </div>
        ) : (suppliers.length === 0 && !showTaxiCard) ? (
          <div className="glass-panel rounded-3xl p-14 text-center flex flex-col items-center border border-[#1A4D1F]/5 mt-4">
            <div className="w-20 h-20 rounded-full bg-[#1A4D1F]/10 flex items-center justify-center mb-4 border border-[#1A4D1F]/20">
              <Star size={32} className="text-[#1A4D1F]/50" />
            </div>
            <h3 className="text-xl font-black text-[#1A4D1F] mb-2">{t("لا توجد نتائج", "Aucun résultat")}</h3>
            <p className="text-[#1A4D1F]/30 text-sm">{t("جرّب فئة أخرى", "Essayez une autre catégorie")}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={active} variants={container} initial="hidden" animate="show"
              className="grid grid-cols-3 sm:grid-cols-4 gap-4">

              {/* Taxi shortcut — shown in "all" tab */}
              {showTaxiCard && <TaxiShortcutCard t={t} isRTL={isRTL} />}

              {suppliers.map(s => {
                const c = cfg(s.category);
                const Icon = c.icon ?? Utensils;
                const avail = effectivelyAvailable(s);
                const shiftOff = s.isAvailable && s.category === "pharmacy" && !isPharmacyShiftActive(s.shift);
                const targetHref = avail
                  ? (s.category === "hotel" ? `/hotel/${s.id}` : `/store/${s.id}`)
                  : "#";
                return (
                  <motion.div key={s.id} variants={cardAnim}>
                    <Link href={targetHref}>
                      <div className={cn(
                        "flex flex-col items-center gap-2 p-2 group",
                        avail ? "cursor-pointer" : "cursor-not-allowed opacity-55"
                      )}>
                        {/* Circle */}
                        <div className={cn(
                          "relative w-20 h-20 rounded-full overflow-hidden border-[3px] shadow-md flex-shrink-0",
                          "group-hover:scale-105 transition-transform duration-200",
                          avail ? "border-[#1A4D1F]/30" : "border-[#1A4D1F]/10"
                        )}>
                          {s.photoUrl ? (
                            <img src={s.photoUrl} alt={s.nameAr} className="w-full h-full object-cover" />
                          ) : (
                            <div className={cn("w-full h-full flex items-center justify-center bg-gradient-to-br", c.gradient)}>
                              <Icon size={26} className={c.iconColor} />
                            </div>
                          )}
                          {/* Status dot */}
                          <div className={cn(
                            "absolute bottom-1 end-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                            avail ? "bg-emerald-400" : shiftOff ? "bg-blue-400" : "bg-red-400"
                          )} />
                        </div>

                        {/* Name */}
                        <span className="text-xs font-black text-center text-[#1A4D1F] leading-tight line-clamp-2 max-w-[72px]">
                          {lang === "ar" ? s.nameAr : (s.name || s.nameAr)}
                        </span>

                        {/* Pharmacy shift badge */}
                        {s.category === "pharmacy" && s.shift && s.shift !== "all" && (
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-bold -mt-1",
                            s.shift === "day" ? "bg-amber-400/15 text-amber-600" : "bg-indigo-400/15 text-indigo-500"
                          )}>
                            {s.shift === "day" ? <Sun size={8} /> : <Moon size={8} />}
                            {s.shift === "day" ? t("نهاري", "Jour") : t("ليلي", "Nuit")}
                          </span>
                        )}

                        {/* Rating */}
                        {s.rating != null && (
                          <span className="flex items-center gap-0.5 -mt-1">
                            <Star size={9} className="text-[#FFA500] fill-[#FFA500]" />
                            <span className="text-[9px] font-black text-[#1A4D1F]/50">{s.rating.toFixed(1)}</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Layout>
  );
}
