import { useState, useEffect } from "react";
import { get } from "@/lib/admin-api";
import { useLang } from "@/lib/language";

interface PartnerLogo {
  id: number;
  name: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const PLACEHOLDER_PARTNERS: PartnerLogo[] = [
  { id: -1, name: "شريك 1",  imageUrl: "", isActive: true, sortOrder: 1 },
  { id: -2, name: "شريك 2",  imageUrl: "", isActive: true, sortOrder: 2 },
  { id: -3, name: "شريك 3",  imageUrl: "", isActive: true, sortOrder: 3 },
  { id: -4, name: "شريك 4",  imageUrl: "", isActive: true, sortOrder: 4 },
];

export function PhotoAdGallery() {
  const [partners, setPartners] = useState<PartnerLogo[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const { t } = useLang();

  useEffect(() => {
    get<PartnerLogo[]>("/partners")
      .then(data => { setPartners(Array.isArray(data) ? data : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const hasReal = partners.length > 0;
  const items   = hasReal ? partners : PLACEHOLDER_PARTNERS;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-[#FFA500]" />
        <p
          className="font-black tracking-widest uppercase"
          style={{
            color: "#1A4D1F",
            fontFamily: "'Outfit','Cairo',sans-serif",
            fontSize: 11,
            letterSpacing: "0.18em",
          }}
        >
          {t("شركاؤنا", "Partenaires")}
        </p>
      </div>

      {hasReal ? (
        /* Real partners grid */
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {items.map(p => (
            <div
              key={p.id}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              style={{ width: 68 }}
            >
              <div
                className="rounded-full overflow-hidden flex items-center justify-center border border-[#1A4D1F]/10"
                style={{ width: 56, height: 56, background: "rgba(26,77,31,0.05)" }}
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={e => {
                      (e.currentTarget.parentElement!).innerHTML =
                        `<span style="font-size:11px;font-weight:900;color:#1A4D1F;opacity:.35">${p.name.charAt(0)}</span>`;
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#1A4D1F", opacity: 0.3 }}>
                    {p.name.charAt(0)}
                  </span>
                )}
              </div>
              <span
                className="text-center leading-tight w-full"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(26,77,31,0.60)",
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
            </div>
          ))}
        </div>
      ) : (
        /* Empty state — visible until admin adds real partners */
        <div
          className="rounded-2xl border border-dashed flex items-center justify-center"
          style={{
            borderColor: "rgba(26,77,31,0.15)",
            background: "rgba(26,77,31,0.03)",
            minHeight: 72,
          }}
        >
          <p
            style={{
              fontFamily: "'Cairo','Tajawal',sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(26,77,31,0.30)",
            }}
          >
            {t("لا يوجد شركاء حالياً · Partenaires à venir", "Partenaires à venir")}
          </p>
        </div>
      )}
    </div>
  );
}
