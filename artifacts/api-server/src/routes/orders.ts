import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, serviceProvidersTable, deliveryStaffTable } from "@workspace/db/schema";
import { eq, inArray, and, ilike } from "drizzle-orm";
import { emitNewOrder, emitOrderTaken, emitOrderStatus } from "../lib/socket";

const router: IRouter = Router();

router.get("/orders", async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
    res.json(orders.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching orders");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid order ID" }); return; }
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) { res.status(404).json({ message: "Order not found" }); return; }
    res.json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// POST /orders — Customer places order → status "searching_for_driver" → broadcast to ALL drivers
router.post("/orders", async (req, res) => {
  const { customerName, customerPhone, customerAddress, delegationId, notes,
    serviceProviderId, serviceType, photoUrl, customerId } = req.body;

  if (!customerName || !customerAddress || !serviceProviderId || !serviceType) {
    res.status(400).json({ message: "customerName, customerAddress, serviceProviderId, serviceType are required" });
    return;
  }
  try {
    const [provider] = await db.select().from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.id, parseInt(serviceProviderId)));
    if (!provider) { res.status(400).json({ message: "Service provider not found" }); return; }

    const [order] = await db.insert(ordersTable).values({
      customerName, customerPhone, customerAddress,
      delegationId: delegationId ? parseInt(delegationId) : null,
      notes: notes || null,
      photoUrl: photoUrl || null,
      serviceType,
      serviceProviderId: provider.id,
      serviceProviderName: provider.name,
      status: "searching_for_driver",
    }).returning();

    // Real-time: broadcast instantly to ALL connected drivers
    emitNewOrder({ ...order, customerId: customerId || null });

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// POST /orders/:id/driver-accept — Atomic first-come-first-served
// DB transaction ensures ONLY ONE driver can win the order
router.post("/orders/:id/driver-accept", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ message: "Invalid order ID" }); return; }

  const { staffId } = req.body as { staffId?: number };
  if (!staffId) { res.status(400).json({ message: "staffId is required" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      // Atomic conditional update: succeeds ONLY if order is still available
      const updated = await tx
        .update(ordersTable)
        .set({ status: "driver_accepted", deliveryStaffId: staffId, updatedAt: new Date() })
        .where(
          and(
            eq(ordersTable.id, orderId),
            inArray(ordersTable.status as any, ["searching_for_driver", "pending", "prepared"])
          )
        )
        .returning();
      return updated[0] || null;
    });

    if (!result) {
      // Another driver was faster
      res.status(409).json({ message: "order_already_taken" });
      return;
    }

    const [staff] = await db.select({ nameAr: deliveryStaffTable.nameAr })
      .from(deliveryStaffTable).where(eq(deliveryStaffTable.id, staffId));
    const driverName = staff?.nameAr ?? "السائق";

    // Real-time: remove order from all other drivers + notify customer
    emitOrderTaken(orderId, driverName, result.customerPhone ?? undefined);

    res.json({ ...result, driverName });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid order ID" }); return; }

  const { status, deliveryStaffId, deliveryFee } = req.body;
  const validStatuses = [
    "searching_for_driver", "pending", "accepted", "prepared",
    "driver_accepted", "in_delivery", "delivered", "cancelled", "confirmed", "in_progress",
  ];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ message: `Invalid status.` }); return;
  }
  try {
    const [currentOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!currentOrder) { res.status(404).json({ message: "Order not found" }); return; }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (deliveryStaffId !== undefined) updates.deliveryStaffId = deliveryStaffId ? parseInt(deliveryStaffId) : null;
    if (deliveryFee !== undefined) updates.deliveryFee = parseFloat(deliveryFee);

    const [order] = await db.update(ordersTable).set(updates as any).where(eq(ordersTable.id, id)).returning();

    if (status) {
      emitOrderStatus(id, status, { order });
      // If provider marks prepared → re-broadcast to drivers
      if (status === "prepared") emitNewOrder({ ...order });
    }

    res.json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/provider/:providerId/orders", async (req, res) => {
  const providerId = parseInt(req.params.providerId);
  if (isNaN(providerId)) { res.status(400).json({ message: "Invalid providerId" }); return; }
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.serviceProviderId, providerId));
    res.json(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/provider/:providerId/pending-count", async (req, res) => {
  const providerId = parseInt(req.params.providerId);
  if (isNaN(providerId)) { res.status(400).json({ message: "Invalid providerId" }); return; }
  try {
    const orders = await db.select({ id: ordersTable.id }).from(ordersTable)
      .where(and(
        eq(ordersTable.serviceProviderId, providerId),
        inArray(ordersTable.status as any, ["searching_for_driver", "pending"])
      ));
    res.json({ count: orders.length });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// Delivery pool: orders available for drivers
router.get("/delivery/orders", async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(inArray(ordersTable.status as any, [
        "searching_for_driver", "prepared", "driver_accepted", "in_delivery",
      ]));
    res.json(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/delivery/staff/:staffId/orders", async (req, res) => {
  const staffId = parseInt(req.params.staffId);
  if (isNaN(staffId)) { res.status(400).json({ message: "Invalid staffId" }); return; }
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.deliveryStaffId, staffId));
    res.json(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/orders/customer", async (req, res) => {
  const name = req.query.name as string;
  if (!name) { res.status(400).json({ message: "name is required" }); return; }
  try {
    const orders = await db.select().from(ordersTable)
      .where(ilike(ordersTable.customerName, name));
    res.json(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/delivery/:staffId/orders", async (req, res) => {
  const staffId = parseInt(req.params.staffId);
  if (isNaN(staffId)) { res.status(400).json({ message: "Invalid staffId" }); return; }
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.deliveryStaffId, staffId));
    res.json(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
