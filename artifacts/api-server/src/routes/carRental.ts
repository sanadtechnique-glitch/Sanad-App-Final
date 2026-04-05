import { Router } from "express";
import { db } from "@workspace/db";
import { carsTable, carRentalBookingsTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";

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

// ── Admin: create car ─────────────────────────────────────────────────────────
router.post("/admin/car-rental/cars", requireAuth, async (req, res) => {
  try {
    const { agencyId, make, model, year, color, pricePerDay, seats, transmission, fuelType, imageUrl, description, descriptionAr } = req.body;
    if (!agencyId || !make || !model || !pricePerDay) return res.status(400).json({ error: "missing_fields" });
    const [car] = await db.insert(carsTable).values({
      agencyId: Number(agencyId), make, model,
      year: year ? Number(year) : null,
      color: color || "",
      pricePerDay: Number(pricePerDay),
      seats: seats ? Number(seats) : 5,
      transmission: transmission || "manual",
      fuelType: fuelType || "essence",
      imageUrl: imageUrl || null,
      description: description || "",
      descriptionAr: descriptionAr || "",
      isAvailable: true,
    }).returning();
    res.status(201).json(car);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Admin: update car ─────────────────────────────────────────────────────────
router.patch("/admin/car-rental/cars/:id", requireAuth, async (req, res) => {
  try {
    const [car] = await db.update(carsTable).set(req.body).where(eq(carsTable.id, Number(req.params.id))).returning();
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
