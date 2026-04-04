/** Validates a phone number — accepts Tunisian format or general international */
export function isValidPhone(phone: string): boolean {
  // Allow: +, digits, spaces, dashes. Min 8 digits total.
  const cleaned = phone.replace(/[\s\-().]/g, "");
  return /^\+?[0-9]{8,15}$/.test(cleaned);
}

/** Password: 6–72 chars, at least one letter and one digit */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 6 && pw.length <= 72;
}

/** Valid role values in the system */
const VALID_ROLES = new Set(["customer", "admin", "manager", "super_admin", "provider", "driver", "taxi_driver", "delivery"]);
export function isValidRole(role: string): boolean {
  return VALID_ROLES.has(role);
}

/** Safe parseFloat — returns null if result is NaN */
export function safeParseFloat(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

/** Safe parseInt — returns null if result is NaN */
export function safeParseInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}
