import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { promoBannersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Public endpoint — used by the home page to fetch active banners
router.get("/banners", async (req, res) => {
  try {
    const now = new Date();
    const banners = await db.select().from(promoBannersTable)
      .where(eq(promoBannersTable.isActive, true))
      .orderBy(promoBannersTable.createdAt);
    // Filter by date range if set
    const active = banners.filter(b => {
      if (b.startsAt && new Date(b.startsAt) > now) return false;
      if (b.endsAt && new Date(b.endsAt) < now) return false;
      return true;
    });
    res.json(active);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.get("/admin/banners", async (req, res) => {
  try {
    res.json(await db.select().from(promoBannersTable).orderBy(promoBannersTable.createdAt));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/banners", async (req, res) => {
  const { titleAr, titleFr, imageUrl, link, bgColor, isActive, startsAt, endsAt } = req.body;
  if (!titleAr || !titleFr) { res.status(400).json({ message: "titleAr and titleFr required" }); return; }
  try {
    const [row] = await db.insert(promoBannersTable).values({
      titleAr, titleFr, imageUrl, link, bgColor: bgColor || "#D4AF37",
      isActive: isActive ?? true,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/banners/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { titleAr, titleFr, imageUrl, link, bgColor, isActive, startsAt, endsAt } = req.body;
  try {
    const [row] = await db.update(promoBannersTable).set({
      titleAr, titleFr, imageUrl, link, bgColor, isActive,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    }).where(eq(promoBannersTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/banners/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(promoBannersTable).where(eq(promoBannersTable.id, id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
