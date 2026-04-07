import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { adsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Public — active non-expired ads
router.get("/ads", async (req, res) => {
  try {
    const now = new Date();
    const all = await db.select().from(adsTable).orderBy(adsTable.createdAt);
    const active = all.filter(a => {
      if (!a.isActive) return false;
      if (a.expiresAt && new Date(a.expiresAt) < now) return false;
      return true;
    });
    res.json(active);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Admin — all ads
router.get("/admin/ads", async (req, res) => {
  try {
    res.json(await db.select().from(adsTable).orderBy(adsTable.createdAt));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Admin — create ad
router.post("/admin/ads", async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, isActive, expiresAt } = req.body;
    if (!title) return res.status(400).json({ message: "title required" });
    const [ad] = await db.insert(adsTable).values({
      title,
      imageUrl: imageUrl || null,
      linkUrl: linkUrl || null,
      isActive: isActive !== false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.status(201).json(ad);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Admin — update ad
router.patch("/admin/ads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, imageUrl, linkUrl, isActive, expiresAt } = req.body;
    const updates: Record<string, unknown> = {};
    if (title !== undefined)     updates.title     = title;
    if (imageUrl !== undefined)  updates.imageUrl  = imageUrl;
    if (linkUrl !== undefined)   updates.linkUrl   = linkUrl || null;
    if (isActive !== undefined)  updates.isActive  = isActive;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    const [ad] = await db.update(adsTable).set(updates).where(eq(adsTable.id, id)).returning();
    if (!ad) return res.status(404).json({ message: "Not found" });
    res.json(ad);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Admin — delete ad
router.delete("/admin/ads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(adsTable).where(eq(adsTable.id, id));
    res.json({ ok: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Track click
router.post("/ads/:id/click", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!ad) return res.status(404).json({ message: "Not found" });
    await db.update(adsTable).set({ clickCount: ad.clickCount + 1 }).where(eq(adsTable.id, id));
    res.json({ ok: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
