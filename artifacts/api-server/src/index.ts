import httpServer from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import {
  usersTable, serviceProvidersTable, deliveryStaffTable,
  ordersTable, productsTable, ratingsTable, hotelBookingsTable,
} from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const ADMIN_PHONE = "21600000001";

async function seedDefaultAdmin() {
  try {
    const existing = await db
      .select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.username, "admin"))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(usersTable).values({
        username: "admin",
        name: "مدير النظام",
        role: "super_admin",
        password: "Abc1234",
        phone: ADMIN_PHONE,
        isActive: true,
      });
      logger.info("Default admin user created (admin / Abc1234)");
    } else if (!existing[0]!.phone) {
      // Ensure admin always has a phone so phone-based login works
      await db
        .update(usersTable)
        .set({ phone: ADMIN_PHONE })
        .where(eq(usersTable.username, "admin"));
      logger.info("Admin phone updated to " + ADMIN_PHONE);
    }
  } catch (err) {
    logger.warn({ err }, "Could not seed default admin — table may not exist yet");
  }
}

// One-time production data cleanup using Replit KV as a flag store.
// After the flag is set the cleanup never runs again, even on restarts.
const CLEANUP_FLAG = "SANAD_PROD_CLEANUP_V1";

async function replitKvGet(key: string): Promise<string | null> {
  const dbUrl = process.env["REPLIT_DB_URL"];
  if (!dbUrl) return null;
  try {
    const res = await fetch(`${dbUrl}/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

async function replitKvSet(key: string, value: string): Promise<void> {
  const dbUrl = process.env["REPLIT_DB_URL"];
  if (!dbUrl) return;
  try {
    await fetch(dbUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    });
  } catch {
    // ignore
  }
}

async function oneTimeCleanupIfNeeded() {
  // Only run in the deployed production environment
  if (process.env["NODE_ENV"] !== "production") {
    logger.info("Non-production env — skipping one-time DB cleanup.");
    return;
  }

  const done = await replitKvGet(CLEANUP_FLAG);
  if (done === "true") {
    logger.info("One-time DB cleanup already ran — skipping.");
    return;
  }

  try {
    logger.info("Running one-time production DB cleanup…");
    await db.delete(ratingsTable);
    await db.delete(hotelBookingsTable);
    await db.delete(ordersTable);
    await db.delete(productsTable);
    await db.delete(deliveryStaffTable);
    await db.delete(serviceProvidersTable);
    await db.delete(usersTable).where(ne(usersTable.role, "super_admin"));
    await replitKvSet(CLEANUP_FLAG, "true");
    logger.info("One-time production DB cleanup complete — flag set to prevent re-run.");
  } catch (err) {
    logger.warn({ err }, "One-time cleanup failed — will retry on next start.");
  }
}

httpServer.listen(port, async (err: Error | null) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedDefaultAdmin();
  await oneTimeCleanupIfNeeded();
});
