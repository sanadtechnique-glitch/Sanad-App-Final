import { useState, useEffect, useRef } from "react";
import { useLang } from "@/lib/language";
import { get } from "@/lib/admin-api";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdSlide {
  id: number;
  textAr: string;
  textFr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  bgColor: string;
  textColor: string;
}

interface AdCarouselProps {
  supplierId?: number;
  className?: string;
  height?: number;
}

export function AdCarousel({ supplierId, className = "", height = 110 }: AdCarouselProps) {
  const { lang } = useLang();
  const [slides, setSlides] = useState<AdSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const url = supplierId ? `/ticker/supplier/${supplierId}` : "/ticker";
    get<AdSlide[]>(url)
      .then(data => { setSlides(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [supplierId]);

  const goTo = (idx: number) => {
    if (animating || slides.length <= 1) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 350);
  };

  const next = () => goTo((current + 1) % slides.length);
  const prev = () => goTo((current - 1 + slides.length) % slides.length);

  // Auto-rotate every 5s
  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrent(c => (c + 1) % slides.length);
        setAnimating(false);
      }, 350);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length]);

  if (!loaded || slides.length === 0) return null;

  const slide = slides[current];
  const text = lang === "ar" ? slide.textAr : (slide.textFr || slide.textAr);

  const content = (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        height,
        background: slide.imageUrl
          ? "transparent"
          : `${slide.bgColor}22`,
        backdropFilter: "blur(0px)",
        border: slide.imageUrl ? "none" : `1.5px solid ${slide.bgColor}33`,
      }}
    >
      {/* Background image — crossfade */}
      {slide.imageUrl && (
        <img
          src={slide.imageUrl}
          alt={text}
          className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          style={{
            opacity: animating ? 0 : 1,
            transition: "opacity 0.35s ease",
          }}
        />
      )}

      {/* Subtle gradient overlay for text readability (image slides) */}
      {slide.imageUrl && (
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: "linear-gradient(to left, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)",
            opacity: animating ? 0 : 1,
            transition: "opacity 0.35s ease",
          }}
        />
      )}

      {/* Transparent slide — soft tinted bg */}
      {!slide.imageUrl && (
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${slide.bgColor}18 0%, ${slide.bgColor}30 100%)`,
            opacity: animating ? 0 : 1,
            transition: "opacity 0.35s ease",
          }}
        />
      )}

      {/* Text content */}
      <div
        className="absolute inset-0 flex items-center px-5"
        style={{
          opacity: animating ? 0 : 1,
          transition: "opacity 0.35s ease",
          direction: "rtl",
        }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="font-black text-sm leading-snug truncate drop-shadow-sm"
            style={{
              color: slide.imageUrl ? "#FFFFFF" : slide.textColor,
              textShadow: slide.imageUrl ? "0 1px 6px rgba(0,0,0,0.55)" : "none",
            }}
          >
            {text}
          </p>
        </div>
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={e => { e.preventDefault(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all hover:scale-110 active:scale-95"
            style={{ background: "rgba(0,0,0,0.18)" }}
          >
            <ChevronLeft size={14} color="#fff" />
          </button>
          <button
            onClick={e => { e.preventDefault(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all hover:scale-110 active:scale-95"
            style={{ background: "rgba(0,0,0,0.18)" }}
          >
            <ChevronRight size={14} color="#fff" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.preventDefault(); goTo(i); }}
              className="transition-all duration-300"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? "#FFA500" : "rgba(26,77,31,0.3)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (slide.linkUrl) {
    return (
      <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}
