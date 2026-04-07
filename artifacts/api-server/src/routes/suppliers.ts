import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable, usersTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAdmin, requireStaff } from "../lib/authMiddleware";
import { isValidPhone } from "../lib/validate";
import { withCache, cacheDeletePrefix } from "../lib/cache";
import { hashPassword } from "../lib/crypto";

const SUPPLIERS_CACHE_TTL = 60;

const router: IRouter = Router();

// ── Public endpoints — safe fields only (no phone exposed to customers) ──────

router.get("/suppliers", async (req, res) => {
  try {
    const rows = await withCache("suppliers:all", SUPPLIERS_CACHE_TTL, () => db.select({
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
      latitude:      serviceProvidersTable.latitude,
      longitude:     serviceProvidersTable.longitude,
    }).from(serviceProvidersTable)
      .where(ne(serviceProvidersTable.category, "taxi"))
      .orderBy(serviceProvidersTable.name));
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
      latitude:      serviceProvidersTable.latitude,
      longitude:     serviceProvidersTable.longitude,
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
  const {
    name, nameAr, category, description, descriptionAr, address, phone, photoUrl,
    shift, rating, isAvailable, latitude, longitude,
    carModel, carColor, carPlate,
    // optional account creation
    providerPhone, providerPassword,
  } = req.body;

  if (!name || !nameAr || !category) {
    res.status(400).json({ message: "name, nameAr, category required" }); return;
  }
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }

  // If account creation requested, validate fields
  const createAccount = !!(providerPhone && providerPassword);
  if (createAccount) {
    if (!isValidPhone(providerPhone)) {
      res.status(400).json({ message: "رقم هاتف الحساب غير صالح · Numéro de compte invalide" }); return;
    }
    if (providerPassword.length < 6) {
      res.status(400).json({ message: "كلمة المرور 6 أحرف على الأقل · Mot de passe min. 6 caractères" }); return;
    }
    // Check phone not already used
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.phone, providerPhone.trim()));
    if (existing) {
      res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Ce numéro est déjà utilisé" }); return;
    }
  }

  try {
    // 1. Create supplier
    const [supplier] = await db.insert(serviceProvidersTable).values({
      name, nameAr, category,
      description: description || "",
      descriptionAr: descriptionAr || "",
      address: address || "",
      phone: phone || null,
      photoUrl: photoUrl || null,
      shift: shift || "all",
      rating: rating ?? 4.5,
      isAvailable: isAvailable ?? true,
      latitude: latitude ? parseFloat(String(latitude)) : null,
      longitude: longitude ? parseFloat(String(longitude)) : null,
      carModel: carModel || null,
      carColor: carColor || null,
      carPlate: carPlate || null,
    }).returning();

    // 2. Create provider account if requested
    let providerUser = null;
    if (createAccount) {
      const hashedPw = await hashPassword(providerPassword.trim());
      const username = `provider_${providerPhone.trim().replace(/\D/g, "")}`;
      const [user] = await db.insert(usersTable).values({
        username,
        name: nameAr,
        phone: providerPhone.trim(),
        password: hashedPw,
        role: "provider",
        isActive: true,
        linkedSupplierId: supplier.id,
      }).returning({ id: usersTable.id, username: usersTable.username, phone: usersTable.phone, role: usersTable.role, linkedSupplierId: usersTable.linkedSupplierId });
      providerUser = user;
    }

    cacheDeletePrefix("suppliers:");
    res.status(201).json({ supplier, providerUser });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Ce numéro est déjà utilisé" }); return;
    }
    req.log.error({ err });
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/admin/suppliers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { name, nameAr, category, description, descriptionAr, address, phone, photoUrl, shift, rating, isAvailable, latitude, longitude, carModel, carColor, carPlate } = req.body;
  if (phone !== undefined && phone !== "" && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" }); return;
  }
  try {
    const [row] = await db.update(serviceProvidersTable)
      .set({
        name, nameAr, category, description, descriptionAr, address, phone, photoUrl, shift, rating, isAvailable,
        latitude: latitude !== undefined ? (latitude ? parseFloat(String(latitude)) : null) : undefined,
        longitude: longitude !== undefined ? (longitude ? parseFloat(String(longitude)) : null) : undefined,
        carModel: carModel !== undefined ? (carModel || null) : undefined,
        carColor: carColor !== undefined ? (carColor || null) : undefined,
        carPlate: carPlate !== undefined ? (carPlate || null) : undefined,
      })
      .where(eq(serviceProvidersTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    cacheDeletePrefix("suppliers:");
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.delete("/admin/suppliers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    cacheDeletePrefix("suppliers:");
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

// Provider updates their OWN supplier photoUrl (vehicle photo for SOS, logo etc.)
router.patch("/provider/:id/photo", requireStaff, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { photoUrl } = req.body as { photoUrl?: string };
  try {
    const [row] = await db.update(serviceProvidersTable)
      .set({ photoUrl: photoUrl || null })
      .where(eq(serviceProvidersTable.id, id)).returning();
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    cacheDeletePrefix("suppliers:");
    res.json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
