import { useState, useEffect } from "react";
import { get } from "@/lib/admin-api";

interface Partner {
  id: number;
  textAr: string;
  textFr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
}

export function PhotoAdGallery() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<Partner[]>("/ticker")
      .then(data => {
        const withImages = data.filter(d => d.imageUrl && d.imageUrl.trim() !== "");
        setPartners(withImages.slice(0, 8));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || partners.length === 0) return null;

  return (
    <div>
      <p
        className="text-xs font-black mb-4 tracking-widest uppercase text-right"
        style={{ color: "rgba(26,77,31,0.35)", fontFamily: "'Outfit',sans-serif", letterSpacing: "0.18em" }}
      >
        Partenaires
      </p>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {partners.map(p => {
          const card = (
            <div key={p.id} className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: 64 }}>
              {/* Name above photo */}
              <span
                className="text-center leading-tight w-full"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(26,77,31,0.65)",
                  fontFamily: "'Cairo',sans-serif",
                  wordBreak: "break-word",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {p.textAr}
              </span>
              {/* Transparent photo */}
              <div className="w-14 h-14 flex items-center justify-center" style={{ background: "transparent" }}>
                <img
                  src={p.imageUrl!}
                  alt={p.textAr}
                  className="w-full h-full object-contain"
                  draggable={false}
                  onError={e => { (e.currentTarget.parentElement!.parentElement!).style.display = "none"; }}
                />
              </div>
            </div>
          );

          if (p.linkUrl) {
            return (
              <a
                key={p.id}
                href={p.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-110 active:scale-95"
              >
                {card}
              </a>
            );
          }
          return card;
        })}
      </div>
    </div>
  );
}
