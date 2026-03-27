import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { delegationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin/delegations", async (req, res) => {
  try {
    res.json(await db.select().from(delegationsTable).orderBy(delegationsTable.name));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/delegations", async (req, res) => {
  const { name, nameAr, deliveryFee } = req.body;
  if (!name || !nameAr) { res.status(400).json({ message: "name and nameAr required" }); return; }
  try {
    const [row] = await db.insert(delegationsTable).values({ name, nameAr, deliveryFee: deliveryFee ?? 0 }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/delegations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { name, nameAr, deliveryFee } = req.body;
  try {
    const [row] = await db.update(delegationsTable).set({ name, nameAr, deliveryFee }).where(eq(delegationsTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/delegations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(delegationsTable).where(eq(delegationsTable.id, id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
