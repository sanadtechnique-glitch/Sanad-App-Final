import { useState, useEffect } from "react";
import { get } from "@/lib/admin-api";

interface PartnerLogo {
  id: number;
  name: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

export function PhotoAdGallery() {
  const [partners, setPartners] = useState<PartnerLogo[]>([]);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    get<PartnerLogo[]>("/partners")
      .then(data => { setPartners(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || partners.length === 0) return null;

  return (
    <div>
      <p
        className="text-xs font-black mb-4 tracking-widest uppercase text-right"
        style={{ color: "rgba(26,77,31,0.35)", fontFamily: "'Outfit',sans-serif", letterSpacing: "0.18em" }}
      >
        Partenaires · شركاؤنا
      </p>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {partners.map(p => (
          <div
            key={p.id}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
            style={{ width: 64 }}
          >
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
              {p.name}
            </span>
            <div
              className="rounded-full overflow-hidden flex items-center justify-center"
              style={{ width: 52, height: 52, background: "rgba(26,77,31,0.06)" }}
            >
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full h-full object-cover"
                draggable={false}
                onError={e => {
                  (e.currentTarget.parentElement!.parentElement!).style.display = "none";
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
