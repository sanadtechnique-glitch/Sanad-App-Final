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
      .then(data => { setAds(data.slice(0, 5)); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const slots: (AdSlide | null)[] = [
    ads[0] ?? null,
    ads[1] ?? null,
    ads[2] ?? null,
    ads[3] ?? null,
    ads[4] ?? null,
  ];

  const renderSlot = (slot: AdSlide | null, idx: number, extraClass = "") => {
    const inner = (
      <div
        className={`relative overflow-hidden rounded-2xl w-full h-full ${extraClass}`}
        style={{
          background: slot?.imageUrl
            ? undefined
            : slot
              ? `${slot.bgColor}22`
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
            <div className="flex flex-col items-center gap-1 opacity-25">
              <ImageIcon size={20} color="#1A4D1F" />
              <span className="text-[10px] font-bold text-[#1A4D1F]">{idx + 1}</span>
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
          className="block"
          style={{ flex: "1 1 0" }}
        >
          {inner}
        </a>
      );
    }
    return (
      <div key={idx} style={{ flex: "1 1 0" }}>
        {inner}
      </div>
    );
  };

  if (!loaded) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Row 1 — 2 wide images */}
      <div className="flex gap-2.5" style={{ height: 130 }}>
        {renderSlot(slots[0], 0)}
        {renderSlot(slots[1], 1)}
      </div>

      {/* Row 2 — 3 square images */}
      <div className="flex gap-2.5" style={{ height: 90 }}>
        {renderSlot(slots[2], 2)}
        {renderSlot(slots[3], 3)}
        {renderSlot(slots[4], 4)}
      </div>
    </div>
  );
}
