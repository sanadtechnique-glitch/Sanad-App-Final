/**
 * AUTO PRICING ENGINE — سند · Sanad
 * Automatically adjusts delivery fees based on real-time context.
 * Zero admin intervention required.
 *
 * Priority order (first match wins):
 *   1. Night        22:00 – 06:00  → +30%
 *   2. Peak evening 18:00 – 21:00  → +20%
 *   3. Peak noon    12:00 – 14:00  → +15%
 *   4. Weekend      Fri (5) & Sat (6) → +10%
 *   5. Normal                        → +0%
 */

export interface AutoContext {
  label: "night" | "peak_evening" | "peak_noon" | "weekend" | "normal";
  labelAr: string;
  labelFr: string;
  emoji: string;
  surchargePercent: number;
}

// Built-in defaults — no admin config needed
export const AUTO_BASE_FEE     = 4.800; // TND
export const AUTO_RATE_PER_KM  = 0.500; // TND/km
export const AUTO_MIN_FEE      = 4.800; // TND
export const AUTO_PREP_MINUTES = 15;
export const AUTO_SPEED_KM_MIN = 0.5;  // 30 km/h

export function getAutoContext(now: Date = new Date()): AutoContext {
  const h   = now.getHours();
  const day = now.getDay(); // 0 = Sun, 1 = Mon … 5 = Fri, 6 = Sat

  // 1. Night: 22:00 – 05:59
  if (h >= 22 || h < 6) {
    return {
      label: "night",
      labelAr: "وقت الليل 🌙",
      labelFr: "Nuit 🌙",
      emoji: "🌙",
      surchargePercent: 30,
    };
  }

  // 2. Peak evening: 18:00 – 20:59
  if (h >= 18 && h < 21) {
    return {
      label: "peak_evening",
      labelAr: "ذروة المساء 🔥",
      labelFr: "Pointe soir 🔥",
      emoji: "🔥",
      surchargePercent: 20,
    };
  }

  // 3. Peak noon: 12:00 – 13:59
  if (h >= 12 && h < 14) {
    return {
      label: "peak_noon",
      labelAr: "ذروة الظهيرة ☀️",
      labelFr: "Pointe midi ☀️",
      emoji: "☀️",
      surchargePercent: 15,
    };
  }

  // 4. Weekend: Friday & Saturday
  if (day === 5 || day === 6) {
    return {
      label: "weekend",
      labelAr: "عطلة نهاية الأسبوع 🎉",
      labelFr: "Week-end 🎉",
      emoji: "🎉",
      surchargePercent: 10,
    };
  }

  // 5. Normal
  return {
    label: "normal",
    labelAr: "وقت عادي ✅",
    labelFr: "Tarif normal ✅",
    emoji: "✅",
    surchargePercent: 0,
  };
}

export interface AutoFeeResult {
  baseFee: number;
  kmFee: number;
  surchargeAmount: number;
  deliveryFee: number;
  context: AutoContext;
  etaMinutes: number;
}

export interface PricingConfig {
  baseFee:    number;
  minFee:     number;
  ratePerKm:  number;
}

export function calcAutoFee(
  distanceKm: number,
  now: Date = new Date(),
  cfg?: Partial<PricingConfig>,   // ← accepts DB values when provided
): AutoFeeResult {
  const effectiveBase    = cfg?.baseFee   ?? AUTO_BASE_FEE;
  const effectiveMin     = cfg?.minFee    ?? AUTO_MIN_FEE;
  const effectiveRate    = cfg?.ratePerKm ?? AUTO_RATE_PER_KM;

  const ctx      = getAutoContext(now);
  const baseFee  = effectiveBase;
  const kmFee    = Math.round(effectiveRate * distanceKm * 100) / 100;
  let   subtotal = baseFee + kmFee;

  const surchargeAmount = ctx.surchargePercent > 0
    ? Math.round(subtotal * (ctx.surchargePercent / 100) * 100) / 100
    : 0;
  subtotal += surchargeAmount;
  subtotal  = Math.max(subtotal, effectiveMin);  // ← DB minFee enforced here

  const etaMinutes = AUTO_PREP_MINUTES + Math.ceil(distanceKm / AUTO_SPEED_KM_MIN);

  return {
    baseFee,
    kmFee,
    surchargeAmount,
    deliveryFee: Math.round(subtotal * 100) / 100,
    context: ctx,
    etaMinutes,
  };
}
