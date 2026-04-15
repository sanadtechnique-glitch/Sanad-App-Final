import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deliveryStaffTable, ordersTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireStaff } from "../lib/authMiddleware";
import { isValidPhone } from "../lib/validate";
import { hashPassword } from "../lib/crypto";

const router: IRouter = Router();

router.get("/admin/delivery-staff", requireStaff, async (req, res) => {
  try {
    res.json(await db.select().from(deliveryStaffTable).orderBy(deliveryStaffTable.name));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/delivery-staff", requireAdmin, async (req, res) => {
  const { name, nameAr, phone, zone, isAvailable, driverPhone, driverPassword } = req.body;
  if (!name || !nameAr || !phone) {
    res.status(400).json({ message: "name, nameAr, phone required" }); return;
  }
  if (!isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }

  // Optional: create linked login account for the driver
  const createAccount = !!(driverPhone && driverPassword);
  if (createAccount) {
    if (!isValidPhone(driverPhone)) {
      res.status(400).json({ message: "رقم هاتف الحساب غير صالح · Numéro de compte invalide" }); return;
    }
    if ((driverPassword as string).length < 6) {
      res.status(400).json({ message: "كلمة المرور 6 أحرف على الأقل · Mot de passe min. 6 caractères" }); return;
    }
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, driverPhone.trim()));
    if (existing) {
      res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Ce numéro est déjà utilisé" }); return;
    }
  }

  try {
    // 1. Create delivery staff record
    const [staff] = await db.insert(deliveryStaffTable)
      .values({ name, nameAr, phone, zone, isAvailable: isAvailable ?? true })
      .returning();

    // 2. Optionally create driver user account linked to this staff record
    let driverUser = null;
    if (createAccount) {
      const hashedPw = await hashPassword(driverPassword.trim());
      const username = `driver_${driverPhone.trim().replace(/\D/g, "")}`;
      const [user] = await db.insert(usersTable).values({
        username,
        name: nameAr,
        phone: driverPhone.trim(),
        password: hashedPw,
        role: "driver",
        isActive: true,
        linkedStaffId: staff.id,
      }).returning({
        id: usersTable.id,
        username: usersTable.username,
        phone: usersTable.phone,
        role: usersTable.role,
        linkedStaffId: usersTable.linkedStaffId,
      });
      driverUser = user;
    }

    res.status(201).json({ staff, driverUser });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Ce numéro est déjà utilisé" }); return;
    }
    req.log.error({ err }); res.status(500).json({ message: "Server error" });
  }
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

// [C-4 FIXED] Driver's own history — requires staff auth + ownership check
router.get("/delivery/:staffId/orders", requireStaff, async (req, res) => {
  const staffId = parseInt(req.params.staffId);
  if (isNaN(staffId)) { res.status(400).json({ message: "Invalid staffId" }); return; }

  const session = (req as any).authSession as { userId: number; role: string };
  const isAdmin = ["super_admin", "admin", "manager"].includes(session.role);

  if (!isAdmin) {
    // Driver can only access their own order history
    const [user] = await db.select({ linkedStaffId: usersTable.linkedStaffId })
      .from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user?.linkedStaffId || user.linkedStaffId !== staffId) {
      res.status(403).json({ message: "غير مصرح · Non autorisé" }); return;
    }
  }

  try {
    const { desc } = await import("drizzle-orm");
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.deliveryStaffId, staffId))
      .orderBy(desc(ordersTable.createdAt))
      .limit(200);
    res.json(orders);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
