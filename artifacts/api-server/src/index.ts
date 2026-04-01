import httpServer from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

async function seedDefaultAdmin() {
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, "admin"))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(usersTable).values({
        username: "admin",
        name: "مدير النظام",
        role: "super_admin",
        password: "Abc1234",
        isActive: true,
      });
      logger.info("Default admin user created (admin / Abc1234)");
    }
  } catch (err) {
    logger.warn({ err }, "Could not seed default admin — table may not exist yet");
  }
}

httpServer.listen(port, async (err: Error | null) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedDefaultAdmin();
});
