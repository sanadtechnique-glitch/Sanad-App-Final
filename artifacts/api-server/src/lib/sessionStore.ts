import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function createSession(userId: number, role: string, username: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessionsTable).values({ token, userId, role, username, expiresAt });

  // Cleanup expired sessions occasionally (1% of the time)
  if (Math.random() < 0.01) {
    db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date())).catch(() => {});
  }

  return token;
}

export async function getSession(token: string): Promise<{ userId: number; role: string; username: string } | null> {
  try {
    const [entry] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, token))
      .limit(1);

    if (!entry) return null;
    if (new Date() > entry.expiresAt) {
      db.delete(sessionsTable).where(eq(sessionsTable.token, token)).catch(() => {});
      return null;
    }
    return { userId: entry.userId, role: entry.role, username: entry.username };
  } catch {
    return null;
  }
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}
