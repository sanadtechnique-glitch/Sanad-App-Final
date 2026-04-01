const BEN_GUERDANE_LAT = 33.1167;
const BEN_GUERDANE_LNG = 11.2167;

const BASE_FEE_TND = 2.0;
const FEE_PER_KM_TND = 0.5;
const PREP_TIME_MINUTES = 15;
const AVG_SPEED_KM_PER_MIN = 0.5;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  return Math.round(straightLine * 1.35 * 100) / 100;
}

async function googleMapsDistanceKm(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  apiKey: string,
): Promise<number | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json() as {
      rows?: { elements?: { status: string; distance?: { value: number } }[] }[];
    };
    const el = data.rows?.[0]?.elements?.[0];
    if (el?.status === "OK" && el.distance?.value) {
      return Math.round(el.distance.value / 10) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

export interface DistanceResult {
  distanceKm: number;
  etaMinutes: number;
  deliveryFee: number;
  source: "google" | "haversine";
}

export async function calculateDistance(
  providerLat: number | null | undefined,
  providerLng: number | null | undefined,
  customerLat: number,
  customerLng: number,
): Promise<DistanceResult> {
  const pLat = providerLat ?? BEN_GUERDANE_LAT;
  const pLng = providerLng ?? BEN_GUERDANE_LNG;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  let distanceKm: number;
  let source: "google" | "haversine" = "haversine";

  if (apiKey) {
    const gd = await googleMapsDistanceKm(pLat, pLng, customerLat, customerLng, apiKey);
    if (gd !== null) {
      distanceKm = gd;
      source = "google";
    } else {
      distanceKm = haversineKm(pLat, pLng, customerLat, customerLng);
    }
  } else {
    distanceKm = haversineKm(pLat, pLng, customerLat, customerLng);
  }

  const etaMinutes = PREP_TIME_MINUTES + Math.ceil(distanceKm / AVG_SPEED_KM_PER_MIN);
  const deliveryFee = Math.round((BASE_FEE_TND + FEE_PER_KM_TND * distanceKm) * 100) / 100;

  return { distanceKm, etaMinutes, deliveryFee, source };
}
