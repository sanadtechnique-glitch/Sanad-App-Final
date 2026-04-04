import { getSessionToken, clearSession } from "./auth";

const BASE = "/api";

function handleSessionExpired() {
  clearSession();
  window.location.href = "/login";
}

export async function api<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) headers["X-Session-Token"] = token;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    const err = await res.json().catch(() => ({ message: "Session expired or invalid" }));
    const msg: string = (err as any).message ?? "";
    if (
      msg.includes("expired") ||
      msg.includes("invalid") ||
      msg.includes("Authentication required")
    ) {
      handleSessionExpired();
    }
    throw new Error(msg || "Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as any).message || "Request failed");
  }
  return res.json() as Promise<T>;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
