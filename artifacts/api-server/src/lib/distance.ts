import { db } from "@workspace/db";
import { serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ─── Ben Guerdane city centre (fallback when provider has no coordinates) ──────
const BEN_GUERDANE_LAT = 33.1167;
const BEN_GUERDANE_LNG = 11.2167;

// ─── Pricing constants ────────────────────────────────────────────────────────
const BASE_FARE     = 2.500; // DT — fixed starting fare
const RATE_PER_KM   = 0.500; // DT added per km
const ROAD_FACTOR   = 1.35;  // straight-line → estimated road distance
const MIN_FARE      = 2.500; // DT — absolute floor, never go below
const AVG_SPEED_KPM = 0.500; // km per minute (avg delivery speed)
const PREP_MINUTES  = 15;    // preparation time before dispatch

// ─── Result shape ─────────────────────────────────────────────────────────────
export interface DistanceResult {
  distanceKm:  number;
  etaMinutes:  number;
  deliveryFee: number;
  baseFee:     number;
  kmFee:       number;
  isNight:     boolean;
  source:      "haversine";
}

// ─── Haversine formula (straight-line × road factor) ─────────────────────────
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * ROAD_FACTOR * 100) / 100;
}

// ─── Night-time detection (22:00 – 06:00) ────────────────────────────────────
function isNight(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

// ─── Main calculation ─────────────────────────────────────────────────────────
// Provider coordinates are fetched from DB using providerId.
// Fallback: Ben Guerdane city centre when provider has no stored coordinates.
//
// Formula:
//   deliveryFee = Math.max(MIN_FARE, BASE_FARE + (distanceKm × RATE_PER_KM))
//
// Night surcharge (+20%) is applied on top when applicable.
export async function calculateDistance(
  providerLat: number | null | undefined,
  providerLng: number | null | undefined,
  customerLat: number,
  customerLng: number,
): Promise<DistanceResult> {
  const pLat = (providerLat != null && !isNaN(providerLat)) ? providerLat : BEN_GUERDANE_LAT;
  const pLng = (providerLng != null && !isNaN(providerLng)) ? providerLng : BEN_GUERDANE_LNG;

  const distanceKm = haversineKm(pLat, pLng, customerLat, customerLng);
  const kmFee      = Math.round(RATE_PER_KM * distanceKm * 100) / 100;

  // Apply night surcharge (+20%) when order is placed between 22:00 and 06:00
  const night      = isNight();
  const rawFee     = BASE_FARE + kmFee;
  const nightBonus = night ? Math.round(rawFee * 0.20 * 100) / 100 : 0;

  const deliveryFee = Math.max(
    Math.round((rawFee + nightBonus) * 100) / 100,
    MIN_FARE,
  );

  const etaMinutes = PREP_MINUTES + Math.ceil(distanceKm / AVG_SPEED_KPM);

  return {
    distanceKm,
    etaMinutes,
    deliveryFee,
    baseFee: BASE_FARE,
    kmFee,
    isNight: night,
    source:  "haversine",
  };
}

// ─── Provider coordinates lookup (used by /api/distance route) ────────────────
export async function getProviderCoords(
  providerId: number,
): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const [p] = await db
      .select({ latitude: serviceProvidersTable.latitude, longitude: serviceProvidersTable.longitude })
      .from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.id, providerId));
    return p ?? { latitude: null, longitude: null };
  } catch {
    return { latitude: null, longitude: null };
  }
}

// ─── Stub — kept so deliveryConfig route import does not break ────────────────
export function invalidateConfigCache(): void { /* no-op — config cache removed */ }
