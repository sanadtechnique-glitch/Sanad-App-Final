import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone } from "lucide-react";
import { get } from "@/lib/admin-api";
import { useLang } from "@/lib/language";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Ad {
  id: number;
  titleAr: string;
  titleFr: string;
  imageUrl?: string;
  bgColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL AD BANNER — Full image slideshow
// Fetches active banners from /api/banners and shows them as full images.
// Returns null when empty — zero layout impact.
// ─────────────────────────────────────────────────────────────────────────────
export function AdBanner() {
  const { lang, t } = useLang();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    get<Ad[]>("/banners")
      .then(data => { setAds(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const next = useCallback(() => {
    setActive(i => (i + 1) % ads.length);
  }, [ads.length]);

  // Auto-advance every 5 seconds when there are multiple ads
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [ads.length, next]);

  if (!loaded || ads.length === 0) return null;

  const ad = ads[active];
  const title = lang === "ar" ? ad.titleAr : ad.titleFr;
  const color = ad.bgColor || "#2E7D32";

  return (
    <div
      className="w-full relative overflow-hidden"
      style={{
        borderRadius: 16,
        height: 160,
        border: "1.5px solid rgba(46,125,50,0.18)",
        boxShadow: "0 4px 18px rgba(46,125,50,0.10)",
        background: "#f5f0e8",
      }}
      aria-label={t("إعلانات سند", "Annonces Sanad")}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.id + "-" + active}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {ad.imageUrl ? (
            <img
              src={ad.imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              draggable={false}
              onError={e => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            /* Fallback: colored card with title */
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Megaphone size={20} className="text-white" />
              </div>
              <p
                className="text-white font-black text-sm text-center px-4"
                style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
              >
                {title}
              </p>
            </div>
          )}

          {/* Overlay gradient — bottom fade for dots visibility */}
          {ad.imageUrl && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.35) 100%)",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Title overlay on image */}
          {ad.imageUrl && title && (
            <div
              className="absolute bottom-0 left-0 right-0 px-4 py-2"
              dir="rtl"
            >
              <p
                className="text-white font-black text-sm drop-shadow"
                style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
              >
                {title}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators — only when multiple ads */}
      {ads.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === active ? 18 : 7,
                height: 7,
                background:
                  i === active
                    ? "#fff"
                    : "rgba(255,255,255,0.45)",
              }}
              aria-label={`إعلان ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
