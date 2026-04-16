import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import { motion } from "framer-motion";
import { get } from "@/lib/admin-api";
import { MapPin, Loader2, X, CheckCircle2, LocateFixed } from "lucide-react";
import { useLang } from "@/lib/language";

// ─── Sanad pin icon (SVG — no PNG import issues with Vite) ────────────────────
const SANAD_ICON = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
    <filter id="shadow" x="-30%" y="-10%" width="160%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#00000055"/>
    </filter>
    <path filter="url(#shadow)"
      d="M19 1C9.06 1 1 9.06 1 19c0 14 18 28 18 28s18-14 18-28C37 9.06 28.94 1 19 1z"
      fill="#FFA500" stroke="#1A4D1F" stroke-width="2.5"/>
    <circle cx="19" cy="19" r="8" fill="#1A4D1F"/>
    <circle cx="19" cy="19" r="3.5" fill="white"/>
  </svg>`,
  iconSize: [38, 48],
  iconAnchor: [19, 48],
  popupAnchor: [0, -50],
});

// ─── Ben Gardane city center (fallback) ──────────────────────────────────────
const BG_LAT = 33.1167;
const BG_LNG = 11.2167;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DistanceResult {
  distanceKm: number; etaMinutes: number; deliveryFee: number;
  baseFee: number; isNight: boolean;
}
export interface MapPickerResult {
  lat: number; lng: number; address: string;
}
interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  supplierId: number;
  onConfirm: (result: MapPickerResult) => void;
  onClose: () => void;
}

// ─── Inner component: captures map tap/click events ──────────────────────────
function TapHandler({ onTap }: { onTap: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onTap(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ─── Inner component: flies the map view to a target position ─────────────────
function MapFlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 17, { animate: true, duration: 0.8 });
  }, [target, map]); // eslint-disable-line
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MapPickerModal({ initialLat, initialLng, supplierId, onConfirm, onClose }: Props) {
  const { lang, t } = useLang();

  const startLat = initialLat ?? BG_LAT;
  const startLng = initialLng ?? BG_LNG;

  const [markerPos, setMarkerPos]   = useState<[number, number]>([startLat, startLng]);
  const [address, setAddress]       = useState("");
  const [distInfo, setDistInfo]     = useState<DistanceResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [geocoding, setGeocoding]   = useState(false);
  const [locating, setLocating]     = useState(false); // true while requesting device GPS
  const [flyTarget, setFlyTarget]   = useState<[number, number] | null>(null); // triggers MapFlyTo

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerRef   = useRef<L.Marker | null>(null);

  // Fetch fee + reverse-geocode when position changes (debounced 600ms)
  const processPosition = useCallback(async (lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      // ── Fee calculation ──
      setCalcLoading(true);
      try {
        const params = new URLSearchParams({
          providerId:  String(supplierId),
          customerLat: String(lat),
          customerLng: String(lng),
        });
        const res = await get<DistanceResult>(`/distance?${params}`);
        setDistInfo(res);
      } catch { /* keep last */ }
      finally { setCalcLoading(false); }

      // ── Reverse geocode ──
      setGeocoding(true);
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${lang}`,
          { headers: { "Accept-Language": lang } },
        );
        if (r.ok) {
          const geo = await r.json() as { display_name?: string };
          setAddress(geo.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
      finally { setGeocoding(false); }
    }, 600);
  }, [supplierId, lang]);

  // Calculate fee for the initial center on mount
  useEffect(() => { processPosition(startLat, startLng); }, []); // eslint-disable-line

  const handleMarkerDragEnd = useCallback(() => {
    const m = markerRef.current;
    if (!m) return;
    const { lat, lng } = m.getLatLng();
    processPosition(lat, lng);
  }, [processPosition]);

  // ─── Ask device GPS and fly the map to the real position ─────────────────
  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setFlyTarget([lat, lng]);
        processPosition(lat, lng);
        setLocating(false);
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [processPosition]);

  const handleConfirm = () => {
    onConfirm({
      lat:     markerPos[0],
      lng:     markerPos[1],
      address: address || `${markerPos[0].toFixed(5)}, ${markerPos[1].toFixed(5)}`,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col"
    >
      {/* ── Header bar ── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "#1A4D1F", zIndex: 10 }}
      >
        <button onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)" }}>
          <X size={18} className="text-white" />
        </button>
        <div className="text-center">
          <p className="text-white font-black text-sm">
            {t("📍 اختر موقع التوصيل", "📍 Choisir le lieu de livraison")}
          </p>
          <p className="text-white/50 text-[10px]">
            {t("اسحب الدبوس أو اضغط على الخريطة", "Glissez l'épingle ou tapez sur la carte")}
          </p>
        </div>
        {/* Locate Me button — calls device GPS, moves pin to real position */}
        <button
          onClick={locateMe}
          disabled={locating}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
          style={{ background: "rgba(255,165,0,0.25)", opacity: locating ? 0.6 : 1 }}
          title={lang === "ar" ? "موقعي الحالي" : "Ma position actuelle"}
        >
          {locating
            ? <Loader2 size={15} className="text-[#FFA500] animate-spin" />
            : <LocateFixed size={15} className="text-[#FFA500]" />
          }
        </button>
      </div>

      {/* ── Leaflet map ── */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <MapContainer
          center={[startLat, startLng]}
          zoom={15}
          style={{ width: "100%", height: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TapHandler onTap={processPosition} />
          <MapFlyTo target={flyTarget} />
          <Marker
            position={markerPos}
            icon={SANAD_ICON}
            draggable={true}
            ref={markerRef}
            eventHandlers={{ dragend: handleMarkerDragEnd }}
          />
        </MapContainer>

        {/* Pulsing center hint (shown while calculating) */}
        {(calcLoading || geocoding) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: "rgba(26,77,31,0.85)", backdropFilter: "blur(6px)" }}>
              <Loader2 size={11} className="animate-spin" />
              {calcLoading
                ? t("جاري حساب الرسوم...","Calcul en cours...")
                : t("جاري تحديد العنوان...","Identification...")}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom panel ── */}
      <div
        className="flex-shrink-0 space-y-3 p-4"
        style={{ background: "#FFF3E0", zIndex: 10 }}
      >
        {/* Address row */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,165,0,0.15)" }}>
            <MapPin size={16} className="text-[#FFA500]" />
          </div>
          <div className="flex-1 min-w-0">
            {geocoding ? (
              <div className="flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin text-[#1A4D1F]/40" />
                <span className="text-xs text-[#1A4D1F]/40">
                  {t("جاري تحديد العنوان...","Identification de l'adresse...")}
                </span>
              </div>
            ) : (
              <p className="text-sm font-bold text-[#1A4D1F] leading-snug line-clamp-2">
                {address || `${markerPos[0].toFixed(5)}, ${markerPos[1].toFixed(5)}`}
              </p>
            )}
            <p className="text-[10px] text-[#1A4D1F]/40 font-mono mt-0.5">
              {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}
            </p>
          </div>
        </div>

        {/* Fee preview chips */}
        <div
          className="flex gap-2 p-3 rounded-2xl border border-[#1A4D1F]/10"
          style={{ background: "rgba(26,77,31,0.04)" }}
        >
          {calcLoading ? (
            <div className="flex items-center gap-2 w-full justify-center text-[#1A4D1F]/40 text-xs py-1">
              <Loader2 size={12} className="animate-spin" />
              {t("حساب رسوم التوصيل...","Calcul des frais...")}
            </div>
          ) : distInfo ? (
            <>
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-[#FFA500]">
                  {distInfo.distanceKm.toFixed(2)}
                  <span className="text-xs font-bold"> km</span>
                </p>
                <p className="text-[9px] text-[#1A4D1F]/40 font-bold uppercase">
                  {t("المسافة","Distance")}
                </p>
              </div>
              <div className="w-px bg-[#1A4D1F]/10 self-stretch" />
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-emerald-500">
                  {distInfo.etaMinutes}
                  <span className="text-xs font-bold"> {t("د","min")}</span>
                </p>
                <p className="text-[9px] text-[#1A4D1F]/40 font-bold uppercase">
                  {t("الوقت المتوقع","ETA")}
                </p>
              </div>
              <div className="w-px bg-[#1A4D1F]/10 self-stretch" />
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-[#1A4D1F]">
                  {distInfo.deliveryFee.toFixed(3)}
                  <span className="text-xs font-bold"> DT</span>
                </p>
                <p className="text-[9px] text-[#1A4D1F]/40 font-bold uppercase">
                  {t("رسوم التوصيل","Livraison")}
                  {distInfo.isNight && " 🌙"}
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#1A4D1F]/30 w-full text-center py-1">
              {t("اضغط على الخريطة لتحديد موقعك","Tapez sur la carte pour choisir")}
            </p>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2.5 transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg,#1A4D1F,#2E7D32)" }}
        >
          <CheckCircle2 size={20} />
          <span>{t("تأكيد الموقع","Confirmer l'emplacement")}</span>
          {distInfo && !calcLoading && (
            <span className="text-white/60 text-sm font-bold">
              · {distInfo.deliveryFee.toFixed(3)} DT
            </span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
