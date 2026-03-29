import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { get } from "@/lib/admin-api";
import {
  Utensils, Pill, Scale, ShoppingCart, Wrench, Stethoscope,
  ChevronRight, Star, Car, Hotel, Zap, Clock, Shield,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "restaurant", icon: Utensils,     ar: "مطاعم",     fr: "Restaurants",  descAr: "أفضل المطاعم",            descFr: "Meilleurs restaurants",   color: "from-orange-500/20 to-red-500/20",     iconColor: "text-orange-400",  border: "hover:border-orange-500/30" },
  { id: "pharmacy",   icon: Pill,         ar: "صيدلية",    fr: "Pharmacie",    descAr: "أدوية ومستلزمات",          descFr: "Médicaments & soins",     color: "from-emerald-500/20 to-teal-500/20",   iconColor: "text-emerald-400", border: "hover:border-emerald-500/30" },
  { id: "lawyer",     icon: Scale,        ar: "محامي",     fr: "Avocat",       descAr: "استشارات قانونية",          descFr: "Conseils juridiques",     color: "from-amber-500/20 to-yellow-500/20",   iconColor: "text-amber-400",   border: "hover:border-amber-500/30" },
  { id: "grocery",    icon: ShoppingCart, ar: "بقالة",     fr: "Épicerie",     descAr: "مواد غذائية طازجة",         descFr: "Produits frais",          color: "from-blue-500/20 to-cyan-500/20",      iconColor: "text-blue-400",    border: "hover:border-blue-500/30" },
  { id: "mechanic",   icon: Wrench,       ar: "ميكانيكي", fr: "Mécanicien",   descAr: "صيانة السيارات",            descFr: "Réparation auto",         color: "from-zinc-400/20 to-slate-500/20",     iconColor: "text-zinc-300",    border: "hover:border-zinc-400/30" },
  { id: "doctor",     icon: Stethoscope,  ar: "طبيب",      fr: "Médecin",      descAr: "رعاية صحية متكاملة",         descFr: "Soins médicaux",          color: "from-rose-500/20 to-pink-500/20",      iconColor: "text-rose-400",    border: "hover:border-rose-500/30" },
  { id: "car",        icon: Car,          ar: "سيارات",    fr: "Voitures",     descAr: "بيع وتأجير السيارات",        descFr: "Vente & location auto",   color: "from-sky-500/20 to-blue-500/20",       iconColor: "text-sky-400",     border: "hover:border-sky-500/30" },
  { id: "hotel",      icon: Hotel,        ar: "فنادق",     fr: "Hôtels",       descAr: "حجز فنادق مريحة",            descFr: "Réservation hôtels",      color: "from-violet-500/20 to-purple-500/20",  iconColor: "text-violet-400",  border: "hover:border-violet-500/30" },
];

interface PromoBanner { id: number; titleAr: string; titleFr: string; bgColor?: string; link?: string; imageUrl?: string; }

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const itemAnim  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 22 } } };

// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { lang, t, isRTL } = useLang();
  const [supplierCount, setSupplierCount] = useState<number | null>(null);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    get<{ id: number }[]>("/services")
      .then(data => setSupplierCount(data.length))
      .catch(() => setSupplierCount(12));
    get<PromoBanner[]>("/banners")
      .then(data => setBanners(data.filter(b => (b as any).isActive !== false)))
      .catch(() => {});
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIndex(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners]);

  return (
    <Layout>
      <div className="relative pb-28" dir={isRTL ? "rtl" : "ltr"}>

        {/* ── Hero Section ── */}
        <section className="relative h-[44vh] min-h-[320px] w-full flex items-center justify-center overflow-hidden rounded-b-[2.5rem] border-b border-[#66BB6A]/8">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-45"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FF8C00]/80 via-[#FF8C00]/40 to-[#FF8C00]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C00]/40 via-transparent to-[#FF8C00]/40" />
          {/* Animated gold particle */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(102,187,106,0.08) 0%, transparent 70%)", animation: "pulse 6s ease-in-out infinite" }} />
          </div>

          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative z-10 text-center px-4">
            {/* Badge */}
            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="inline-block mb-5 px-4 py-1.5 rounded-full border border-[#66BB6A]/40 bg-[#66BB6A]/10 text-[#66BB6A] text-xs font-black tracking-[0.25em] uppercase">
              {t("بن قردان · تونس", "Ben Guerdane · Tunisie")}
            </motion.span>

            {/* Title */}
            <h1 dir={isRTL ? "rtl" : "ltr"}
              className="text-6xl md:text-8xl font-black text-[#66BB6A] mb-3 leading-tight"
              style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#FF8C00,#FFD700)" }}>
                سند
              </span>
            </h1>

            <p className="text-base md:text-lg text-[#66BB6A]/70 font-bold tracking-wide" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
              {t("سندك في التوصيل.. لباب الدار", "Sanad — Livraison jusqu'à votre porte")}
            </p>
          </motion.div>
        </section>

        {/* ── Stats Bar ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="flex items-center justify-center gap-6 py-4 border-b border-[#66BB6A]/5 text-sm text-[#66BB6A]/45">
          <span className="flex items-center gap-1.5">
            <Star size={13} className="text-[#66BB6A] fill-[#66BB6A]" />
            {t("تقييم ممتاز", "Service excellent")}
          </span>
          <span className="w-px h-4 bg-[#66BB6A]/10" />
          <span className="flex items-center gap-1.5">
            <Zap size={13} className="text-[#66BB6A]" />
            {supplierCount != null
              ? t(`${supplierCount} مزود خدمة`, `${supplierCount} prestataires`)
              : t("مزودو الخدمات", "Nos prestataires")}
          </span>
          <span className="w-px h-4 bg-[#66BB6A]/10" />
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-[#66BB6A]" />
            {t("توصيل سريع", "Livraison rapide")}
          </span>
        </motion.div>

        {/* ── Promo Banners ── */}
        {banners.length > 0 && (
          <section className="px-4 sm:px-6 lg:px-8 mt-7">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-2xl min-h-[80px] cursor-pointer"
              style={{ background: banners[bannerIndex]?.bgColor ? `${banners[bannerIndex].bgColor}18` : "rgba(102,187,106,0.08)", border: `1px solid ${banners[bannerIndex]?.bgColor || "#66BB6A"}30` }}
              onClick={() => banners[bannerIndex]?.link && window.open(banners[bannerIndex].link, "_blank")}>
              {/* Glow blob */}
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                style={{ background: `${banners[bannerIndex]?.bgColor || "#66BB6A"}20` }} />
              <div className="relative z-10 px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-black text-[#66BB6A] text-lg leading-tight">
                    {lang === "ar" ? banners[bannerIndex]?.titleAr : banners[bannerIndex]?.titleFr}
                  </p>
                  {banners.length > 1 && (
                    <div className="flex gap-1 mt-2">
                      {banners.map((_, i) => (
                        <button key={i} onClick={e => { e.stopPropagation(); setBannerIndex(i); }}
                          className="w-1.5 h-1.5 rounded-full transition-all"
                          style={{ background: i === bannerIndex ? "#FFD700" : "rgba(255,255,255,0.25)" }} />
                      ))}
                    </div>
                  )}
                </div>
                {banners[bannerIndex]?.link && (
                  <ChevronRight size={18} className={`text-[#66BB6A]/60 flex-shrink-0 ${isRTL ? "rotate-180" : ""}`} />
                )}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Services Grid ── */}
        <section className="px-4 sm:px-6 lg:px-8 mt-9">
          <div className={`mb-7 ${isRTL ? "text-right" : "text-left"}`}>
            <h2 className="text-2xl font-black text-[#66BB6A] mb-1">
              {t("خدماتنا", "Nos Services")}
            </h2>
            <p className="text-[#66BB6A]/35 text-sm">
              {t("اختر الخدمة المناسبة", "Choisissez votre service")}
            </p>
          </div>

          <motion.div key={lang} variants={container} initial="hidden" animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const label = lang === "ar" ? cat.ar : cat.fr;
              const desc  = lang === "ar" ? cat.descAr : cat.descFr;
              return (
                <motion.div key={cat.id} variants={itemAnim}>
                  <Link href={`/services?category=${cat.id}`}>
                    <div className={[
                      "rounded-[15px] p-4 flex flex-col items-center text-center cursor-pointer",
                      "card-hover group border border-[#66BB6A]/30",
                    ].join(" ")} style={{ background: "#FFFDE7" }}>
                      <div className={`w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br border border-[#66BB6A]/6 ${cat.color}`}>
                        <Icon size={22} className={`${cat.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                      </div>
                      <p className="font-black text-[#66BB6A] text-sm leading-snug group-hover:text-[#66BB6A] transition-colors">
                        {label}
                      </p>
                      <p className="text-[11px] text-[#66BB6A]/30 mt-1 leading-tight">{desc}</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ── Trust badges ── */}
        <section className="px-4 sm:px-6 lg:px-8 mt-8">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            className="grid grid-cols-3 gap-3">
            {[
              { icon: Shield,  ar: "خصوصية تامة",   fr: "Confidentialité", sub: { ar: "بدون أرقام هاتف", fr: "Sans numéros" } },
              { icon: Zap,     ar: "توصيل سريع",    fr: "Livraison rapide", sub: { ar: "أسرع وقت ممكن",  fr: "Le plus vite possible" } },
              { icon: Star,    ar: "جودة مضمونة",   fr: "Qualité garantie", sub: { ar: "مزودون موثوقون", fr: "Prestataires vérifiés" } },
            ].map(badge => {
              const Icon = badge.icon;
              return (
                <div key={badge.ar} className="glass-panel rounded-2xl p-4 flex flex-col items-center text-center border border-[#66BB6A]/5">
                  <div className="w-9 h-9 rounded-xl bg-[#66BB6A]/10 border border-[#66BB6A]/20 flex items-center justify-center mb-2">
                    <Icon size={16} className="text-[#66BB6A]" />
                  </div>
                  <p className="text-xs font-black text-[#66BB6A] leading-tight">{lang === "ar" ? badge.ar : badge.fr}</p>
                  <p className="text-[10px] text-[#66BB6A]/25 mt-0.5 leading-tight">{lang === "ar" ? badge.sub.ar : badge.sub.fr}</p>
                </div>
              );
            })}
          </motion.div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="px-4 sm:px-6 lg:px-8 mt-7">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="relative overflow-hidden rounded-2xl p-6 border border-[#66BB6A]/20"
            style={{ background: "linear-gradient(135deg, rgba(102,187,106,0.08) 0%, rgba(0,0,0,0) 60%)" }}>
            <div className="absolute top-0 right-0 w-52 h-52 rounded-full blur-3xl pointer-events-none"
              style={{ background: "rgba(102,187,106,0.07)" }} />
            <div className={`relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${isRTL ? "sm:flex-row" : "sm:flex-row-reverse"}`}>
              <div className={isRTL ? "text-right" : "text-left"}>
                <h3 className="text-xl font-black text-[#66BB6A] mb-1">
                  {t("هل تحتاج مساعدة؟", "Besoin d'aide ?")}
                </h3>
                <p className="text-sm text-[#66BB6A]/40">
                  {t("تصفح كل مقدمي الخدمة في منطقتك", "Parcourez tous les prestataires")}
                </p>
              </div>
              <Link href="/services">
                <button className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#FF8C00,#FFD700)", color: "#66BB6A", textShadow: "0 1px 2px rgba(0,0,0,0.12)", boxShadow: "0 0 20px -5px rgba(255,140,0,0.5)" }}>
                  {t("تصفح الخدمات", "Voir les services")}
                  <ChevronRight size={15} className={isRTL ? "rotate-180" : ""} />
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

      </div>
    </Layout>
  );
}
