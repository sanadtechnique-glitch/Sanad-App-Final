import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, serviceProvidersTable, deliveryStaffTable, orderItemsTable } from "@workspace/db/schema";
import { eq, inArray, and, ilike } from "drizzle-orm";
import { emitNewOrder, emitOrderTaken, emitOrderStatus } from "../lib/socket";
import { requireStaff, requireAdmin } from "../lib/authMiddleware";
import { safeParseFloat, safeParseInt } from "../lib/validate";
import { calculateDistance, haversineKm, getDeliveryConfig } from "../lib/distance";
import { sendPushToUsers } from "./push";

/* Arabic / French status labels for push notifications */
const STATUS_LABEL: Record<string, { ar: string; fr: string }> = {
  accepted:           { ar: "✅ تم قبول طلبك",        fr: "✅ Commande acceptée" },
  prepared:           { ar: "📦 طلبك جاهز للتوصيل",   fr: "📦 Commande prête" },
  driver_accepted:    { ar: "🛵 السائق في طريقه إليك", fr: "🛵 Livreur en route" },
  in_delivery:        { ar: "🚀 طلبك في الطريق",       fr: "🚀 En livraison" },
  delivered:          { ar: "🎉 تم تسليم طلبك",        fr: "🎉 Commande livrée" },
  cancelled:          { ar: "❌ تم إلغاء طلبك",        fr: "❌ Commande annulée" },
};

const router: IRouter = Router();

router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
    res.json(orders.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching orders");
    res.status(500).json({ message: "Internal server error" });
  }
});

// !! MUST be before /orders/:id to avoid "customer" being treated as an ID
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

// GET /distance — Calculate distance + fee + ETA between provider and customer
router.get("/distance", async (req, res) => {
  const { providerLat, providerLng, customerLat, customerLng, providerId } = req.query as Record<string, string>;

  let pLat: number | null = providerLat ? parseFloat(providerLat) : null;
  let pLng: number | null = providerLng ? parseFloat(providerLng) : null;

  if (providerId && (!pLat || !pLng)) {
    const [provider] = await db.select({ latitude: serviceProvidersTable.latitude, longitude: serviceProvidersTable.longitude })
      .from(serviceProvidersTable).where(eq(serviceProvidersTable.id, parseInt(providerId)));
    if (provider) { pLat = provider.latitude; pLng = provider.longitude; }
  }

  const cLat = customerLat ? parseFloat(customerLat) : null;
  const cLng = customerLng ? parseFloat(customerLng) : null;

  if (!cLat || !cLng || isNaN(cLat) || isNaN(cLng)) {
    res.status(400).json({ message: "customerLat and customerLng are required" }); return;
  }

  try {
    const result = await calculateDistance(pLat, pLng, cLat, cLng);
    res.json(result);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Could not calculate distance" });
  }
});

// POST /orders — Customer places order → status "searching_for_driver" → broadcast to ALL drivers
router.post("/orders", async (req, res) => {
  const { customerName, customerPhone, customerAddress, delegationId, notes,
    serviceProviderId, serviceType, photoUrl, customerId,
    customerLat, customerLng, items, totalAmount } = req.body;

  if (!customerName || !customerAddress || !serviceProviderId || !serviceType) {
    res.status(400).json({ message: "customerName, customerAddress, serviceProviderId, serviceType are required" });
    return;
  }
  try {
    const [provider] = await db.select().from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.id, parseInt(serviceProviderId)));
    if (!provider) { res.status(400).json({ message: "Service provider not found" }); return; }

    const cid = customerId ? parseInt(String(customerId)) : null;
    const cLat = customerLat ? parseFloat(String(customerLat)) : null;
    const cLng = customerLng ? parseFloat(String(customerLng)) : null;

    // Load config to enforce minimum fee server-side
    const cfg = await getDeliveryConfig();

    let distanceKm: number | null = null;
    let etaMinutes: number | null = null;
    let computedFee: number | null = null;

    if (cLat && cLng && !isNaN(cLat) && !isNaN(cLng)) {
      try {
        const dist = await calculateDistance(provider.latitude, provider.longitude, cLat, cLng);
        distanceKm = dist.distanceKm;
        etaMinutes = dist.etaMinutes;
        // calculateDistance already applies Math.max(minFee) — use directly
        computedFee = dist.deliveryFee;
      } catch { /* fallback to no calculation */ }
    }

    // Server-side minimum enforcement — NEVER save a fee below minFee regardless of client value
    const rawFee     = computedFee ?? (req.body.deliveryFee ? parseFloat(String(req.body.deliveryFee)) : 0);
    const savedFee   = Math.max(rawFee, cfg.minFee);
    const savedTotal = Math.round((savedFee + (totalAmount ? parseFloat(String(totalAmount)) - rawFee : 0)) * 1000) / 1000;

    const [order] = await db.insert(ordersTable).values({
      customerName, customerPhone, customerAddress,
      customerLat: cLat,
      customerLng: cLng,
      delegationId: delegationId ? parseInt(delegationId) : null,
      notes: notes || null,
      photoUrl: photoUrl || null,
      serviceType,
      serviceProviderId: provider.id,
      serviceProviderName: provider.name,
      status: "searching_for_driver",
      customerId: isNaN(cid as number) ? null : cid,
      deliveryFee: savedFee,
      totalAmount: totalAmount ? savedTotal : savedFee,
      distanceKm,
      etaMinutes,
    }).returning();

    // Save ordered items if provided (from cart)
    if (Array.isArray(items) && items.length > 0) {
      const rows = items
        .filter((item: any) => item.nameAr && item.qty > 0)
        .map((item: any) => ({
          orderId: order.id,
          articleId: item.articleId ? parseInt(String(item.articleId)) : null,
          nameAr: String(item.nameAr),
          nameFr: String(item.nameFr || item.nameAr),
          price: parseFloat(String(item.price)) || 0,
          qty: parseInt(String(item.qty)) || 1,
          subtotal: (parseFloat(String(item.price)) || 0) * (parseInt(String(item.qty)) || 1),
        }));
      if (rows.length > 0) {
        await db.insert(orderItemsTable).values(rows);
      }
    }

    // Real-time: broadcast instantly to ALL connected drivers
    emitNewOrder({ ...order });

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// GET /orders/:id/items — fetch ordered items for a specific order
router.get("/orders/:id/items", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid order ID" }); return; }
  try {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    res.json(items);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// POST /orders/:id/driver-accept — Atomic first-come-first-served
// DB transaction ensures ONLY ONE driver can win the order
router.post("/orders/:id/driver-accept", requireStaff, async (req, res) => {
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
    emitOrderTaken(orderId, driverName, result.customerId ?? result.customerPhone ?? undefined);

    res.json({ ...result, driverName });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/orders/:id", requireStaff, async (req, res) => {
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
  if (deliveryFee !== undefined) {
    const fee = safeParseFloat(deliveryFee);
    if (fee === null) { res.status(400).json({ message: "Invalid deliveryFee value" }); return; }
  }
  try {
    const [currentOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!currentOrder) { res.status(404).json({ message: "Order not found" }); return; }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (deliveryStaffId !== undefined) updates.deliveryStaffId = deliveryStaffId ? safeParseInt(deliveryStaffId) : null;
    if (deliveryFee !== undefined) updates.deliveryFee = safeParseFloat(deliveryFee);

    const [order] = await db.update(ordersTable).set(updates as any).where(eq(ordersTable.id, id)).returning();

    if (status) {
      emitOrderStatus(id, status, { order });
      // If provider marks prepared → re-broadcast to drivers
      if (status === "prepared") emitNewOrder({ ...order });

      /* ── Send Web Push to customer if subscribed ── */
      const label = STATUS_LABEL[status];
      const cid   = order.customerId;
      if (label && cid) {
        sendPushToUsers([cid], {
          title: `سند · Sanad — #${id}`,
          body: label.ar,
          url: "/orders",
          tag: `order-${id}`,
        }).catch(() => {});
      }
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

export default router;
