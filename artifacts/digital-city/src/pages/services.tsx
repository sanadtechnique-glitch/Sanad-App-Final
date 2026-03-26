import { useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useListServices, ServiceCategory } from "@workspace/api-client-react";
import { MapPin, Star, AlertCircle, ChevronLeft, ArrowRight } from "lucide-react";

export default function Services() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCategory = searchParams.get("category") as ServiceCategory | undefined;
  
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | "all">(initialCategory || "all");

  // Fetch services. If 'all', pass undefined.
  const { data: services, isLoading, error } = useListServices(
    activeCategory === "all" ? undefined : { category: activeCategory }
  );

  const categories = [
    { id: "all", label: "All", labelAr: "الكل" },
    { id: ServiceCategory.restaurant, label: "Restaurants", labelAr: "مطاعم" },
    { id: ServiceCategory.pharmacy, label: "Pharmacy", labelAr: "صيدلية" },
    { id: ServiceCategory.grocery, label: "Grocery", labelAr: "بقالة" },
    { id: ServiceCategory.doctor, label: "Doctor", labelAr: "طبيب" },
    { id: ServiceCategory.lawyer, label: "Lawyer", labelAr: "محامي" },
    { id: ServiceCategory.mechanic, label: "Mechanic", labelAr: "ميكانيكي" },
  ];

  return (
    <Layout>
      <div className="pt-8 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft size={20} className="text-foreground" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Providers</h1>
            <p className="text-muted-foreground text-sm">مقدمي الخدمات</p>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex overflow-x-auto pb-4 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 gap-3 no-scrollbar scroll-smooth">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as ServiceCategory | "all")}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-300 border ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                  : "bg-white/5 text-muted-foreground border-white/10 hover:border-primary/50 hover:text-white"
              }`}
            >
              <span className="font-display mr-1">{cat.labelAr}</span>
              <span className="opacity-70 text-xs">| {cat.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-panel h-48 rounded-3xl animate-pulse bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="glass-panel rounded-3xl p-12 text-center border-destructive/20 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Failed to load</h3>
            <p className="text-muted-foreground">Please try again later.</p>
          </div>
        ) : services?.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-display">لا يوجد مزودي خدمة</h3>
            <p className="text-muted-foreground">No providers found for this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services?.map((provider, index) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="glass-panel rounded-3xl p-6 flex flex-col h-full group hover:border-primary/30 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-display font-bold text-white mb-1 group-hover:text-primary transition-colors">
                      {provider.nameAr}
                    </h3>
                    <p className="text-sm text-muted-foreground">{provider.name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    provider.isAvailable 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}>
                    {provider.isAvailable ? "Available" : "Busy"}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <MapPin size={16} className="text-primary" />
                  <span className="truncate">{provider.address}</span>
                </div>

                <p className="text-sm text-muted-foreground/80 line-clamp-2 mb-6 flex-grow">
                  {provider.descriptionAr}
                </p>

                <Link href={`/order/${provider.id}`} className="mt-auto block">
                  <Button 
                    variant={provider.isAvailable ? "default" : "outline"} 
                    className="w-full justify-between group/btn"
                    disabled={!provider.isAvailable}
                  >
                    <span className="font-display">اطلب الان | Order Now</span>
                    <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
