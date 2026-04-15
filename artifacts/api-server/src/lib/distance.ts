import { db } from "@workspace/db";
import { deliveryConfigTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// ─── Ben Guerdane city centre (fallback when provider has no coordinates) ──────
const BEN_GUERDANE_LAT = 33.1167;
const BEN_GUERDANE_LNG = 11.2167;

// ─── Pricing constants (used as fallback when DB config unavailable) ───────────
const BASE_FARE     = 4.800;
const RATE_PER_KM   = 0.500;
const ROAD_FACTOR   = 1.35;
const MIN_FARE      = 4.800;
const AVG_SPEED_KPM = 0.500;
const PREP_MINUTES  = 15;

// ─── Result shape ─────────────────────────────────────────────────────────────
export interface DistanceResult {
  distanceKm:      number;
  etaMinutes:      number;
  deliveryFee:     number;
  baseFee:         number;
  kmFee:           number;
  isNight:         boolean;
  source:          "haversine";
  // [E-2] true when provider had stored coordinates; false = used city-centre fallback
  providerCoordsSet: boolean;
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

// [P-3 FIXED] In-memory cache for pricing config — refreshes every 5 minutes
let _configCache: { baseFee: number; minFee: number; ratePerKm: number } | null = null;
let _configCacheAt = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchPricingConfig(): Promise<{ baseFee: number; minFee: number; ratePerKm: number }> {
  if (_configCache && (Date.now() - _configCacheAt) < CONFIG_CACHE_TTL) {
    return _configCache;
  }
  try {
    const [row] = await db.select().from(deliveryConfigTable).where(eq(deliveryConfigTable.id, 1));
    if (row) {
      _configCache   = { baseFee: row.baseFee, minFee: row.minFee, ratePerKm: row.ratePerKm };
      _configCacheAt = Date.now();
      return _configCache;
    }
  } catch { /* fall through to hardcoded defaults */ }
  return { baseFee: BASE_FARE, minFee: MIN_FARE, ratePerKm: RATE_PER_KM };
}

export function invalidateConfigCache(): void {
  _configCache   = null;
  _configCacheAt = 0;
}

export async function calculateDistance(
  providerLat: number | null | undefined,
  providerLng: number | null | undefined,
  customerLat: number,
  customerLng: number,
): Promise<DistanceResult> {
  const cfg  = await fetchPricingConfig();

  // [E-2] Track whether we used real provider coordinates or the city-centre fallback
  const hasCoords = providerLat != null && !isNaN(providerLat) && providerLng != null && !isNaN(providerLng);
  const pLat = hasCoords ? providerLat! : BEN_GUERDANE_LAT;
  const pLng = hasCoords ? providerLng! : BEN_GUERDANE_LNG;

  const distanceKm = haversineKm(pLat, pLng, customerLat, customerLng);
  const kmFee      = Math.round(cfg.ratePerKm * distanceKm * 100) / 100;

  const night      = isNight();
  const rawFee     = cfg.baseFee + kmFee;
  const nightBonus = night ? Math.round(rawFee * 0.20 * 100) / 100 : 0;

  const deliveryFee = Math.max(
    Math.round((rawFee + nightBonus) * 100) / 100,
    cfg.minFee,
  );

  const etaMinutes = PREP_MINUTES + Math.ceil(distanceKm / AVG_SPEED_KPM);

  return {
    distanceKm,
    etaMinutes,
    deliveryFee,
    baseFee:  cfg.baseFee,
    kmFee,
    isNight:  night,
    source:   "haversine",
    providerCoordsSet: hasCoords,
  };
}

// ─── Provider coordinates lookup ─────────────────────────────────────────────
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
