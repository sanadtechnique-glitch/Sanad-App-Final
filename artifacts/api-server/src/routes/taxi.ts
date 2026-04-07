import { Router } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable, taxiRequestsTable, usersTable } from "@workspace/db/schema";
import { eq, and, not, inArray, gte, lte, desc } from "drizzle-orm";
import { emitTaxiRequest, emitTaxiResponse, emitTaxiDriverUpdate } from "../lib/socket";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// TYPE ALIAS — a taxi driver is a ServiceProvider with category="taxi"
// ─────────────────────────────────────────────────────────────────────────────
type TaxiProvider = typeof serviceProvidersTable.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseRejected(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
}

async function findNextDriver(rejectedIds: number[]): Promise<TaxiProvider | null> {
  const [driver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(
      and(
        eq(serviceProvidersTable.category, "taxi"),
        eq(serviceProvidersTable.isAvailable, true),
        eq(serviceProvidersTable.isActive, true),
        rejectedIds.length > 0
          ? not(inArray(serviceProvidersTable.id, rejectedIds))
          : undefined
      )
    )
    .limit(1);
  return driver ?? null;
}

async function findBusyDriver(rejectedIds: number[]): Promise<TaxiProvider | null> {
  const [activeReq] = await db
    .select({ assignedDriverId: taxiRequestsTable.assignedDriverId })
    .from(taxiRequestsTable)
    .where(eq(taxiRequestsTable.status, "in_progress"))
    .limit(1);

  if (!activeReq?.assignedDriverId) return null;
  if (rejectedIds.includes(activeReq.assignedDriverId)) return null;

  const [driver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(
      and(
        eq(serviceProvidersTable.category, "taxi"),
        eq(serviceProvidersTable.id, activeReq.assignedDriverId),
        eq(serviceProvidersTable.isActive, true)
      )
    )
    .limit(1);

  return driver ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — GET /api/taxi/request/:id/status
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
      .from(serviceProvidersTable)
      .where(and(eq(serviceProvidersTable.id, request.assignedDriverId), eq(serviceProvidersTable.category, "taxi")));
    if (d) {
      driverInfo = { name: d.nameAr, phone: d.phone ?? "", carModel: d.carModel ?? null, carColor: d.carColor ?? null, carPlate: d.carPlate ?? null };
    }
  }

  res.json({ ...request, driverInfo });
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/taxi/request
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

  const firstDriver = await findNextDriver([]);
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
      status:            chosenDriver ? "pending" : "searching",
      assignedDriverId:  chosenDriver?.id ?? null,
      rejectedDriverIds: "",
    })
    .returning();

  if (chosenDriver?.linkedUserId) {
    emitTaxiRequest(chosenDriver.linkedUserId, {
      requestId:      request.id,
      customerName:   request.customerName,
      customerPhone:  request.customerPhone,
      pickupAddress:  request.pickupAddress,
      dropoffAddress: request.dropoffAddress,
      notes:          request.notes,
      commissionType: request.commissionType,
      fixedAmount:    request.fixedAmount,
      isQueued:       isBusyDriver,
    });
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

  const [taxiDriver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, driverUserId)));

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

  if (request.customerId) {
    emitTaxiResponse(request.customerId, {
      requestId:   id,
      status:      "accepted",
      etaMinutes,
      driverName:  taxiDriver.nameAr,
      driverPhone: taxiDriver.phone,
      carModel:    taxiDriver.carModel,
      carColor:    taxiDriver.carColor,
      carPlate:    taxiDriver.carPlate,
    });
  }

  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/taxi/request/:id/confirm
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

  if (request.assignedDriverId) {
    await db
      .update(serviceProvidersTable)
      .set({ isAvailable: false })
      .where(and(eq(serviceProvidersTable.id, request.assignedDriverId), eq(serviceProvidersTable.category, "taxi")));

    const [driverProvider] = await db
      .select({ linkedUserId: serviceProvidersTable.linkedUserId })
      .from(serviceProvidersTable)
      .where(and(eq(serviceProvidersTable.id, request.assignedDriverId), eq(serviceProvidersTable.category, "taxi")));

    if (driverProvider?.linkedUserId) {
      emitTaxiDriverUpdate(driverProvider.linkedUserId, {
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
// CUSTOMER — POST /api/taxi/request/:id/decline
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

  if (request.assignedDriverId) {
    const [driverProvider] = await db
      .select({ linkedUserId: serviceProvidersTable.linkedUserId })
      .from(serviceProvidersTable)
      .where(and(eq(serviceProvidersTable.id, request.assignedDriverId), eq(serviceProvidersTable.category, "taxi")));

    if (driverProvider?.linkedUserId) {
      emitTaxiDriverUpdate(driverProvider.linkedUserId, {
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
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, driverUserId)));

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

  const rejectedIds = parseRejected(request.rejectedDriverIds);
  rejectedIds.push(taxiDriver.id);
  const rejectedStr = rejectedIds.join(",");

  const nextDriver = await findNextDriver(rejectedIds);

  if (nextDriver) {
    await db
      .update(taxiRequestsTable)
      .set({
        status: "pending",
        assignedDriverId: nextDriver.id,
        rejectedDriverIds: rejectedStr,
        updatedAt: new Date(),
      })
      .where(eq(taxiRequestsTable.id, id));

    if (nextDriver.linkedUserId) {
      emitTaxiRequest(nextDriver.linkedUserId, {
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
    await db
      .update(taxiRequestsTable)
      .set({
        status: "searching",
        assignedDriverId: null,
        rejectedDriverIds: rejectedStr,
        updatedAt: new Date(),
      })
      .where(eq(taxiRequestsTable.id, id));

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
// DRIVER — GET /api/taxi/driver/current
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/driver/current", requireAuth, async (req, res) => {
  const driverUserId = (req as any).authSession?.userId;

  const [taxiDriver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, driverUserId)));

  if (!taxiDriver) { res.status(403).json({ message: "غير مرخص" }); return; }

  const [pendingReq, awaitingReq, activeReq] = await Promise.all([
    db.select().from(taxiRequestsTable)
      .where(and(eq(taxiRequestsTable.assignedDriverId, taxiDriver.id), eq(taxiRequestsTable.status, "pending")))
      .orderBy(taxiRequestsTable.createdAt).limit(1).then(r => r[0] ?? null),
    db.select().from(taxiRequestsTable)
      .where(and(eq(taxiRequestsTable.assignedDriverId, taxiDriver.id), eq(taxiRequestsTable.status, "accepted")))
      .limit(1).then(r => r[0] ?? null),
    db.select().from(taxiRequestsTable)
      .where(and(eq(taxiRequestsTable.assignedDriverId, taxiDriver.id), eq(taxiRequestsTable.status, "in_progress")))
      .limit(1).then(r => r[0] ?? null),
  ]);

  // Return with same field names as old taxiDriversTable for frontend compatibility
  const driver = { ...taxiDriver, name: taxiDriver.nameAr, userId: taxiDriver.linkedUserId };

  res.json({
    driver,
    pendingRequest:  pendingReq,
    awaitingRequest: awaitingReq,
    activeRequest:   activeReq,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — GET /api/taxi/driver/accepted  (backward compat)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/driver/accepted", requireAuth, async (req, res) => {
  const driverUserId = (req as any).authSession?.userId;

  const [taxiDriver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, driverUserId)));

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

  const driver = { ...taxiDriver, name: taxiDriver.nameAr, userId: taxiDriver.linkedUserId };
  res.json({ driver, activeRequest: request ?? null });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — POST /api/taxi/driver/complete/:id
// ─────────────────────────────────────────────────────────────────────────────
router.post("/taxi/driver/complete/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const driverUserId = (req as any).authSession?.userId;

  const [taxiDriver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, driverUserId)));

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

  await db
    .update(serviceProvidersTable)
    .set({ isAvailable: true })
    .where(and(eq(serviceProvidersTable.id, taxiDriver.id), eq(serviceProvidersTable.category, "taxi")));

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — GET /api/taxi/driver/history
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/driver/history", requireAuth, async (req, res) => {
  const driverUserId = (req as any).authSession?.userId;
  const { from, to } = req.query as { from?: string; to?: string };

  const [taxiDriver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, driverUserId)));

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
// CUSTOMER — GET /api/taxi/customer/history
// ─────────────────────────────────────────────────────────────────────────────
router.get("/taxi/customer/history", requireAuth, async (req, res) => {
  const customerUserId = (req as any).authSession?.userId;
  const { from, to } = req.query as { from?: string; to?: string };

  const conditions: any[] = [eq(taxiRequestsTable.customerId, customerUserId)];

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

  const driverIds = [...new Set(rides.map(r => r.assignedDriverId).filter(Boolean))] as number[];
  const drivers = driverIds.length > 0
    ? await db.select().from(serviceProvidersTable).where(and(eq(serviceProvidersTable.category, "taxi"), inArray(serviceProvidersTable.id, driverIds)))
    : [];
  const driverMap = Object.fromEntries(drivers.map(d => [d.id, { ...d, name: d.nameAr, userId: d.linkedUserId }]));

  const enriched = rides.map(r => ({
    ...r,
    driver: r.assignedDriverId ? (driverMap[r.assignedDriverId] ?? null) : null,
  }));

  res.json(enriched);
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — GET /api/admin/taxi/drivers  (now returns from service_providers)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/taxi/drivers", requireAdmin, async (req, res) => {
  const drivers = await db
    .select()
    .from(serviceProvidersTable)
    .where(eq(serviceProvidersTable.category, "taxi"))
    .orderBy(serviceProvidersTable.id);
  // Map to old shape for admin UI compatibility
  res.json(drivers.map(d => ({
    id: d.id, userId: d.linkedUserId, name: d.nameAr, phone: d.phone,
    carModel: d.carModel, carColor: d.carColor, carPlate: d.carPlate,
    isAvailable: d.isAvailable, isActive: d.isActive,
    lat: d.latitude, lng: d.longitude, createdAt: d.createdAt,
  })));
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /api/admin/taxi/drivers
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/taxi/drivers", requireAdmin, async (req, res) => {
  const { name, phone, password, carModel, carColor, carPlate } = req.body as {
    name: string; phone: string; password: string;
    carModel?: string; carColor?: string; carPlate?: string;
  };

  if (!name?.trim() || !phone?.trim() || !password?.trim()) {
    res.status(400).json({ message: "الاسم والهاتف وكلمة المرور مطلوبة" });
    return;
  }

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

  const [provider] = await db
    .insert(serviceProvidersTable)
    .values({
      name:         name.trim(),
      nameAr:       name.trim(),
      category:     "taxi",
      phone:        phone.trim(),
      linkedUserId: user.id,
      carModel:     carModel?.trim() ?? null,
      carColor:     carColor?.trim() ?? null,
      carPlate:     carPlate?.trim() ?? null,
      isAvailable:  true,
      isActive:     true,
      description:  "",
      descriptionAr: "",
      address:      "",
    })
    .returning();

  res.status(201).json({
    user,
    driver: { id: provider.id, userId: provider.linkedUserId, name: provider.nameAr, phone: provider.phone, carModel: provider.carModel, carColor: provider.carColor, carPlate: provider.carPlate, isAvailable: provider.isAvailable, isActive: provider.isActive },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PATCH /api/admin/taxi/drivers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/admin/taxi/drivers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { isAvailable, isActive, carModel, carColor, carPlate } = req.body;

  const updates: Partial<typeof serviceProvidersTable.$inferInsert> = {};
  if (isAvailable !== undefined) updates.isAvailable = isAvailable;
  if (isActive    !== undefined) updates.isActive    = isActive;
  if (carModel    !== undefined) updates.carModel    = carModel;
  if (carColor    !== undefined) updates.carColor    = carColor;
  if (carPlate    !== undefined) updates.carPlate    = carPlate;

  const [updated] = await db
    .update(serviceProvidersTable)
    .set(updates)
    .where(and(eq(serviceProvidersTable.id, id), eq(serviceProvidersTable.category, "taxi")))
    .returning();

  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — DELETE /api/admin/taxi/drivers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/admin/taxi/drivers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
  try {
    const [provider] = await db
      .select({ linkedUserId: serviceProvidersTable.linkedUserId })
      .from(serviceProvidersTable)
      .where(and(eq(serviceProvidersTable.id, id), eq(serviceProvidersTable.category, "taxi")));

    await db.delete(serviceProvidersTable).where(and(eq(serviceProvidersTable.id, id), eq(serviceProvidersTable.category, "taxi")));

    if (provider?.linkedUserId) {
      await db.delete(usersTable).where(eq(usersTable.id, provider.linkedUserId));
    }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PATCH /api/taxi/driver/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/taxi/driver/status", requireAuth, async (req, res) => {
  const session = (req as any).authSession;
  const { isAvailable } = req.body as { isAvailable: boolean };

  if (typeof isAvailable !== "boolean") {
    res.status(400).json({ message: "isAvailable (boolean) requis" });
    return;
  }

  const [driver] = await db
    .select()
    .from(serviceProvidersTable)
    .where(and(eq(serviceProvidersTable.category, "taxi"), eq(serviceProvidersTable.linkedUserId, session.userId)));

  if (!driver) {
    res.status(404).json({ message: "Chauffeur non trouvé" });
    return;
  }

  const [updated] = await db
    .update(serviceProvidersTable)
    .set({ isAvailable })
    .where(and(eq(serviceProvidersTable.id, driver.id), eq(serviceProvidersTable.category, "taxi")))
    .returning();

  res.json({ ...updated, name: updated.nameAr, userId: updated.linkedUserId });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — GET /api/admin/taxi/requests
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/taxi/requests", requireAdmin, async (req, res) => {
  const requests = await db
    .select()
    .from(taxiRequestsTable)
    .orderBy(taxiRequestsTable.createdAt);
  res.json(requests);
});

export default router;
