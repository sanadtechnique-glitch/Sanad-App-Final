import { Router } from "express";
import { db } from "@workspace/db";
import { carsTable, carRentalBookingsTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";

async function checkDuplicatePlate(plateNumber: string, excludeId?: number): Promise<boolean> {
  const rows = await db.select({ id: carsTable.id })
    .from(carsTable)
    .where(eq(carsTable.plateNumber, plateNumber.trim().toUpperCase()));
  if (excludeId) return rows.some(r => r.id !== excludeId);
  return rows.length > 0;
}

function buildImagesPayload(images: string[] | undefined, imageUrl: string | undefined) {
  const imgs = Array.isArray(images) ? images.filter(Boolean) : [];
  const primary = imgs[0] || imageUrl || null;
  return { imageUrl: primary, images: imgs.length > 0 ? JSON.stringify(imgs) : null };
}

const router = Router();

// ── Public: list all car rental agencies ─────────────────────────────────────
router.get("/car-rental/agencies", async (_req, res) => {
  try {
    const agencies = await db.select().from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.category, "car" as any));
    res.json(agencies);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Public: list all available cars (optionally by agency) ───────────────────
router.get("/car-rental/cars", async (req, res) => {
  try {
    const agencyId = req.query.agencyId ? Number(req.query.agencyId) : null;
    const rows = agencyId
      ? await db.select().from(carsTable).where(and(eq(carsTable.agencyId, agencyId), eq(carsTable.isAvailable, true)))
      : await db.select().from(carsTable).where(eq(carsTable.isAvailable, true));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Public: list all cars including unavailable (admin/agency) ───────────────
router.get("/car-rental/cars/all", requireAuth, async (req, res) => {
  try {
    const agencyId = req.query.agencyId ? Number(req.query.agencyId) : null;
    const rows = agencyId
      ? await db.select().from(carsTable).where(eq(carsTable.agencyId, agencyId))
      : await db.select().from(carsTable);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Public: get one car ───────────────────────────────────────────────────────
router.get("/car-rental/cars/:id", async (req, res) => {
  try {
    const [car] = await db.select().from(carsTable).where(eq(carsTable.id, Number(req.params.id)));
    if (!car) return res.status(404).json({ error: "not_found" });
    res.json(car);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Helper: build car payload from request body ───────────────────────────────
function buildCarPayload(body: any, isInsert = true) {
  const { agencyId, make, model, year, color, plateNumber, pricePerDay, seats,
    transmission, fuelType, images, imageUrl, description, descriptionAr } = body;
  const imgPayload = buildImagesPayload(images, imageUrl);
  const payload: any = {
    ...(isInsert && agencyId && { agencyId: Number(agencyId) }),
    ...(make    && { make }),
    ...(model   && { model }),
    year:         year ? Number(year) : null,
    color:        color || "",
    plateNumber:  plateNumber ? plateNumber.trim().toUpperCase() : undefined,
    pricePerDay:  pricePerDay ? Number(pricePerDay) : undefined,
    seats:        seats ? Number(seats) : 5,
    transmission: transmission || "manual",
    fuelType:     fuelType || "essence",
    imageUrl:     imgPayload.imageUrl,
    images:       imgPayload.images,
    description:  description || "",
    descriptionAr: descriptionAr || "",
    ...(isInsert && { isAvailable: true }),
  };
  return payload;
}

// ── Admin: create car ─────────────────────────────────────────────────────────
router.post("/admin/car-rental/cars", requireAuth, async (req, res) => {
  try {
    const { agencyId, make, model, pricePerDay, plateNumber } = req.body;
    if (!agencyId || !make || !model || !pricePerDay)
      return res.status(400).json({ error: "missing_fields", message: "الماركة والموديل والسعر ورقم الترقيم المنجمي مطلوبة" });
    if (!plateNumber || !plateNumber.trim())
      return res.status(400).json({ error: "plate_required", message: "رقم الترقيم المنجمي إجباري · Le numéro d'immatriculation est obligatoire" });
    if (await checkDuplicatePlate(plateNumber))
      return res.status(409).json({ error: "plate_duplicate", message: "هذا الترقيم المنجمي مسجل مسبقاً · Cette immatriculation existe déjà" });
    const [car] = await db.insert(carsTable).values(buildCarPayload(req.body, true)).returning();
    res.status(201).json(car);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Provider: create car for own agency ───────────────────────────────────────
router.post("/provider/car-rental/cars", requireAuth, async (req, res) => {
  try {
    const { agencyId, make, model, pricePerDay, plateNumber } = req.body;
    if (!agencyId || !make || !model || !pricePerDay)
      return res.status(400).json({ error: "missing_fields", message: "الماركة والموديل والسعر ورقم الترقيم المنجمي مطلوبة" });
    if (!plateNumber || !plateNumber.trim())
      return res.status(400).json({ error: "plate_required", message: "رقم الترقيم المنجمي إجباري · Le numéro d'immatriculation est obligatoire" });
    if (await checkDuplicatePlate(plateNumber))
      return res.status(409).json({ error: "plate_duplicate", message: "هذا الترقيم المنجمي مسجل مسبقاً · Cette immatriculation existe déjà" });
    const [car] = await db.insert(carsTable).values(buildCarPayload(req.body, true)).returning();
    res.status(201).json(car);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Provider: update own car ──────────────────────────────────────────────────
router.patch("/provider/car-rental/cars/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { plateNumber } = req.body;
    if (plateNumber !== undefined) {
      if (!plateNumber.trim())
        return res.status(400).json({ error: "plate_required", message: "رقم الترقيم المنجمي إجباري" });
      if (await checkDuplicatePlate(plateNumber, id))
        return res.status(409).json({ error: "plate_duplicate", message: "هذا الترقيم المنجمي مسجل مسبقاً" });
    }
    const payload = buildCarPayload(req.body, false);
    const [car] = await db.update(carsTable).set(payload).where(eq(carsTable.id, id)).returning();
    res.json(car);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Provider: delete own car ──────────────────────────────────────────────────
router.delete("/provider/car-rental/cars/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(carsTable).where(eq(carsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Admin: update car ─────────────────────────────────────────────────────────
router.patch("/admin/car-rental/cars/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { plateNumber } = req.body;
    if (plateNumber !== undefined) {
      if (!plateNumber.trim())
        return res.status(400).json({ error: "plate_required", message: "رقم الترقيم المنجمي إجباري" });
      if (await checkDuplicatePlate(plateNumber, id))
        return res.status(409).json({ error: "plate_duplicate", message: "هذا الترقيم المنجمي مسجل مسبقاً" });
    }
    const payload = buildCarPayload(req.body, false);
    const [car] = await db.update(carsTable).set(payload).where(eq(carsTable.id, id)).returning();
    res.json(car);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Admin: delete car ─────────────────────────────────────────────────────────
router.delete("/admin/car-rental/cars/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(carsTable).where(eq(carsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Customer: create booking ──────────────────────────────────────────────────
router.post("/car-rental/bookings", async (req, res) => {
  try {
    const { customerId, customerName, customerPhone, carId, agencyId, startDate, endDate, durationDays, totalPrice, notes } = req.body;
    if (!customerName || !customerPhone || !carId || !agencyId || !startDate || !endDate || !durationDays || !totalPrice)
      return res.status(400).json({ error: "missing_fields" });
    const [booking] = await db.insert(carRentalBookingsTable).values({
      customerId: customerId ? Number(customerId) : null,
      customerName, customerPhone,
      carId: Number(carId), agencyId: Number(agencyId),
      startDate, endDate,
      durationDays: Number(durationDays),
      totalPrice: Number(totalPrice),
      notes: notes || null,
    }).returning();
    res.status(201).json(booking);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Agency/Admin: list bookings by agency ─────────────────────────────────────
router.get("/car-rental/bookings", requireAuth, async (req, res) => {
  try {
    const agencyId = req.query.agencyId ? Number(req.query.agencyId) : null;
    const rows = agencyId
      ? await db.select().from(carRentalBookingsTable).where(eq(carRentalBookingsTable.agencyId, agencyId))
      : await db.select().from(carRentalBookingsTable);
    res.json(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Customer: my bookings ─────────────────────────────────────────────────────
router.get("/car-rental/bookings/my/:customerId", async (req, res) => {
  try {
    const rows = await db.select().from(carRentalBookingsTable)
      .where(eq(carRentalBookingsTable.customerId, Number(req.params.customerId)));
    res.json(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Agency: update booking status (confirm/reject) ────────────────────────────
router.patch("/car-rental/bookings/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const [booking] = await db.update(carRentalBookingsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(carRentalBookingsTable.id, Number(req.params.id)))
      .returning();
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
