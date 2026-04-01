// Legacy roles (used in existing flows: login.tsx, layout.tsx, etc.)
export type Role = "client" | "provider" | "delivery" | "admin"
  | "super_admin" | "manager" | "driver" | "customer";

// New role values for the privilege system
export type AppRole = "super_admin" | "manager" | "provider" | "driver" | "customer";

export const ROLE_META: Record<AppRole, { ar: string; fr: string; color: string; badge: string }> = {
  super_admin: { ar: "مدير عام",    fr: "Super Admin", color: "#0D3311", badge: "bg-[#0D3311]/15 text-[#0D3311] border-[#0D3311]/30" },
  manager:     { ar: "مسؤول",       fr: "Manager",     color: "#1A4D1F", badge: "bg-[#1A4D1F]/15 text-[#1A4D1F] border-[#1A4D1F]/30" },
  provider:    { ar: "مزود / تاجر", fr: "Fournisseur", color: "#1A4D1F", badge: "bg-[#1A4D1F]/15 text-[#1A4D1F] border-[#1A4D1F]/30" },
  driver:      { ar: "موزع",        fr: "Livreur",     color: "#0D3311", badge: "bg-[#0D3311]/15 text-[#0D3311] border-[#0D3311]/30" },
  customer:    { ar: "زبون",        fr: "Client",      color: "#FFA500", badge: "bg-[#FFA500]/15 text-[#FFA500] border-[#FFA500]/30" },
};

// Sections each role may access in the admin panel
export const ROLE_SECTIONS: Record<AppRole | "admin", string[]> = {
  super_admin: ["overview", "orders", "hotelBookings", "categories", "suppliers", "articles", "staff", "delegations", "banners", "users"],
  manager:     ["overview", "orders", "hotelBookings", "banners"],
  admin:       ["overview", "orders", "hotelBookings", "categories", "suppliers", "articles", "staff", "delegations", "banners", "users"],
  provider:    [],
  driver:      [],
  customer:    [],
};

export interface DcSession {
  role: Role;
  name: string;
  userId?: number;
  supplierId?: number;
  staffId?: number;
  delegationId?: number;
  delegationFee?: number;
  delegationName?: string;
  expiresAt?: number;
  /** Server-issued session token — sent as X-Session-Token header on authenticated requests */
  token?: string;
}

const KEY = "dc_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const getSession = (): DcSession | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s: DcSession = JSON.parse(raw);
    if (!s.expiresAt || Date.now() > s.expiresAt) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch { return null; }
};

export const setSession = (s: DcSession): void => {
  localStorage.setItem(KEY, JSON.stringify({ ...s, expiresAt: Date.now() + SESSION_TTL_MS }));
};

export const clearSession = (): void => {
  localStorage.removeItem(KEY);
};

/** Returns the stored session token (if any) */
export const getSessionToken = (): string | null => {
  return getSession()?.token ?? null;
};

/** Returns true if the session role has admin-level access */
export const isAdminRole = (role: Role | undefined): boolean =>
  role === "admin" || role === "super_admin" || role === "manager";

/** Returns true if the session role has full super-admin access */
export const isSuperAdmin = (role: Role | undefined): boolean =>
  role === "admin" || role === "super_admin";
