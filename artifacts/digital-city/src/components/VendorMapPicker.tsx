import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import { motion } from "framer-motion";
import { MapPin, Loader2, X, CheckCircle2, LocateFixed, Navigation } from "lucide-react";
import { useLang } from "@/lib/language";

// ── Sanad shop pin (green — vendor, not customer) ─────────────────────────────
const VENDOR_ICON = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
    <filter id="sh" x="-30%" y="-10%" width="160%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#00000055"/>
    </filter>
    <path filter="url(#sh)"
      d="M19 1C9.06 1 1 9.06 1 19c0 14 18 28 18 28s18-14 18-28C37 9.06 28.94 1 19 1z"
      fill="#1A4D1F" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="19" cy="19" r="8" fill="white"/>
    <circle cx="19" cy="19" r="3.5" fill="#1A4D1F"/>
  </svg>`,
  iconSize: [38, 48],
  iconAnchor: [19, 48],
  popupAnchor: [0, -50],
});

const BG_LAT = 33.1167;
const BG_LNG = 11.2167;

export interface VendorMapPickerResult {
  lat: number;
  lng: number;
  address: string;
}

interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (result: VendorMapPickerResult) => void;
  onClose: () => void;
}

function TapHandler({ onTap }: { onTap: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onTap(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function MapFlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 17, { animate: true, duration: 0.9 });
  }, [target, map]); // eslint-disable-line
  return null;
}

export function VendorMapPicker({ initialLat, initialLng, onConfirm, onClose }: Props) {
  const { lang, t } = useLang();

  const startLat = initialLat ?? BG_LAT;
  const startLng = initialLng ?? BG_LNG;

  const [markerPos, setMarkerPos] = useState<[number, number]>([startLat, startLng]);
  const [address, setAddress]     = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating]   = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerRef   = useRef<L.Marker | null>(null);

  // Reverse geocode on position change
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": lang } },
        );
        if (r.ok) {
          const geo = await r.json() as { display_name?: string };
          setAddress(geo.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      } catch {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } finally {
        setGeocoding(false);
      }
    }, 700);
  }, [lang]);

  const handlePosition = useCallback((lat: number, lng: number) => {
    setMarkerPos([lat, lng]);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // Auto-detect GPS on mount if no initial coords
  useEffect(() => {
    if (!initialLat || !initialLng) {
      if (navigator.geolocation) {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            setFlyTarget([lat, lng]);
            handlePosition(lat, lng);
            setAutoDetected(true);
            setLocating(false);
          },
          () => {
            // Fallback: geocode the default center
            reverseGeocode(BG_LAT, BG_LNG);
            setLocating(false);
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        reverseGeocode(startLat, startLng);
      }
    } else {
      reverseGeocode(startLat, startLng);
    }
  }, []); // eslint-disable-line

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setFlyTarget([lat, lng]);
        handlePosition(lat, lng);
        setAutoDetected(true);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [handlePosition]);

  const handleDragEnd = useCallback(() => {
    const m = markerRef.current;
    if (!m) return;
    const { lat, lng } = m.getLatLng();
    handlePosition(lat, lng);
  }, [handlePosition]);

  const handleConfirm = () => {
    onConfirm({
      lat:     markerPos[0],
      lng:     markerPos[1],
      address: address || `${markerPos[0].toFixed(6)}, ${markerPos[1].toFixed(6)}`,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "#1A4D1F", zIndex: 10 }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <X size={18} className="text-white" />
        </button>

        <div className="text-center">
          <p className="text-white font-black text-sm">
            {t("📍 حدّد موقع محلّك", "📍 Épinglez votre boutique")}
          </p>
          <p className="text-white/50 text-[10px]">
            {autoDetected
              ? t("✓ تم تحديد موقعك تلقائياً · اسحب الدبوس لضبطه", "✓ Position auto · Ajustez l'épingle")
              : t("اضغط على الخريطة أو اسحب الدبوس", "Tapez la carte ou glissez l'épingle")}
          </p>
        </div>

        {/* GPS button */}
        <button
          onClick={locateMe}
          disabled={locating}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
          style={{ background: "rgba(255,165,0,0.25)", opacity: locating ? 0.6 : 1 }}
          title={lang === "ar" ? "موقعي الحالي" : "Ma position actuelle"}
        >
          {locating
            ? <Loader2 size={15} className="text-[#FFA500] animate-spin" />
            : <LocateFixed size={15} className="text-[#FFA500]" />}
        </button>
      </div>

      {/* Auto-detected banner */}
      {autoDetected && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold flex-shrink-0"
          style={{ background: "#e8f5e9", color: "#1A4D1F", borderBottom: "1px solid rgba(26,77,31,0.1)" }}
        >
          <Navigation size={12} />
          {t("تم رصد موقعك بواسطة GPS · اسحب الدبوس لضبط الموقع بدقة", "Position GPS détectée · Glissez l'épingle pour affiner")}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <MapContainer
          center={[startLat, startLng]}
          zoom={15}
          style={{ width: "100%", height: "100%" }}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TapHandler onTap={handlePosition} />
          <MapFlyTo target={flyTarget} />
          <Marker
            position={markerPos}
            icon={VENDOR_ICON}
            draggable
            ref={markerRef}
            eventHandlers={{ dragend: handleDragEnd }}
          />
        </MapContainer>

        {geocoding && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: "rgba(26,77,31,0.85)", backdropFilter: "blur(6px)" }}>
              <Loader2 size={11} className="animate-spin" />
              {t("جاري تحديد العنوان...","Identification de l'adresse...")}
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="flex-shrink-0 p-4 space-y-3" style={{ background: "#f0fdf4", borderTop: "1px solid rgba(26,77,31,0.08)" }}>
        {/* Address */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(26,77,31,0.12)" }}
          >
            <MapPin size={16} className="text-[#1A4D1F]" />
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
                {address || `${markerPos[0].toFixed(6)}, ${markerPos[1].toFixed(6)}`}
              </p>
            )}
            <p className="text-[10px] text-[#1A4D1F]/40 font-mono mt-0.5">
              {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}
            </p>
          </div>
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2.5 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, #1A4D1F, #2E7D32)" }}
        >
          <CheckCircle2 size={20} />
          {t("تأكيد موقع المحل", "Confirmer l'emplacement de la boutique")}
        </button>
      </div>
    </motion.div>
  );
}
