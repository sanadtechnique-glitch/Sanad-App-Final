import { motion } from "framer-motion";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Utensils, Pill, Scale, ShoppingCart, Wrench, Stethoscope, ChevronRight } from "lucide-react";
import { ServiceCategory } from "@workspace/api-client-react";

const CATEGORIES = [
  { id: ServiceCategory.restaurant, icon: Utensils, titleEn: "Restaurants", titleAr: "مطاعم", color: "from-orange-500/20 to-red-500/20", iconColor: "text-orange-400" },
  { id: ServiceCategory.pharmacy, icon: Pill, titleEn: "Pharmacy", titleAr: "صيدلية", color: "from-emerald-500/20 to-teal-500/20", iconColor: "text-emerald-400" },
  { id: ServiceCategory.grocery, icon: ShoppingCart, titleEn: "Grocery", titleAr: "بقالة", color: "from-blue-500/20 to-cyan-500/20", iconColor: "text-blue-400" },
  { id: ServiceCategory.doctor, icon: Stethoscope, titleEn: "Doctor", titleAr: "طبيب", color: "from-rose-500/20 to-pink-500/20", iconColor: "text-rose-400" },
  { id: ServiceCategory.lawyer, icon: Scale, titleEn: "Lawyer", titleAr: "محامي", color: "from-amber-500/20 to-yellow-500/20", iconColor: "text-amber-400" },
  { id: ServiceCategory.mechanic, icon: Wrench, titleEn: "Mechanic", titleAr: "ميكانيكي", color: "from-zinc-500/20 to-slate-500/20", iconColor: "text-zinc-400" },
];

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <Layout>
      <div className="relative pb-24">
        {/* Hero Section */}
        <section className="relative h-[45vh] min-h-[350px] w-full flex items-center justify-center overflow-hidden rounded-b-[3rem] border-b border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-background/80 z-10" />
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Hero abstract background" 
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-20 text-center px-4 max-w-3xl mx-auto mt-8 md:mt-0"
          >
            <div className="inline-block mb-4 px-4 py-1.5 rounded-full glass-panel border-primary/30 text-primary text-sm font-semibold tracking-wider gold-glow">
              BEN GUERDANE
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-2 tracking-tight drop-shadow-lg">
              المدينة <span className="text-gradient-gold">الرقمية</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-light tracking-wide">
              Digital City Premium Delivery
            </p>
          </motion.div>
        </section>

        {/* Categories Section */}
        <section className="px-4 sm:px-6 lg:px-8 mt-12">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-1">Our Services</h2>
              <p className="text-muted-foreground text-sm">خدماتنا المتميزة</p>
            </div>
          </div>

          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
          >
            {CATEGORIES.map((cat) => (
              <motion.div key={cat.id} variants={item}>
                <Link href={`/services?category=${cat.id}`} className="block h-full cursor-pointer">
                  <div className="relative h-full p-6 rounded-3xl glass-panel group overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(212,175,55,0.15)] hover:border-primary/40">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${cat.color} rounded-full blur-3xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
                    
                    <div className="relative z-10 flex flex-col items-center text-center h-full justify-center">
                      <div className={`w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 ${cat.iconColor} shadow-lg`}>
                        <cat.icon size={32} strokeWidth={1.5} />
                      </div>
                      <h3 className="text-xl font-display font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{cat.titleAr}</h3>
                      <p className="text-sm text-muted-foreground font-medium">{cat.titleEn}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>
        
        {/* Banner Section */}
        <section className="px-4 sm:px-6 lg:px-8 mt-12 mb-8">
          <div className="relative overflow-hidden rounded-3xl p-8 glass-panel border-primary/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">Need something special?</h3>
                <p className="text-muted-foreground max-w-md">Our VIP concierge can handle any custom request within the city.</p>
              </div>
              <Link href="/services" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shrink-0">
                Explore All
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
