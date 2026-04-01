import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { delegationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";
import { safeParseFloat } from "../lib/validate";

const router: IRouter = Router();

// Public read — customers need the delegation list when placing an order
router.get("/delegations", async (req, res) => {
  try {
    res.json(await db.select().from(delegationsTable).orderBy(delegationsTable.name));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.get("/admin/delegations", requireAdmin, async (req, res) => {
  try {
    res.json(await db.select().from(delegationsTable).orderBy(delegationsTable.name));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/delegations", requireAdmin, async (req, res) => {
  const { name, nameAr, deliveryFee } = req.body;
  if (!name || !nameAr) { res.status(400).json({ message: "name and nameAr required" }); return; }
  const fee = safeParseFloat(deliveryFee) ?? 0;
  try {
    const [row] = await db.insert(delegationsTable).values({ name, nameAr, deliveryFee: fee }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/delegations/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { name, nameAr, deliveryFee } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (nameAr !== undefined) updates.nameAr = nameAr;
  if (deliveryFee !== undefined) {
    const fee = safeParseFloat(deliveryFee);
    if (fee === null) { res.status(400).json({ message: "Invalid deliveryFee value" }); return; }
    updates.deliveryFee = fee;
  }
  try {
    const [row] = await db.update(delegationsTable).set(updates).where(eq(delegationsTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/delegations/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(delegationsTable).where(eq(delegationsTable.id, id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
