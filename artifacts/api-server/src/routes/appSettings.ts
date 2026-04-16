import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";
import { withCache, cacheDelete } from "../lib/cache";

const router = Router();

// GET /app-settings — public, returns all settings as { key: value } map
router.get("/app-settings", async (_req, res) => {
  try {
    const map = await withCache<Record<string, string | null>>("app-settings:all", 300, async () => {
      const rows = await db.select().from(appSettingsTable);
      const m: Record<string, string | null> = {};
      for (const row of rows) m[row.key] = row.value;
      return m;
    });
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
    cacheDelete("app-settings:all");
    res.json(row);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /admin/app-settings/bulk — upsert multiple settings at once
router.patch("/admin/app-settings/bulk", requireAdmin, async (req, res) => {
  const { settings } = req.body as { settings: Array<{ key: string; value: string }> };
  if (!Array.isArray(settings) || settings.length === 0) {
    res.status(400).json({ message: "settings must be a non-empty array" }); return;
  }
  try {
    for (const { key, value } of settings) {
      if (!key) continue;
      const [existing] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
      if (existing) {
        await db.update(appSettingsTable).set({ value: value ?? null, updatedAt: new Date() }).where(eq(appSettingsTable.key, key));
      } else {
        await db.insert(appSettingsTable).values({ key, value: value ?? null });
      }
    }
    cacheDelete("app-settings:all");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
