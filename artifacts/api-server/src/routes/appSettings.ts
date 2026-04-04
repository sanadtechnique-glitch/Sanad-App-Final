import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";

const router = Router();

// GET /app-settings — public, returns all settings as { key: value } map
router.get("/app-settings", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const map: Record<string, string | null> = {};
    for (const row of rows) map[row.key] = row.value;
    res.json(map);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /app-settings/:key — public, single value
router.get("/app-settings/:key", async (req, res) => {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, req.params.key));
    res.json({ key: req.params.key, value: row?.value ?? null });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /admin/app-settings/:key — admin only, upsert
router.put("/admin/app-settings/:key", requireAdmin, async (req, res) => {
  const { value } = req.body;
  const key = req.params.key;
  try {
    const [existing] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    let row;
    if (existing) {
      [row] = await db.update(appSettingsTable).set({ value: value ?? null, updatedAt: new Date() }).where(eq(appSettingsTable.key, key)).returning();
    } else {
      [row] = await db.insert(appSettingsTable).values({ key, value: value ?? null }).returning();
    }
    res.json(row);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
