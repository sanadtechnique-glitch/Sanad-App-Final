import { Router } from "express";
import { db } from "@workspace/db";
import { partnerLogosTable, insertPartnerLogoSchema } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";

const router = Router();

// ── PUBLIC: GET /partners — active partner logos ──────────────────────────────
router.get("/partners", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(partnerLogosTable)
      .where(eq(partnerLogosTable.isActive, true))
      .orderBy(asc(partnerLogosTable.sortOrder), asc(partnerLogosTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── ADMIN: GET /admin/partners — all partner logos ────────────────────────────
router.get("/admin/partners", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(partnerLogosTable)
      .orderBy(asc(partnerLogosTable.sortOrder), asc(partnerLogosTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── ADMIN: POST /admin/partners — create ──────────────────────────────────────
router.post("/admin/partners", requireAdmin, async (req, res) => {
  try {
    const data = insertPartnerLogoSchema.parse(req.body);
    const [row] = await db.insert(partnerLogosTable).values(data).returning();
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── ADMIN: PATCH /admin/partners/:id — update ─────────────────────────────────
router.patch("/admin/partners/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db
      .update(partnerLogosTable)
      .set(req.body)
      .where(eq(partnerLogosTable.id, id))
      .returning();
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── ADMIN: DELETE /admin/partners/:id — delete ────────────────────────────────
router.delete("/admin/partners/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(partnerLogosTable).where(eq(partnerLogosTable.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
