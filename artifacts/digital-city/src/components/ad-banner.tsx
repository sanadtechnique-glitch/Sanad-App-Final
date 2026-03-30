import { useState, useEffect, useRef } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
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
  link?: string;
  bgColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL PANORAMIC AD BANNER
// Fetches active ads from /api/banners and shows a smooth scrolling ticker.
// Returns null if there are no active ads — zero layout impact when empty.
// ─────────────────────────────────────────────────────────────────────────────
export function AdBanner() {
  const { lang, t } = useLang();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loaded, setLoaded] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get<Ad[]>("/banners")
      .then(data => { setAds(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  // Don't render until we know if there are ads (prevents layout jump)
  if (!loaded || ads.length === 0) return null;

  // Duplicate ads for seamless infinite loop
  const items = [...ads, ...ads, ...ads];
  // Speed: ~7s per unique ad, minimum 14s total
  const duration = Math.max(14, ads.length * 7);

  return (
    <div
      className="w-full mx-0 overflow-hidden"
      style={{
        borderRadius: 14,
        border: "1.5px solid rgba(46,125,50,0.22)",
        background: "rgba(255,243,224,0.85)",
        boxShadow: "0 2px 12px rgba(46,125,50,0.07)",
        height: 96,
      }}
      aria-label={t("إعلانات سند", "Annonces Sanad")}
    >
      {/* Scroll track */}
      <div
        ref={trackRef}
        className="flex h-full items-center"
        style={{
          width: "max-content",
          animation: `sanad-ad-scroll ${duration}s linear infinite`,
          willChange: "transform",
        }}
      >
        {items.map((ad, idx) => (
          <AdItem key={`${ad.id}-${idx}`} ad={ad} lang={lang} t={t} />
        ))}
      </div>

      {/* Inject keyframe once */}
      <style>{`
        @keyframes sanad-ad-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes sanad-ad-scroll { 0%, 100% { transform: translateX(0); } }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual ad item in the ticker
// ─────────────────────────────────────────────────────────────────────────────
function AdItem({
  ad,
  lang,
  t,
}: {
  ad: Ad;
  lang: string;
  t: (ar: string, fr: string) => string;
}) {
  const color = ad.bgColor || "#2E7D32";
  const title = lang === "ar" ? ad.titleAr : ad.titleFr;

  const handleClick = () => {
    if (ad.link) window.open(ad.link, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={handleClick}
      role={ad.link ? "link" : undefined}
      tabIndex={ad.link ? 0 : undefined}
      onKeyDown={e => { if (e.key === "Enter") handleClick(); }}
      className="flex items-center gap-3 h-full px-5 flex-shrink-0 transition-opacity hover:opacity-80"
      style={{
        minWidth: 240,
        cursor: ad.link ? "pointer" : "default",
        borderInlineEnd: "1px solid rgba(46,125,50,0.10)",
      }}
      dir="rtl"
    >
      {/* Thumb: image or color swatch */}
      {ad.imageUrl ? (
        <img
          src={ad.imageUrl}
          alt={title}
          className="h-14 w-20 object-cover rounded-lg flex-shrink-0 shadow-sm"
          draggable={false}
        />
      ) : (
        <div
          className="h-12 w-12 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm"
          style={{ background: color }}
        >
          <Megaphone size={20} className="text-white" />
        </div>
      )}

      {/* Text */}
      <div className="flex flex-col justify-center min-w-0">
        <p
          className="font-black text-sm leading-tight truncate"
          style={{
            color: "#2E7D32",
            fontFamily: "'Cairo','Tajawal',sans-serif",
            maxWidth: 160,
          }}
        >
          {title}
        </p>
        {ad.link && (
          <span
            className="flex items-center gap-1 mt-0.5"
            style={{ color: "rgba(46,125,50,0.45)", fontSize: 10, fontFamily: "'Cairo','Tajawal',sans-serif" }}
          >
            <ExternalLink size={9} />
            {t("اضغط للمزيد", "Cliquer pour plus")}
          </span>
        )}
      </div>
    </div>
  );
}
