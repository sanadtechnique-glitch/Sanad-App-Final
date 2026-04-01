import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deliveryStaffTable, ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireStaff } from "../lib/authMiddleware";
import { isValidPhone } from "../lib/validate";

const router: IRouter = Router();

router.get("/admin/delivery-staff", requireStaff, async (req, res) => {
  try {
    res.json(await db.select().from(deliveryStaffTable).orderBy(deliveryStaffTable.name));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/delivery-staff", requireAdmin, async (req, res) => {
  const { name, nameAr, phone, zone, isAvailable } = req.body;
  if (!name || !nameAr || !phone) {
    res.status(400).json({ message: "name, nameAr, phone required" }); return;
  }
  if (!isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }
  try {
    const [row] = await db.insert(deliveryStaffTable)
      .values({ name, nameAr, phone, zone, isAvailable: isAvailable ?? true })
      .returning();
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/delivery-staff/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { name, nameAr, phone, zone, isAvailable } = req.body;
  if (phone !== undefined && phone !== "" && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }
  try {
    const [row] = await db.update(deliveryStaffTable)
      .set({ name, nameAr, phone, zone, isAvailable })
      .where(eq(deliveryStaffTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/delivery-staff/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(deliveryStaffTable).where(eq(deliveryStaffTable.id, id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Driver's own orders — requires auth (driver uses their own token from login)
router.get("/delivery/:staffId/orders", async (req, res) => {
  const staffId = parseInt(req.params.staffId);
  if (isNaN(staffId)) { res.status(400).json({ message: "Invalid staffId" }); return; }
  try {
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.deliveryStaffId, staffId));
    res.json(orders);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
