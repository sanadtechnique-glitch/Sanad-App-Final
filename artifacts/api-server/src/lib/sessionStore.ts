import { randomBytes } from "node:crypto";

interface SessionEntry {
  userId: number;
  role: string;
  username: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const store = new Map<string, SessionEntry>();

export function createSession(userId: number, role: string, username: string): string {
  const token = randomBytes(32).toString("hex");
  store.set(token, { userId, role, username, expiresAt: Date.now() + SESSION_TTL_MS });
  // Cleanup expired sessions periodically
  if (store.size > 500) purgeExpired();
  return token;
}

export function getSession(token: string): SessionEntry | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(token); return null; }
  return entry;
}

export function deleteSession(token: string): void {
  store.delete(token);
}

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}
