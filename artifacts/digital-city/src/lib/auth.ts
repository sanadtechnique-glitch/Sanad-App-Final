// Legacy roles (used in existing flows: login.tsx, layout.tsx, etc.)
export type Role = "client" | "provider" | "delivery" | "admin"
  | "super_admin" | "manager" | "driver" | "customer";

// New role values for the privilege system
export type AppRole = "super_admin" | "manager" | "provider" | "driver" | "customer";

export const ROLE_META: Record<AppRole, { ar: string; fr: string; color: string; badge: string }> = {
  super_admin: { ar: "مدير عام",    fr: "Super Admin", color: "#1B5E20", badge: "bg-[#1B5E20]/15 text-[#1B5E20] border-[#1B5E20]/30" },
  manager:     { ar: "مسؤول",       fr: "Manager",     color: "#2E7D32", badge: "bg-[#2E7D32]/15 text-[#2E7D32] border-[#2E7D32]/30" },
  provider:    { ar: "مزود / تاجر", fr: "Fournisseur", color: "#4CAF50", badge: "bg-[#4CAF50]/15 text-[#4CAF50] border-[#4CAF50]/30" },
  driver:      { ar: "موزع",        fr: "Livreur",     color: "#388E3C", badge: "bg-[#388E3C]/15 text-[#388E3C] border-[#388E3C]/30" },
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

/** Returns true if the session role has admin-level access */
export const isAdminRole = (role: Role | undefined): boolean =>
  role === "admin" || role === "super_admin" || role === "manager";

/** Returns true if the session role has full super-admin access */
export const isSuperAdmin = (role: Role | undefined): boolean =>
  role === "admin" || role === "super_admin";
