import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { SanadBrand } from "@/components/sanad-brand";
import { AdBanner } from "@/components/ad-banner";
import { useLang } from "@/lib/language";
import { getSession } from "@/lib/auth";
import {
  Utensils, Pill, Scale, ShoppingCart, Wrench, Stethoscope,
  Car, Hotel, LogIn, UserCircle, ChevronLeft, ChevronRight,
  MapPin, Truck, Eye, Grid,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// PANORAMIC PROMO SLIDES
// Admin: Edit this array to update the advertising slider on the homepage.
// ─────────────────────────────────────────────────────────────────────────────
const PROMO_SLIDES = [
  {
    id: 1,
    imageUrl: "",
    titleAr: "عروض رمضان الحصرية",
    titleFr: "Offres exclusives Ramadan",
    subtitleAr: "أفضل العروض من مطاعم ومحلات بن قردان",
    subtitleFr: "Les meilleures offres des restaurants de Ben Guerdane",
    bgFrom: "#2E7D32",
    bgTo: "#1B5E20",
    accent: "#FFA500",
  },
  {
    id: 2,
    imageUrl: "",
    titleAr: "توصيل سريع لباب الدار",
    titleFr: "Livraison rapide à domicile",
    subtitleAr: "طلبك في أقل من 45 دقيقة — في أي مكان بالمدينة",
    subtitleFr: "Votre commande en moins de 45 min — partout en ville",
    bgFrom: "#E65100",
    bgTo: "#BF360C",
    accent: "#FFF3E0",
  },
  {
    id: 3,
    imageUrl: "",
    titleAr: "انضم كمزود خدمة",
    titleFr: "Rejoignez-nous en tant que prestataire",
    subtitleAr: "سجّل محلك أو مطعمك وابدأ استقبال الطلبات اليوم",
    subtitleFr: "Inscrivez votre boutique et commencez à recevoir des commandes",
    bgFrom: "#1565C0",
    bgTo: "#0D47A1",
    accent: "#FFA500",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "restaurant", icon: Utensils,     ar: "مطاعم",    fr: "Restaurants" },
  { id: "pharmacy",   icon: Pill,         ar: "صيدلية",   fr: "Pharmacie"   },
  { id: "lawyer",     icon: Scale,        ar: "محامي",    fr: "Avocat"      },
  { id: "grocery",    icon: ShoppingCart, ar: "بقالة",    fr: "Épicerie"    },
  { id: "mechanic",   icon: Wrench,       ar: "ميكانيكي", fr: "Mécanicien"  },
  { id: "doctor",     icon: Stethoscope,  ar: "طبيب",     fr: "Médecin"     },
  { id: "car",        icon: Car,          ar: "سيارات",   fr: "Voitures"    },
  { id: "hotel",      icon: Hotel,        ar: "فنادق",    fr: "Hôtels"      },
];

// ─────────────────────────────────────────────────────────────────────────────
// PANORAMIC SLIDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function PromoSlider({ lang }: { lang: string }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(i => (i + 1) % PROMO_SLIDES.length);
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const slide = PROMO_SLIDES[active];

  const goTo = (idx: number) => {
    setActive(idx);
    resetTimer();
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg"
      style={{ aspectRatio: "21/9", minHeight: 140, maxHeight: 320 }}>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center px-8 sm:px-14"
          style={{
            background: `linear-gradient(135deg, ${slide.bgFrom} 0%, ${slide.bgTo} 100%)`,
          }}
        >
          {/* Background texture */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.25) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)",
            }} />

          {/* Accent circle */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full opacity-15"
            style={{ background: slide.accent }} />

          {/* Content */}
          <div className="relative z-10 text-center" dir="rtl">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-bold mb-1 opacity-80"
              style={{ color: slide.accent, fontFamily: "'Cairo','Tajawal',sans-serif" }}
            >
              {lang === "ar" ? slide.subtitleAr : slide.subtitleFr}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-black text-white leading-snug"
              style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
            >
              {lang === "ar" ? slide.titleAr : slide.titleFr}
            </motion.h2>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next arrows */}
      <button
        onClick={() => goTo((active - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/35 transition-all"
        aria-label="Previous"
      >
        <ChevronRight size={16} className="text-white" />
      </button>
      <button
        onClick={() => goTo((active + 1) % PROMO_SLIDES.length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/35 transition-all"
        aria-label="Next"
      >
        <ChevronLeft size={16} className="text-white" />
      </button>

      {/* Navigation dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {PROMO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === active ? 20 : 8,
              height: 8,
              background: i === active ? "#2E7D32" : "rgba(255,255,255,0.5)",
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { lang, t, isRTL } = useLang();
  const [, navigate] = useLocation();
  const session = getSession();

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FFF3E0", fontFamily: "'Cairo','Tajawal',sans-serif" }}
      dir="rtl"
    >

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between"
        style={{
          background: "rgba(255,243,224,0.92)",
          borderBottom: "1.5px solid rgba(46,125,50,0.12)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {/* Logo — right side in RTL */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/home")}
        >
          <span style={{ fontSize: "1.65rem", fontWeight: 900, lineHeight: 1 }}>
            <SanadBrand color="#2E7D32" innerColor="#FFF3E0" />
          </span>
        </motion.div>

        {/* Right actions — left side in RTL layout */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-2"
        >
          {session ? (
            <>
              {/* Services link for logged-in clients */}
              {session.role === "client" && (
                <Link href="/services">
                  <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-[#2E7D32]/10"
                    style={{ color: "#2E7D32" }}>
                    <Grid size={14} />
                    {t("الخدمات", "Services")}
                  </button>
                </Link>
              )}
              {/* Profile pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2E7D32]/30"
                style={{ background: "#2E7D32", cursor: "default" }}>
                <UserCircle size={15} className="text-white" />
                <span className="text-white font-black text-xs">{session.username}</span>
              </div>
            </>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-black text-sm text-white transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "#2E7D32",
                boxShadow: "0 3px 14px rgba(46,125,50,0.30)",
              }}
            >
              <LogIn size={15} />
              {t("دخول", "Connexion")}
            </button>
          )}
        </motion.div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          PANORAMIC ADVERTISING SLIDER
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="px-4 sm:px-6 lg:px-10 mt-4"
      >
        <PromoSlider lang={lang} />
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════════
          SERVICES GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-10 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-5 text-right"
        >
          <h2 className="text-xl font-black text-[#2E7D32]">
            {t("خدماتنا", "Nos Services")}
          </h2>
          <p className="text-sm font-medium" style={{ color: "rgba(46,125,50,0.5)" }}>
            {t("اختر الخدمة المناسبة", "Choisissez votre service")}
          </p>
        </motion.div>

        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
          {CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            const label = lang === "ar" ? cat.ar : cat.fr;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 280, damping: 22 }}
              >
                <Link href={`/services?category=${cat.id}`}>
                  <div className="flex flex-col items-center text-center gap-2 cursor-pointer group">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                      style={{
                        border: "2.5px solid rgba(46,125,50,0.65)",
                        background: "rgba(46,125,50,0.06)",
                      }}
                    >
                      <Icon size={24} style={{ color: "#2E7D32" }} />
                    </div>
                    <p className="font-black text-[11px] leading-snug" style={{ color: "#2E7D32" }}>
                      {label}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          ABOUT US  —  "عن سند.. لماذا نحن هنا؟"
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="px-4 sm:px-8 lg:px-16 mt-10 mb-6"
      >
        {/* Divider */}
        <div className="flex items-center gap-4 mb-7">
          <div className="flex-1 h-px" style={{ background: "rgba(46,125,50,0.18)" }} />
          <MapPin size={18} style={{ color: "#2E7D32", flexShrink: 0 }} />
          <div className="flex-1 h-px" style={{ background: "rgba(46,125,50,0.18)" }} />
        </div>

        {/* Heading */}
        <h2
          className="text-2xl font-black text-center mb-8"
          style={{ color: "#2E7D32", fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl"
        >
          عن سند.. لماذا نحن هنا؟
        </h2>

        <div className="flex flex-col gap-6 max-w-2xl mx-auto">

          {/* Section 1 — The Purpose */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl p-5 text-center"
            style={{
              background: "rgba(46,125,50,0.06)",
              border: "1.5px solid rgba(46,125,50,0.14)",
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#2E7D32" }}>
              <Truck size={18} className="text-white" />
            </div>
            <p
              className="font-black text-base mb-1"
              style={{ color: "#2E7D32", fontFamily: "'Cairo','Tajawal',sans-serif" }}
              dir="rtl"
            >
              لماذا وضعناه على ذمتكم؟
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "rgba(46,125,50,0.75)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
              dir="rtl"
            >
              لأن وقتكم غالي، ولأننا نؤمن بضرورة تقريب المسافات وتسهيل حياتكم اليومية.
            </p>
          </motion.div>

          {/* Section 2 — The Role */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className="rounded-2xl p-5 text-center"
            style={{
              background: "rgba(46,125,50,0.06)",
              border: "1.5px solid rgba(46,125,50,0.14)",
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#2E7D32" }}>
              <Grid size={18} className="text-white" />
            </div>
            <p
              className="font-black text-base mb-1"
              style={{ color: "#2E7D32", fontFamily: "'Cairo','Tajawal',sans-serif" }}
              dir="rtl"
            >
              ما هو دورنا؟
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "rgba(46,125,50,0.75)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
              dir="rtl"
            >
              نحن الرابط الذكي بينك وبين احتياجاتك؛ سواء كانت قضية من المغازة، طرد مستعجل، أو وجبة من مطعمك المفضل.
            </p>
          </motion.div>

          {/* Section 3 — Vision */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.56 }}
            className="rounded-2xl p-5 text-center"
            style={{
              background: "rgba(46,125,50,0.06)",
              border: "1.5px solid rgba(46,125,50,0.14)",
            }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: "#2E7D32" }}>
              <Eye size={18} className="text-white" />
            </div>
            <p
              className="font-black text-base mb-1"
              style={{ color: "#2E7D32", fontFamily: "'Cairo','Tajawal',sans-serif" }}
              dir="rtl"
            >
              رؤيتنا
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "rgba(46,125,50,0.75)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
              dir="rtl"
            >
              أن نكون الخيار الأول والآمن لكل مواطن بفضل تكنولوجيا محلية تحترم خصوصيتكم وتلبي تطلعاتكم.
            </p>
          </motion.div>

        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════════
          GLOBAL AD BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 lg:px-10 mt-8">
        <AdBanner />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer
        className="mt-10 py-5 text-center border-t"
        style={{
          borderColor: "rgba(46,125,50,0.12)",
          background: "rgba(46,125,50,0.04)",
        }}
      >
        <p className="text-xs font-bold" style={{ color: "rgba(46,125,50,0.55)", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          جميع الحقوق محفوظة © سند · Sanad — بن قردان
        </p>
        <p className="text-xs mt-1" style={{ color: "rgba(46,125,50,0.4)", fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          📞 27 777 589
        </p>
      </footer>

    </div>
  );
}
