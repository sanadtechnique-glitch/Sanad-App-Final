export type Role = "client" | "provider" | "delivery" | "admin";

export interface DcSession {
  role: Role;
  name: string;
  supplierId?: number;
  staffId?: number;
  delegationId?: number;
  delegationFee?: number;
  delegationName?: string;
}

const KEY = "dc_session";

export const getSession = (): DcSession | null => {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
  catch { return null; }
};

export const setSession = (s: DcSession): void => {
  localStorage.setItem(KEY, JSON.stringify(s));
};

export const clearSession = (): void => {
  localStorage.removeItem(KEY);
};
