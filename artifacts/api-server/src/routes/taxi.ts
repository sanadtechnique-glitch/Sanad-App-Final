import { Router } from "express";
import { db } from "@workspace/db";
import { taxiDriversTable, taxiRequestsTable, usersTable } from "@workspace/db/schema";
import { eq, and, not, inArray, gte, lte, desc } from "drizzle-orm";
import { emitTaxiRequest, emitTaxiResponse, emitTaxiDriverUpdate } from "../lib/socket";
import { requireAuth } from "../lib/authMiddleware";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Parse rejected driver IDs list stored as comma-separated string */
function parseRejected(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
}

/** Find the next available taxi driver excluding already-rejected ones */
async function findNextDriver(rejectedIds: number[]): Promise<typeof taxiDriversTable.$inferSelect | null> {
  const [driver] = await db
    .select()
    .from(taxiDriversTable)
    .where(
      and(
        eq(taxiDriversTable.isAvailable, true),
        eq(taxiDriversTable.isActive, true),
        rejectedIds.length > 0
          ? not(inArray(taxiDriversTable.id, rejectedIds))
          : undefined
      )
    )
    .limit(1);
  return driver ?? null;
}

/**
 * Find a driver who is currently on an active (in_progress) ride.
 * Used as fallback when no available driver exists — notify them of a new request
 * so they can handle it after finishing the current ride.
 */
async function findBusyDriver(rejectedIds: number[]): Promise<typeof taxiDriversTable.$inferSelect | null> {
  // Find drivers who have an in_progress ride assigned to them
  const [activeReq] = await db
    .select({ assignedDriverId: taxiRequestsTable.assignedDriverId })
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.status, "in_progress"))
    .limit(1);

  if (!activeReq?.assignedDriverId) return null;
  if (rejectedIds.includes(activeReq.assignedDriverId)) return null;

  const [driver] = await db
    .select()
    .from(taxiDriversTable)
    .where(
      and(
        eq(taxiDriversTable.id, activeReq.assignedDriverId),
        eq(taxiDriversTable.isActive, true)
      )
    )
    .limit(1);

  return driver ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — GET /api/taxi/request/:id/status  (customer polls)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/request/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.id, id));

  if (!request) { res.status(404).json({ message: "Request not found" }); return; }

  let driverInfo: { name: string; phone: string; carModel: string | null; carColor: string | null; carPlate: string | null } | null = null;
  if (request.assignedDriverId) {
    const [d] = await db
      .select()
      .from(taxiDriversTable)
      .where(eq(taxiDriversTable.id, request.assignedDriverId));
    if (d) {
      driverInfo = { name: d.name, phone: d.phone, carModel: d.carModel, carColor: d.carColor, carPlate: d.carPlate };
    }
  }

  res.json({ ...request, driverInfo });
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/taxi/request  (create a new taxi request)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/request", async (req, res) => {
  const {
    customerId, customerName, customerPhone,
    pickupAddress, pickupLat, pickupLng,
    dropoffAddress, notes,
    commissionType, fixedAmount,
  } = req.body as {
    customerId?: number;
    customerName: string;
    customerPhone?: string;
    pickupAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoffAddress?: string;
    notes?: string;
    commissionType: "meter" | "fixed";
    fixedAmount?: number;
  };

  if (!customerName?.trim() || !pickupAddress?.trim()) {
    res.status(400).json({ message: "الاسم وعنوان الانطلاق مطلوبان · Nom et adresse requis" });
    return;
  }
  if (commissionType === "fixed" && (!fixedAmount || fixedAmount <= 0)) {
    res.status(400).json({ message: "يرجى تحديد المبلغ الثابت · Montant fixe requis" });
    return;
  }

  // Block customer from making a new request if they already have an active one
  if (customerId) {
    const [existingActive] = await db
      .select({ id: taxiRequestsTable.id, status: taxiRequestsTable.status })
      .from(taxiRequestsTable)
      .where(
        and(
          eq(taxiRequestsTable.customerId, customerId),
          inArray(taxiRequestsTable.status, ["searching", "pending", "accepted", "in_progress"])
        )
      )
      .limit(1);

    if (existingActive) {
      res.status(409).json({
        message: "لديك رحلة نشطة بالفعل · Vous avez déjà une course en cours",
        existingRequestId: existingActive.id,
        existingStatus: existingActive.status,
      });
      return;
    }
  }

  // 1) Try to find an available driver first
  const firstDriver = await findNextDriver([]);
  // 2) If no available driver, try a busy one (currently on an in_progress ride)
  const busyDriver  = firstDriver ? null : await findBusyDriver([]);

  const chosenDriver  = firstDriver ?? busyDriver;
  const isBusyDriver  = !firstDriver && !!busyDriver;

  const [request] = await db
    .insert(taxiRequestsTable)
    .values({
      customerId:        customerId ?? null,
      customerName:      customerName.trim(),
      customerPhone:     customerPhone?.trim() ?? null,
      pickupAddress:     pickupAddress.trim(),
      pickupLat:         pickupLat ?? null,
      pickupLng:         pickupLng ?? null,
      dropoffAddress:    dropoffAddress?.trim() ?? null,
      notes:             notes?.trim() ?? null,
      commissionType,
      fixedAmount:       fixedAmount ?? null,
      // Busy driver gets "pending" too — they'll see a queued banner and handle it after current ride
      status:            chosenDriver ? "pending" : "searching",
      assignedDriverId:  chosenDriver?.id ?? null,
      rejectedDriverIds: "",
    })
    .returning();

  // Notify the chosen driver via socket
  if (chosenDriver) {
    const [driverUser] = await db
      .select({ userId: taxiDriversTable.userId })
      .from(taxiDriversTable)
      .where(eq(taxiDriversTable.id, chosenDriver.id));

    if (driverUser) {
      emitTaxiRequest(driverUser.userId, {
        requestId:      request.id,
        customerName:   request.customerName,
        customerPhone:  request.customerPhone,
        pickupAddress:  request.pickupAddress,
        dropoffAddress: request.dropoffAddress,
        notes:          request.notes,
        commissionType: request.commissionType,
        fixedAmount:    request.fixedAmount,
        isQueued:       isBusyDriver,   // <-- tells driver it's for after current ride
      });
    }
  }

  res.status(201).json(request);
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — POST /api/taxi/request/:id/accept
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/request/:id/accept", requireAuth, async (req, res) => {
  const id   = parseInt(req.params.id);
  const { etaMinutes } = req.body as { etaMinutes: number };
  const driverUserId = (req as any).authSession?.userId;

  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
  if (!etaMinutes || etaMinutes < 1) {
    res.status(400).json({ message: "وقت الوصول مطلوب · ETA requis" });
    return;
  }

  // Get the taxi driver record linked to this user
  const [taxiDriver] = await db
    .select()
    .from(taxiDriversTable)
    .where(eq(taxiDriversTable.userId, driverUserId));

  if (!taxiDriver) {
    res.status(403).json({ message: "غير مرخص · Non autorisé" });
    return;
  }

  const [request] = await db
    .select()
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.id, id));

  if (!request || request.status !== "pending" || request.assignedDriverId !== taxiDriver.id) {
    res.status(400).json({ message: "الطلب غير متاح · Demande non disponible" });
    return;
  }

  const [updated] = await db
    .update(taxiRequestsTable)
    .set({ status: "accepted", etaMinutes, updatedAt: new Date() })
    .where(eq(taxiRequestsTable.id, id))
    .returning();

  // NOTE: driver stays available until customer confirms

  // Notify customer — waiting for their confirmation
  if (request.customerId) {
    emitTaxiResponse(request.customerId, {
      requestId:   id,
      status:      "accepted",
      etaMinutes,
      driverName:  taxiDriver.name,
      driverPhone: taxiDriver.phone,
      carModel:    taxiDriver.carModel,
      carColor:    taxiDriver.carColor,
      carPlate:    taxiDriver.carPlate,
    });
  }

  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/taxi/request/:id/confirm  (customer confirms driver ETA)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/request/:id/confirm", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.id, id));

  if (!request || request.status !== "accepted") {
    res.status(400).json({ message: "الطلب غير قابل للتأكيد · Demande non confirmable" });
    return;
  }

  await db
    .update(taxiRequestsTable)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(taxiRequestsTable.id, id));

  // Mark driver as unavailable now that the ride is confirmed
  if (request.assignedDriverId) {
    await db
      .update(taxiDriversTable)
      .set({ isAvailable: false })
      .where(eq(taxiDriversTable.id, request.assignedDriverId));

    // Notify driver: customer confirmed → go pick them up
    const [driverUser] = await db
      .select({ userId: taxiDriversTable.userId })
      .from(taxiDriversTable)
      .where(eq(taxiDriversTable.id, request.assignedDriverId));

    if (driverUser) {
      emitTaxiDriverUpdate(driverUser.userId, {
        status:        "confirmed",
        requestId:     id,
        customerName:  request.customerName,
        pickupAddress: request.pickupAddress,
      });
    }
  }

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/taxi/request/:id/decline  (customer rejects driver ETA)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/request/:id/decline", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.id, id));

  if (!request || request.status !== "accepted") {
    res.status(400).json({ message: "الطلب غير قابل للرفض · Demande non refusable" });
    return;
  }

  await db
    .update(taxiRequestsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(taxiRequestsTable.id, id));

  // Notify driver: customer declined → they stay available
  if (request.assignedDriverId) {
    const [driverUser] = await db
      .select({ userId: taxiDriversTable.userId })
      .from(taxiDriversTable)
      .where(eq(taxiDriversTable.id, request.assignedDriverId));

    if (driverUser) {
      emitTaxiDriverUpdate(driverUser.userId, {
        status:    "declined",
        requestId: id,
      });
    }
  }

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — POST /api/taxi/request/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/request/:id/reject", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const driverUserId = (req as any).authSession?.userId;

  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

  const [taxiDriver] = await db
    .select()
    .from(taxiDriversTable)
    .where(eq(taxiDriversTable.userId, driverUserId));

  if (!taxiDriver) {
    res.status(403).json({ message: "غير مرخص · Non autorisé" });
    return;
  }

  const [request] = await db
    .select()
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.id, id));

  if (!request || request.status !== "pending" || request.assignedDriverId !== taxiDriver.id) {
    res.status(400).json({ message: "الطلب غير متاح · Demande non disponible" });
    return;
  }

  // Add this driver to rejected list
  const rejectedIds = parseRejected(request.rejectedDriverIds);
  rejectedIds.push(taxiDriver.id);
  const rejectedStr = rejectedIds.join(",");

  // Find next driver
  const nextDriver = await findNextDriver(rejectedIds);

  if (nextDriver) {
    // Assign to next driver
    await db
      .update(taxiRequestsTable)
      .set({
        status: "pending",
        assignedDriverId: nextDriver.id,
        rejectedDriverIds: rejectedStr,
        updatedAt: new Date(),
      })
      .where(eq(taxiRequestsTable.id, id));

    // Notify next driver
    const [nextDriverUser] = await db
      .select({ userId: taxiDriversTable.userId })
      .from(taxiDriversTable)
      .where(eq(taxiDriversTable.id, nextDriver.id));

    if (nextDriverUser) {
      emitTaxiRequest(nextDriverUser.userId, {
        requestId:     request.id,
        customerName:  request.customerName,
        customerPhone: request.customerPhone,
        pickupAddress: request.pickupAddress,
        dropoffAddress: request.dropoffAddress,
        notes:         request.notes,
        commissionType: request.commissionType,
        fixedAmount:   request.fixedAmount,
      });
    }

    res.json({ status: "searching", message: "تم إرسال الطلب لسائق آخر" });
  } else {
    // No driver available — inform customer
    await db
      .update(taxiRequestsTable)
      .set({
        status: "searching",
        assignedDriverId: null,
        rejectedDriverIds: rejectedStr,
        updatedAt: new Date(),
      })
      .where(eq(taxiRequestsTable.id, id));

    // Notify customer: no driver found
    if (request.customerId) {
      emitTaxiResponse(request.customerId, {
        requestId: id,
        status:    "no_driver",
        message:   "لا يوجد سائق متاح حالياً · Aucun chauffeur disponible",
      });
    }

    res.json({ status: "no_driver", message: "لا يوجد سائق متاح حالياً" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — GET /api/taxi/driver/current  (driver full state: pending / awaiting / active)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/driver/current", requireAuth, async (req, res) => {
  const driverUserId = (req as any).authSession?.userId;

  const [taxiDriver] = await db
    .select()
    .from(taxiDriversTable)
    .where(eq(taxiDriversTable.userId, driverUserId));

  if (!taxiDriver) { res.status(403).json({ message: "غير مرخص" }); return; }

  const [pendingReq, awaitingReq, activeReq] = await Promise.all([
    // Driver received request, waiting for their accept/reject
    db.select().from(taxiRequestsTable)
      .where(and(eq(taxiRequestsTable.assignedDriverId, taxiDriver.id), eq(taxiRequestsTable.status, "pending")))
      .orderBy(taxiRequestsTable.createdAt).limit(1).then(r => r[0] ?? null),
    // Driver accepted + set ETA, waiting for customer confirmation
    db.select().from(taxiRequestsTable)
      .where(and(eq(taxiRequestsTable.assignedDriverId, taxiDriver.id), eq(taxiRequestsTable.status, "accepted")))
      .limit(1).then(r => r[0] ?? null),
    // Customer confirmed → driver en route
    db.select().from(taxiRequestsTable)
      .where(and(eq(taxiRequestsTable.assignedDriverId, taxiDriver.id), eq(taxiRequestsTable.status, "in_progress")))
      .limit(1).then(r => r[0] ?? null),
  ]);

  res.json({
    driver:          taxiDriver,
    pendingRequest:  pendingReq,
    awaitingRequest: awaitingReq,
    activeRequest:   activeReq,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — GET /api/taxi/driver/accepted  (kept for backward compat — returns in_progress)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/driver/accepted", requireAuth, async (req, res) => {
  const driverUserId = (req as any).authSession?.userId;

  const [taxiDriver] = await db
    .select()
    .from(taxiDriversTable)
    .where(eq(taxiDriversTable.userId, driverUserId));

  if (!taxiDriver) { res.status(403).json({ message: "غير مرخص" }); return; }

  const [request] = await db
    .select()
    .from(taxiRequestsTable)
    .where(
      and(
        eq(taxiRequestsTable.assignedDriverId, taxiDriver.id),
        eq(taxiRequestsTable.status, "in_progress")
      )
    )
    .limit(1);

  res.json({ driver: taxiDriver, activeRequest: request ?? null });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — POST /api/taxi/driver/complete/:id  (complete the ride)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/driver/complete/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const driverUserId = (req as any).authSession?.userId;

  const [taxiDriver] = await db
    .select()
    .from(taxiDriversTable)
    .where(eq(taxiDriversTable.userId, driverUserId));

  if (!taxiDriver) { res.status(403).json({ message: "غير مرخص" }); return; }

  await db
    .update(taxiRequestsTable)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(taxiRequestsTable.id, id),
        eq(taxiRequestsTable.assignedDriverId, taxiDriver.id)
      )
    );

  // Make driver available again
  await db
    .update(taxiDriversTable)
    .set({ isAvailable: true })
    .where(eq(taxiDriversTable.id, taxiDriver.id));

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — GET /api/taxi/driver/history  (completed rides + commission totals)
// Query params: from=YYYY-MM-DD  to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/driver/history", requireAuth, async (req, res) => {
  const driverUserId = (req as any).authSession?.userId;
  const { from, to } = req.query as { from?: string; to?: string };

  const [taxiDriver] = await db
    .select()
    .from(taxiDriversTable)
    .where(eq(taxiDriversTable.userId, driverUserId));

  if (!taxiDriver) { res.status(403).json({ message: "غير مرخص" }); return; }

  const conditions: any[] = [
    eq(taxiRequestsTable.assignedDriverId, taxiDriver.id),
    eq(taxiRequestsTable.status, "completed"),
  ];

  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    conditions.push(gte(taxiRequestsTable.createdAt, fromDate));
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(taxiRequestsTable.createdAt, toDate));
  }

  const rides = await db
    .select()
    .from(taxiRequestsTable)
    .where(and(...conditions))
    .orderBy(desc(taxiRequestsTable.createdAt));

  const totalFixed = rides
    .filter(r => r.commissionType === "fixed" && r.fixedAmount)
    .reduce((sum, r) => sum + (r.fixedAmount ?? 0), 0);

  res.json({
    rides,
    total:      rides.length,
    fixedCount: rides.filter(r => r.commissionType === "fixed").length,
    meterCount: rides.filter(r => r.commissionType === "meter").length,
    totalFixed,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — GET /api/admin/taxi/drivers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/taxi/drivers", requireAuth, async (req, res) => {
  const drivers = await db.select().from(taxiDriversTable).orderBy(taxiDriversTable.id);
  res.json(drivers);
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /api/admin/taxi/drivers  (register new taxi driver)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/taxi/drivers", requireAuth, async (req, res) => {
  const { name, phone, password, carModel, carColor, carPlate } = req.body as {
    name: string; phone: string; password: string;
    carModel?: string; carColor?: string; carPlate?: string;
  };

  if (!name?.trim() || !phone?.trim() || !password?.trim()) {
    res.status(400).json({ message: "الاسم والهاتف وكلمة المرور مطلوبة" });
    return;
  }

  // Create user with taxi_driver role
  const baseUsername = `taxi_${phone.trim().replace(/\D/g, "")}`;

  const [user] = await db
    .insert(usersTable)
    .values({
      username: baseUsername,
      name: name.trim(),
      phone: phone.trim(),
      password: password.trim(),
      role: "taxi_driver",
      isActive: true,
    })
    .returning();

  const [driver] = await db
    .insert(taxiDriversTable)
    .values({
      userId:   user.id,
      name:     name.trim(),
      phone:    phone.trim(),
      carModel: carModel?.trim() ?? null,
      carColor: carColor?.trim() ?? null,
      carPlate: carPlate?.trim() ?? null,
    })
    .returning();

  res.status(201).json({ user, driver });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PATCH /api/admin/taxi/drivers/:id  (toggle availability / edit)
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/admin/taxi/drivers/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { isAvailable, isActive, carModel, carColor, carPlate } = req.body;

  const updates: Partial<typeof taxiDriversTable.$inferInsert> = {};
  if (isAvailable !== undefined) updates.isAvailable = isAvailable;
  if (isActive    !== undefined) updates.isActive    = isActive;
  if (carModel    !== undefined) updates.carModel    = carModel;
  if (carColor    !== undefined) updates.carColor    = carColor;
  if (carPlate    !== undefined) updates.carPlate    = carPlate;

  const [updated] = await db
    .update(taxiDriversTable)
    .set(updates)
    .where(eq(taxiDriversTable.id, id))
    .returning();

  res.json(updated);
});

// ADMIN — GET /api/admin/taxi/requests
router.get("/admin/taxi/requests", requireAuth, async (req, res) => {
  const requests = await db
    .select()
    .from(taxiRequestsTable)
    .orderBy(taxiRequestsTable.createdAt);
  res.json(requests);
});

export default router;
