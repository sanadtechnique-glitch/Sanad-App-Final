import { useState, useEffect, useRef } from "react";
import { useLang } from "@/lib/language";
import { get } from "@/lib/admin-api";

interface TickerAd {
  id: number;
  textAr: string;
  textFr: string | null;
  bgColor: string;
  textColor: string;
}

interface TickerBannerProps {
  supplierId?: number;
  className?: string;
}

export function TickerBanner({ supplierId, className = "" }: TickerBannerProps) {
  const { lang } = useLang();
  const [ads, setAds] = useState<TickerAd[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const url = supplierId ? `/ticker/supplier/${supplierId}` : "/ticker";
    get<TickerAd[]>(url)
      .then(data => { setAds(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [supplierId]);

  if (!loaded || ads.length === 0) return null;

  const bgColor = ads[0]?.bgColor || "#1A4D1F";
  const textColor = ads[0]?.textColor || "#FFFFFF";

  const items = [...ads, ...ads, ...ads];
  const text = items
    .map(ad => (lang === "ar" ? ad.textAr : (ad.textFr || ad.textAr)))
    .join("   ·   ");

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: bgColor,
        height: 36,
        borderRadius: 8,
      }}
    >
      {/* Fade left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
        style={{ background: `linear-gradient(to right, ${bgColor}, transparent)` }}
      />
      {/* Fade right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${bgColor}, transparent)` }}
      />

      {/* Scrolling text */}
      <div className="flex items-center h-full overflow-hidden">
        <div
          className="flex items-center whitespace-nowrap"
          style={{
            animation: "ticker-scroll 28s linear infinite",
            color: textColor,
            fontSize: 12.5,
            fontWeight: 700,
            gap: 0,
            direction: "rtl",
          }}
        >
          <span style={{ paddingRight: 32 }}>{text}</span>
          <span style={{ paddingRight: 32 }}>{text}</span>
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
