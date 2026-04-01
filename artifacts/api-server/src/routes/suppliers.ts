import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireStaff } from "../lib/authMiddleware";
import { isValidPhone } from "../lib/validate";

const router: IRouter = Router();

// ── Public endpoints — safe fields only (no phone exposed to customers) ──────

router.get("/suppliers", async (req, res) => {
  try {
    const rows = await db.select({
      id:            serviceProvidersTable.id,
      name:          serviceProvidersTable.name,
      nameAr:        serviceProvidersTable.nameAr,
      category:      serviceProvidersTable.category,
      description:   serviceProvidersTable.description,
      descriptionAr: serviceProvidersTable.descriptionAr,
      address:       serviceProvidersTable.address,
      photoUrl:      serviceProvidersTable.photoUrl,
      rating:        serviceProvidersTable.rating,
      isAvailable:   serviceProvidersTable.isAvailable,
      shift:         serviceProvidersTable.shift,
    }).from(serviceProvidersTable).orderBy(serviceProvidersTable.name);
    res.json(rows);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.get("/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const [row] = await db.select({
      id:            serviceProvidersTable.id,
      name:          serviceProvidersTable.name,
      nameAr:        serviceProvidersTable.nameAr,
      category:      serviceProvidersTable.category,
      description:   serviceProvidersTable.description,
      descriptionAr: serviceProvidersTable.descriptionAr,
      address:       serviceProvidersTable.address,
      photoUrl:      serviceProvidersTable.photoUrl,
      rating:        serviceProvidersTable.rating,
      isAvailable:   serviceProvidersTable.isAvailable,
      shift:         serviceProvidersTable.shift,
    }).from(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// ── Admin-only endpoints ──────────────────────────────────────────────────────

router.get("/admin/suppliers", requireAdmin, async (req, res) => {
  try {
    res.json(await db.select().from(serviceProvidersTable).orderBy(serviceProvidersTable.name));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.get("/admin/suppliers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const [row] = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.post("/admin/suppliers", requireAdmin, async (req, res) => {
  const { name, nameAr, category, description, descriptionAr, address, phone, photoUrl, shift, rating, isAvailable } = req.body;
  if (!name || !nameAr || !category) {
    res.status(400).json({ message: "name, nameAr, category required" }); return;
  }
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }
  try {
    const [row] = await db.insert(serviceProvidersTable).values({
      name, nameAr, category,
      description: description || "",
      descriptionAr: descriptionAr || "",
      address: address || "",
      phone: phone || null,
      photoUrl: photoUrl || null,
      shift: shift || "all",
      rating: rating ?? 4.5,
      isAvailable: isAvailable ?? true,
    }).returning();
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/suppliers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { name, nameAr, category, description, descriptionAr, address, phone, photoUrl, shift, rating, isAvailable } = req.body;
  if (phone !== undefined && phone !== "" && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }
  try {
    const [row] = await db.update(serviceProvidersTable)
      .set({ name, nameAr, category, description, descriptionAr, address, phone, photoUrl, shift, rating, isAvailable })
      .where(eq(serviceProvidersTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/suppliers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.patch("/admin/suppliers/:id/toggle", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const [current] = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    if (!current) { res.status(404).json({ message: "Not found" }); return; }
    const [row] = await db.update(serviceProvidersTable)
      .set({ isAvailable: !current.isAvailable })
      .where(eq(serviceProvidersTable.id, id)).returning();
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Provider-accessible toggle — allows providers to toggle their OWN store availability
router.patch("/provider/:id/toggle", requireStaff, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const [current] = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    if (!current) { res.status(404).json({ message: "Not found" }); return; }
    const [row] = await db.update(serviceProvidersTable)
      .set({ isAvailable: !current.isAvailable })
      .where(eq(serviceProvidersTable.id, id)).returning();
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
