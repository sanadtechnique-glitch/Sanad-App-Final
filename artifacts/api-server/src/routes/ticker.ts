import { Router } from "express";
import { db } from "@workspace/db";
import { tickerAdsTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";

const router = Router();

// ── PUBLIC: GET /ticker — global ticker (home page) ──────────────────────────
router.get("/ticker", async (req, res) => {
  try {
    const ads = await db
      .select()
      .from(tickerAdsTable)
      .where(and(eq(tickerAdsTable.isActive, true), isNull(tickerAdsTable.supplierId)))
      .orderBy(tickerAdsTable.sortOrder, tickerAdsTable.createdAt);
    res.json(ads);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── PUBLIC: GET /ticker/supplier/:id — supplier-specific ticker ───────────────
router.get("/ticker/supplier/:id", async (req, res) => {
  const supplierId = parseInt(req.params.id);
  if (isNaN(supplierId)) return res.status(400).json({ message: "Invalid supplier id" });
  try {
    const ads = await db
      .select()
      .from(tickerAdsTable)
      .where(and(eq(tickerAdsTable.isActive, true), eq(tickerAdsTable.supplierId, supplierId)))
      .orderBy(tickerAdsTable.sortOrder, tickerAdsTable.createdAt);
    res.json(ads);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADMIN: GET /admin/ticker — all ticker ads ─────────────────────────────────
router.get("/admin/ticker", requireAdmin, async (req, res) => {
  try {
    const ads = await db
      .select()
      .from(tickerAdsTable)
      .orderBy(tickerAdsTable.supplierId, tickerAdsTable.sortOrder);
    res.json(ads);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADMIN: POST /admin/ticker — create ───────────────────────────────────────
router.post("/admin/ticker", requireAdmin, async (req, res) => {
  const { textAr, textFr, supplierId, bgColor, textColor, sortOrder, imageUrl, linkUrl } = req.body;
  if (!textAr) return res.status(400).json({ message: "textAr is required" });
  try {
    const [ad] = await db.insert(tickerAdsTable).values({
      textAr,
      textFr: textFr || null,
      imageUrl: imageUrl || null,
      linkUrl: linkUrl || null,
      supplierId: supplierId ? parseInt(supplierId) : null,
      bgColor: bgColor || "#1A4D1F",
      textColor: textColor || "#FFFFFF",
      sortOrder: sortOrder ?? 0,
      isActive: true,
    }).returning();
    res.status(201).json(ad);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADMIN: PATCH /admin/ticker/:id — update ───────────────────────────────────
router.patch("/admin/ticker/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const { textAr, textFr, bgColor, textColor, isActive, sortOrder, imageUrl, linkUrl } = req.body;
  try {
    const updates: Partial<typeof tickerAdsTable.$inferInsert> = {};
    if (textAr !== undefined) updates.textAr = textAr;
    if (textFr !== undefined) updates.textFr = textFr;
    if (bgColor !== undefined) updates.bgColor = bgColor;
    if (textColor !== undefined) updates.textColor = textColor;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl || null;
    if (linkUrl !== undefined) updates.linkUrl = linkUrl || null;
    const [updated] = await db.update(tickerAdsTable).set(updates).where(eq(tickerAdsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── ADMIN: DELETE /admin/ticker/:id ──────────────────────────────────────────
router.delete("/admin/ticker/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    await db.delete(tickerAdsTable).where(eq(tickerAdsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
