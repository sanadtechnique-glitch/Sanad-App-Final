import { db } from "@workspace/db";
import { deliveryConfigTable } from "@workspace/db/schema";

const BEN_GUERDANE_LAT = 33.1167;
const BEN_GUERDANE_LNG = 11.2167;

// ─── Default values (used as fallback if DB not available) ───────────────────
const DEFAULTS = {
  baseFee: 2.0,
  ratePerKm: 0.5,
  minFee: 2.0,
  maxFee: null as number | null,
  nightSurchargePercent: 0,
  nightStartHour: 22,
  nightEndHour: 6,
  platformCommissionPercent: 0,
  prepTimeMinutes: 15,
  avgSpeedKmPerMin: 0.5,
  expressEnabled: false,
  expressSurchargeTnd: 1.0,
  fixedFeeEnabled: false,
  fixedFeeTnd: 5.0,
};

export type DeliveryConfigSnapshot = typeof DEFAULTS;

// ─── Cache: reload at most every 60 s to avoid per-request DB hits ───────────
let cachedConfig: DeliveryConfigSnapshot | null = null;
let cacheExpiresAt = 0;

export async function getDeliveryConfig(): Promise<DeliveryConfigSnapshot> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiresAt) return cachedConfig;

  try {
    const rows = await db.select().from(deliveryConfigTable).limit(1);
    if (rows.length === 0) {
      // Seed the default row
      await db.insert(deliveryConfigTable).values({ id: 1 }).onConflictDoNothing();
      cachedConfig = { ...DEFAULTS };
    } else {
      const r = rows[0];
      cachedConfig = {
        baseFee:                   r.baseFee,
        ratePerKm:                 r.ratePerKm,
        minFee:                    r.minFee,
        maxFee:                    r.maxFee ?? null,
        nightSurchargePercent:     r.nightSurchargePercent,
        nightStartHour:            r.nightStartHour,
        nightEndHour:              r.nightEndHour,
        platformCommissionPercent: r.platformCommissionPercent,
        prepTimeMinutes:           r.prepTimeMinutes,
        avgSpeedKmPerMin:          r.avgSpeedKmPerMin,
        expressEnabled:            r.expressEnabled,
        expressSurchargeTnd:       r.expressSurchargeTnd,
        fixedFeeEnabled:           r.fixedFeeEnabled,
        fixedFeeTnd:               r.fixedFeeTnd,
      };
    }
    cacheExpiresAt = now + 60_000;
  } catch {
    cachedConfig = { ...DEFAULTS };
    cacheExpiresAt = now + 10_000;
  }
  return cachedConfig;
}

export function invalidateConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

// ─── Haversine formula ────────────────────────────────────────────────────────
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1.35 * 100) / 100;
}

// ─── Google Maps Distance Matrix (optional) ───────────────────────────────────
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

// ─── Night surcharge helper ───────────────────────────────────────────────────
function isNightTime(cfg: DeliveryConfigSnapshot): boolean {
  if (cfg.nightSurchargePercent === 0) return false;
  const h = new Date().getHours();
  const s = cfg.nightStartHour;
  const e = cfg.nightEndHour;
  return s > e ? (h >= s || h < e) : (h >= s && h < e);
}

// ─── Main calculation result ──────────────────────────────────────────────────
export interface DistanceResult {
  distanceKm: number;
  etaMinutes: number;
  deliveryFee: number;
  baseFee: number;
  kmFee: number;
  nightSurcharge: number;
  platformCommission: number;
  isNight: boolean;
  isFixed: boolean;
  source: "google" | "haversine";
}

export async function calculateDistance(
  providerLat: number | null | undefined,
  providerLng: number | null | undefined,
  customerLat: number,
  customerLng: number,
  options?: { express?: boolean },
): Promise<DistanceResult> {
  const cfg = await getDeliveryConfig();
  const pLat = providerLat ?? BEN_GUERDANE_LAT;
  const pLng = providerLng ?? BEN_GUERDANE_LNG;

  // 1. Distance (always compute for ETA, even in fixed mode)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  let distanceKm: number;
  let source: "google" | "haversine" = "haversine";

  if (apiKey) {
    const gd = await googleMapsDistanceKm(pLat, pLng, customerLat, customerLng, apiKey);
    if (gd !== null) { distanceKm = gd; source = "google"; }
    else { distanceKm = haversineKm(pLat, pLng, customerLat, customerLng); }
  } else {
    distanceKm = haversineKm(pLat, pLng, customerLat, customerLng);
  }

  // 2. ETA
  const etaMinutes = cfg.prepTimeMinutes + Math.ceil(distanceKm / cfg.avgSpeedKmPerMin);

  // 3. Fixed fee mode — skip distance-based calculation
  if (cfg.fixedFeeEnabled) {
    const deliveryFee = Math.round(cfg.fixedFeeTnd * 100) / 100;
    const platformCommission = Math.round(deliveryFee * (cfg.platformCommissionPercent / 100) * 100) / 100;
    return {
      distanceKm,
      etaMinutes,
      deliveryFee,
      baseFee: deliveryFee,
      kmFee: 0,
      nightSurcharge: 0,
      platformCommission,
      isNight: false,
      isFixed: true,
      source,
    };
  }

  // 4. Base fee breakdown (dynamic mode)
  const baseFee = cfg.baseFee;
  const kmFee   = Math.round(cfg.ratePerKm * distanceKm * 100) / 100;
  let subtotal   = baseFee + kmFee;

  // 5. Express surcharge
  if (options?.express && cfg.expressEnabled) {
    subtotal += cfg.expressSurchargeTnd;
  }

  // 6. Night surcharge
  const night = isNightTime(cfg);
  const nightSurcharge = night
    ? Math.round(subtotal * (cfg.nightSurchargePercent / 100) * 100) / 100
    : 0;
  subtotal += nightSurcharge;

  // 7. Min / Max cap
  subtotal = Math.max(subtotal, cfg.minFee);
  if (cfg.maxFee != null) subtotal = Math.min(subtotal, cfg.maxFee);

  // 8. Platform commission (informational — not added to customer fee)
  const platformCommission = Math.round(subtotal * (cfg.platformCommissionPercent / 100) * 100) / 100;

  const deliveryFee = Math.round(subtotal * 100) / 100;

  return {
    distanceKm,
    etaMinutes,
    deliveryFee,
    baseFee,
    kmFee,
    nightSurcharge,
    platformCommission,
    isNight: night,
    isFixed: false,
    source,
  };
}
