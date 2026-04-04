import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { promoBannersTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

// Public endpoint — used by the home page to fetch active banners
router.get("/banners", async (req, res) => {
  try {
    const now = new Date();
    const banners = await db.select().from(promoBannersTable)
      .where(eq(promoBannersTable.isActive, true))
      .orderBy(asc(promoBannersTable.createdAt));
    const active = banners.filter(b => {
      if (b.startsAt && new Date(b.startsAt) > now) return false;
      if (b.endsAt && new Date(b.endsAt) < now) return false;
      return true;
    });
    res.json(active);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.get("/admin/banners", requireAdmin, async (req, res) => {
  try {
    res.json(await db.select().from(promoBannersTable).orderBy(asc(promoBannersTable.createdAt)));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/banners", requireAdmin, async (req, res) => {
  const { titleAr, titleFr, subtitleAr, subtitleFr, imageUrl, link, bgColor, bgFrom, bgTo, accent, isActive, startsAt, endsAt } = req.body;
  if (!titleAr || !titleFr) { res.status(400).json({ message: "titleAr and titleFr required" }); return; }
  try {
    const [row] = await db.insert(promoBannersTable).values({
      titleAr, titleFr,
      subtitleAr: subtitleAr || null,
      subtitleFr: subtitleFr || null,
      imageUrl: imageUrl || null,
      link: link || null,
      bgColor: bgColor || "#1A4D1F",
      bgFrom: bgFrom || "#1A4D1F",
      bgTo: bgTo || "#0D3311",
      accent: accent || "#FFA500",
      isActive: isActive ?? true,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/banners/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { titleAr, titleFr, subtitleAr, subtitleFr, imageUrl, link, bgColor, bgFrom, bgTo, accent, isActive, startsAt, endsAt } = req.body;
  try {
    const updates: Record<string, unknown> = {};
    if (titleAr !== undefined) updates.titleAr = titleAr;
    if (titleFr !== undefined) updates.titleFr = titleFr;
    if (subtitleAr !== undefined) updates.subtitleAr = subtitleAr;
    if (subtitleFr !== undefined) updates.subtitleFr = subtitleFr;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (link !== undefined) updates.link = link;
    if (bgColor !== undefined) updates.bgColor = bgColor;
    if (bgFrom !== undefined) updates.bgFrom = bgFrom;
    if (bgTo !== undefined) updates.bgTo = bgTo;
    if (accent !== undefined) updates.accent = accent;
    if (isActive !== undefined) updates.isActive = isActive;
    if (startsAt !== undefined) updates.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null;

    const [row] = await db.update(promoBannersTable).set(updates as any).where(eq(promoBannersTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/banners/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(promoBannersTable).where(eq(promoBannersTable.id, id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
