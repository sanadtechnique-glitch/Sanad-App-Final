import { useState, useEffect } from "react";
import { get } from "@/lib/admin-api";
import { ImageIcon } from "lucide-react";

interface AdSlide {
  id: number;
  imageUrl: string | null;
  linkUrl: string | null;
  bgColor: string;
}

export function PhotoAdGallery() {
  const [ads, setAds] = useState<AdSlide[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<AdSlide[]>("/ticker")
      .then(data => {
        const withImages = data.filter(d => d.imageUrl && d.imageUrl.trim() !== "");
        setAds(withImages.slice(0, 5));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const slots: (AdSlide | null)[] = [
    ads[0] ?? null,
    ads[1] ?? null,
    ads[2] ?? null,
    ads[3] ?? null,
    ads[4] ?? null,
  ];

  const renderSlot = (slot: AdSlide | null, idx: number) => {
    const inner = (
      <div
        className="relative overflow-hidden rounded-xl w-full"
        style={{
          aspectRatio: "1 / 1",
          background: slot?.imageUrl
            ? undefined
            : "rgba(26,77,31,0.06)",
          border: slot?.imageUrl ? "none" : "1.5px dashed rgba(26,77,31,0.15)",
        }}
      >
        {slot?.imageUrl ? (
          <img
            src={slot.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 opacity-20">
              <ImageIcon size={16} color="#1A4D1F" />
              <span className="text-[9px] font-bold text-[#1A4D1F]">{idx + 1}</span>
            </div>
          </div>
        )}
      </div>
    );

    if (slot?.linkUrl) {
      return (
        <a
          key={idx}
          href={slot.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block flex-1 min-w-0 transition-transform hover:scale-105 active:scale-95"
        >
          {inner}
        </a>
      );
    }
    return (
      <div key={idx} className="flex-1 min-w-0">
        {inner}
      </div>
    );
  };

  if (!loaded) return null;

  return (
    <div>
      {/* Label */}
      <p
        className="text-xs font-black mb-3 tracking-widest uppercase"
        style={{ color: "rgba(26,77,31,0.40)", fontFamily: "'Outfit',sans-serif", letterSpacing: "0.18em" }}
      >
        Partenaires
      </p>

      {/* 5 images in one row */}
      <div className="flex gap-2.5">
        {slots.map((slot, idx) => renderSlot(slot, idx))}
      </div>
    </div>
  );
}
