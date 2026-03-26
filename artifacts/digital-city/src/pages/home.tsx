import { motion } from "framer-motion";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import {
  Utensils, Pill, Scale, ShoppingCart, Wrench, Stethoscope, ChevronRight, Star,
} from "lucide-react";

const CATEGORIES = [
  {
    id: "restaurant",
    icon: Utensils,
    ar: "مطاعم",
    fr: "Restaurants",
    descAr: "أفضل المطاعم",
    descFr: "Meilleurs restaurants",
    color: "from-orange-500/20 to-red-500/20",
    iconColor: "text-orange-400",
    border: "hover:border-orange-500/30",
  },
  {
    id: "pharmacy",
    icon: Pill,
    ar: "صيدلية",
    fr: "Pharmacie",
    descAr: "أدوية ومستلزمات",
    descFr: "Médicaments & soins",
    color: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
    border: "hover:border-emerald-500/30",
  },
  {
    id: "lawyer",
    icon: Scale,
    ar: "محامي",
    fr: "Avocat",
    descAr: "استشارات قانونية",
    descFr: "Conseils juridiques",
    color: "from-amber-500/20 to-yellow-500/20",
    iconColor: "text-amber-400",
    border: "hover:border-amber-500/30",
  },
  {
    id: "grocery",
    icon: ShoppingCart,
    ar: "بقالة",
    fr: "Épicerie",
    descAr: "مواد غذائية طازجة",
    descFr: "Produits frais & épicerie",
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400",
    border: "hover:border-blue-500/30",
  },
  {
    id: "mechanic",
    icon: Wrench,
    ar: "ميكانيكي",
    fr: "Mécanicien",
    descAr: "صيانة السيارات",
    descFr: "Réparation automobile",
    color: "from-zinc-500/20 to-slate-500/20",
    iconColor: "text-zinc-400",
    border: "hover:border-zinc-500/30",
  },
  {
    id: "doctor",
    icon: Stethoscope,
    ar: "طبيب",
    fr: "Médecin",
    descAr: "رعاية صحية",
    descFr: "Soins médicaux",
    color: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-400",
    border: "hover:border-rose-500/30",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 22 } },
};

export default function Home() {
  const { lang, t, isRTL } = useLang();

  return (
    <Layout>
      <div className="relative pb-28">

        {/* ── Hero ── */}
        <section className="relative h-[42vh] min-h-[320px] w-full flex items-center justify-center overflow-hidden rounded-b-[3rem] border-b border-white/10">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Digital City"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative z-10 text-center px-4"
          >
            <span className="inline-block mb-4 px-4 py-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-bold tracking-[0.2em] uppercase">
              {t("بن قردان", "Ben Guerdane")}
            </span>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-3 leading-tight">
              {lang === "ar" ? (
                <>
                  المدينة{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg,#D4AF37,#F3E5AB,#D4AF37)" }}
                  >
                    الرقمية
                  </span>
                </>
              ) : (
                <>
                  Ville{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg,#D4AF37,#F3E5AB,#D4AF37)" }}
                  >
                    Digitale
                  </span>
                </>
              )}
            </h1>

            <p className="text-lg md:text-xl text-white/60 font-light tracking-widest">
              {t("توصيل بريميوم · Digital City", "Livraison Premium · Digital City")}
            </p>
          </motion.div>
        </section>

        {/* ── Stats bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-6 py-4 border-b border-white/5 text-sm text-white/50"
        >
          <span className="flex items-center gap-1.5">
            <Star size={13} className="text-[#D4AF37] fill-[#D4AF37]" />
            {t("تقييم ممتاز", "Excellent service")}
          </span>
          <span className="w-px h-4 bg-white/10" />
          <span>{t("12 مزود خدمة", "12 prestataires")}</span>
          <span className="w-px h-4 bg-white/10" />
          <span>{t("توصيل سريع", "Livraison rapide")}</span>
        </motion.div>

        {/* ── Services Grid ── */}
        <section className="px-4 sm:px-6 lg:px-8 mt-10">
          <div className={`mb-7 ${isRTL ? "text-right" : "text-left"}`}>
            <h2 className="text-2xl font-bold text-white mb-1">
              {t("خدماتنا", "Nos Services")}
            </h2>
            <p className="text-white/40 text-sm tracking-wide">
              {t("اختر الخدمة المناسبة · Our Services", "Choisissez votre service · خدماتنا")}
            </p>
          </div>

          <motion.div
            key={lang}
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 gap-4"
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const label = lang === "ar" ? cat.ar : cat.fr;
              const desc  = lang === "ar" ? cat.descAr : cat.descFr;

              return (
                <motion.div key={cat.id} variants={item}>
                  <Link href={`/services?category=${cat.id}`}>
                    <div
                      className={`
                        relative p-5 rounded-2xl cursor-pointer overflow-hidden
                        bg-white/5 backdrop-blur-xl border border-white/10
                        transition-all duration-300 group
                        hover:-translate-y-1 hover:shadow-2xl ${cat.border}
                      `}
                    >
                      {/* glow blob */}
                      <div
                        className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${cat.color} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                      />

                      <div className="relative z-10 flex flex-col items-center text-center gap-3">
                        <div
                          className={`w-14 h-14 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 group-hover:scale-110 transition-transform duration-300 ${cat.iconColor}`}
                        >
                          <Icon size={28} strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                            {label}
                          </p>
                          <p className="text-[11px] text-white/30 mt-1">{desc}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="px-4 sm:px-6 lg:px-8 mt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="relative overflow-hidden rounded-2xl p-7 bg-white/5 border border-[#D4AF37]/20 backdrop-blur"
          >
            <div className="absolute top-0 right-0 w-52 h-52 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
            <div className={`relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
              <div className={isRTL ? "text-right" : "text-left"}>
                <h3 className="text-xl font-bold text-white mb-1">
                  {t("هل تحتاج لمساعدة؟", "Besoin d'aide ?")}
                </h3>
                <p className="text-sm text-white/50">
                  {t(
                    "تصفح جميع مقدمي الخدمة بدون أرقام هاتف",
                    "Parcourez tous les prestataires sans numéros de téléphone"
                  )}
                </p>
              </div>
              <Link
                href="/services"
                className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg,#D4AF37,#B8962E)", color: "#111" }}
              >
                {t("تصفح الخدمات", "Voir les services")}
                <ChevronRight size={16} className={isRTL ? "rotate-180" : ""} />
              </Link>
            </div>
          </motion.div>
        </section>

      </div>
    </Layout>
  );
}
