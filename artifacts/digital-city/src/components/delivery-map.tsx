import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, ExternalLink } from "lucide-react";
import { useLang } from "@/lib/language";

// Fix leaflet default icon in Vite/webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BEN_GARDANE: [number, number] = [33.1365, 11.2206];

interface Props {
  address: string;
  customerName: string;
}

interface GeoResult { lat: string; lon: string; display_name: string; }

export default function DeliveryMap({ address, customerName }: Props) {
  const { t, isRTL } = useLang();
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(true);

  useEffect(() => {
    const query = encodeURIComponent(`${address}, Ben Gardane, Tunisia`);
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=ar,fr`)
      .then(r => r.json())
      .then((results: GeoResult[]) => {
        if (results.length > 0) {
          setCoords([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
        } else {
          setCoords(BEN_GARDANE);
        }
      })
      .catch(() => setCoords(BEN_GARDANE))
      .finally(() => setGeocoding(false));
  }, [address]);

  const openGoogleMaps = () => {
    const destination = encodeURIComponent(`${address}, Ben Gardane, Tunisia`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, "_blank");
  };

  return (
    <div className="mt-3 rounded-[12px] overflow-hidden border border-[#2E7D32]/30" style={{ direction: "ltr" }}>
      {geocoding ? (
        <div className="h-40 flex items-center justify-center bg-[#FFFDE7]">
          <div className="w-6 h-6 border-2 border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : coords ? (
        <>
          <div style={{ height: "160px" }}>
            <MapContainer
              center={coords}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              attributionControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={coords}>
                <Popup>{customerName}</Popup>
              </Marker>
            </MapContainer>
          </div>
          <button
            onClick={openGoogleMaps}
            className="w-full flex items-center justify-center gap-2 py-2.5 font-black text-sm text-[#2E7D32] hover:text-[#2E7D32] border-t border-[#2E7D32]/30 transition-all hover:bg-[#2E7D32]/8"
            style={{ background: "#FFFDE7" }}
            dir={isRTL ? "rtl" : "ltr"}>
            <Navigation size={15} />
            {t("التنقل إلى العميل", "Naviguer vers le client")}
            <ExternalLink size={12} className="opacity-50" />
          </button>
        </>
      ) : (
        <button
          onClick={openGoogleMaps}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] text-[#2E7D32] border border-[#2E7D32]/30 font-black text-sm hover:bg-[#2E7D32]/10 transition-all"
          style={{ background: "#FFFDE7" }}>
          <Navigation size={15} />
          {t("فتح الخريطة", "Ouvrir la carte")}
        </button>
      )}
    </div>
  );
}
