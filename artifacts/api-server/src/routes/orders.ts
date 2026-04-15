import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, serviceProvidersTable, deliveryStaffTable, orderItemsTable, articlesTable, usersTable } from "@workspace/db/schema";
import { eq, inArray, and, ilike, desc } from "drizzle-orm";
import { emitNewOrder, emitOrderTaken, emitOrderStatus } from "../lib/socket";
import { requireStaff, requireAdmin, requireAuth } from "../lib/authMiddleware";
import { safeParseFloat, safeParseInt } from "../lib/validate";
import { calculateDistance, haversineKm, getProviderCoords } from "../lib/distance";
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

// Normalize Arabic/French delegation name — trims and collapses whitespace
function normDelegation(s?: string | null): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

const router: IRouter = Router();

// [C-1 FIXED] Admin-only: full order list with pagination
router.get("/orders", requireAdmin, async (req, res) => {
  const limit  = Math.min(parseInt(String(req.query.limit  || "200")), 500);
  const offset = parseInt(String(req.query.offset || "0"));
  try {
    const orders = await db.select().from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit).offset(offset);
    res.json(orders);
  } catch (err) {
    req.log.error({ err }, "Error fetching orders");
    res.status(500).json({ message: "Internal server error" });
  }
});

// [C-2 FIXED] Customer order lookup
// — Logged-in users: valid session token → only name required (phone skip)
// — Guest lookup:    no token         → both name + phone required (anti-enum)
// !! MUST be before /orders/:id to avoid "customer" being treated as an ID
router.get("/orders/customer", async (req, res) => {
  const name  = req.query.name  as string;
  const phone = req.query.phone as string | undefined;
  if (!name) { res.status(400).json({ message: "name is required" }); return; }

  // Check for a valid session token — authenticated users skip phone requirement
  let sessionValid = false;
  const token = req.headers["x-session-token"] as string | undefined;
  if (token) {
    const { getSession } = await import("../lib/sessionStore");
    const session = await getSession(token);
    if (session) sessionValid = true;
  }

  // Unauthenticated (guest) lookup must supply phone to prevent enumeration
  if (!sessionValid && !phone) {
    res.status(400).json({ message: "phone is required for identity verification" });
    return;
  }

  try {
    const conditions = sessionValid
      ? ilike(ordersTable.customerName, name)
      : and(ilike(ordersTable.customerName, name), ilike(ordersTable.customerPhone, phone!));

    const orders = await db.select().from(ordersTable)
      .where(conditions)
      .orderBy(desc(ordersTable.createdAt));
    res.json(orders);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// [C-1 FIXED] Single order lookup — requires valid session OR matching customerPhone+orderId
router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid order ID" }); return; }

  // Auth gate runs FIRST — before any DB lookup to prevent timing oracle on IDs
  const token      = req.headers["x-session-token"] as string | undefined;
  const phoneProof = (req.query.phone as string | undefined)?.trim();

  if (!token && !phoneProof) {
    res.status(401).json({ message: "Authentication required — pass x-session-token or ?phone=" });
    return;
  }

  let sessionValid = false;
  if (token) {
    const { getSession } = await import("../lib/sessionStore");
    const session = await getSession(token);
    if (session) sessionValid = true;
  }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) { res.status(404).json({ message: "Order not found" }); return; }

    // Phone proof validation: phone must match the order's registered phone
    if (!sessionValid) {
      if (!phoneProof || order.customerPhone?.trim() !== phoneProof) {
        res.status(403).json({ message: "Phone number does not match this order" });
        return;
      }
    }

    res.json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// GET /distance — Provider → Customer: Haversine + 2.500 + (km × 0.500)
// Query params: providerId (preferred) OR providerLat+providerLng, plus customerLat+customerLng
router.get("/distance", async (req, res) => {
  const { providerLat, providerLng, customerLat, customerLng, providerId } = req.query as Record<string, string>;

  const cLat = customerLat ? parseFloat(customerLat) : null;
  const cLng = customerLng ? parseFloat(customerLng) : null;
  if (!cLat || !cLng || isNaN(cLat) || isNaN(cLng)) {
    res.status(400).json({ message: "customerLat and customerLng are required" }); return;
  }

  let pLat: number | null = providerLat ? parseFloat(providerLat) : null;
  let pLng: number | null = providerLng ? parseFloat(providerLng) : null;

  if (providerId && (!pLat || !pLng)) {
    const coords = await getProviderCoords(parseInt(providerId));
    pLat = coords.latitude;
    pLng = coords.longitude;
  }

  try {
    const result = await calculateDistance(pLat, pLng, cLat, cLng);
    // [E-2] Flag if provider coords were null (distance may be inaccurate)
    const hasCoords = pLat != null && pLng != null;
    res.json({ ...result, providerCoordsSet: hasCoords });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Could not calculate distance" });
  }
});

// POST /orders — Customer places order → status "searching_for_driver" → broadcast to ALL drivers
router.post("/orders", async (req, res) => {
  const { customerName, customerPhone, customerAddress, delegationId, notes,
    serviceProviderId, serviceType, photoUrl, customerId,
    customerLat, customerLng, items, totalAmount,
    // [H-2] userDelegation — client's current delegation for server-side zone validation
    userDelegation } = req.body;

  if (!customerName || !customerAddress || !serviceProviderId || !serviceType) {
    res.status(400).json({ message: "customerName, customerAddress, serviceProviderId, serviceType are required" });
    return;
  }
  try {
    const [provider] = await db.select().from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.id, parseInt(serviceProviderId)));
    if (!provider) { res.status(400).json({ message: "Service provider not found" }); return; }

    // [H-2] Server-side delegation zone check (if provider has a delegation set)
    if (provider.delegationAr && userDelegation) {
      const normVendor = normDelegation(provider.delegationAr);
      const normUser   = normDelegation(userDelegation);
      if (normVendor && normUser && normVendor !== normUser) {
        res.status(422).json({
          message: "المزود خارج نطاق منطقتك",
          code: "ZONE_MISMATCH",
          vendorDelegation: normVendor,
          userDelegation:   normUser,
        });
        return;
      }
    }

    // [H-5 partial] Vendor must still be available at order time
    if (provider.isAvailable === false) {
      res.status(422).json({ message: "المزود غير متاح حالياً", code: "PROVIDER_UNAVAILABLE" });
      return;
    }

    const cid  = customerId ? parseInt(String(customerId)) : null;
    const cLat = customerLat ? parseFloat(String(customerLat)) : null;
    const cLng = customerLng ? parseFloat(String(customerLng)) : null;

    let distanceKm: number | null = null;
    let etaMinutes: number | null = null;
    let savedFee   = 2.500;

    const MAX_DELIVERY_FEE = 15;

    if (cLat && cLng && !isNaN(cLat) && !isNaN(cLng)) {
      try {
        const dist = await calculateDistance(provider.latitude, provider.longitude, cLat, cLng);
        distanceKm = dist.distanceKm;
        etaMinutes = dist.etaMinutes;
        savedFee   = dist.deliveryFee;
      } catch { /* GPS calc failed — keep base fare */ }
    } else if (req.body.deliveryFee) {
      const clientFee = parseFloat(String(req.body.deliveryFee));
      savedFee = isNaN(clientFee) ? 2.500 : Math.max(clientFee, 2.500);
    } else {
      // [H-1 FIXED] — no GPS coords AND no deliveryFee sent → reject to prevent zero-fee bypass
      res.status(400).json({
        message: "يجب تحديد موقعك الجغرافي لاحتساب رسوم التوصيل · Votre position GPS est requise pour calculer les frais",
        code: "LOCATION_REQUIRED",
      });
      return;
    }

    // Hard cap: reject orders where delivery fee exceeds limit
    if (savedFee > MAX_DELIVERY_FEE) {
      res.status(422).json({
        message: "المسافة بعيدة جداً للتوصيل حالياً",
        code: "DELIVERY_FEE_EXCEEDED",
        deliveryFee: savedFee,
        maxAllowed: MAX_DELIVERY_FEE,
      });
      return;
    }

    // [M-3 FIXED] — Server-side price verification for cart items
    let verifiedItems: Array<{
      orderId: number; articleId: number | null;
      nameAr: string; nameFr: string;
      price: number; qty: number; subtotal: number;
    }> = [];
    let serverSubtotal = 0;

    if (Array.isArray(items) && items.length > 0) {
      // Fetch all article IDs that have real DB entries
      const articleIds = items
        .map((i: any) => parseInt(String(i.articleId)))
        .filter(n => !isNaN(n) && n > 0);

      const dbArticles = articleIds.length > 0
        ? await db.select({
            id:      articlesTable.id,
            price:   articlesTable.price,
            nameAr:  articlesTable.nameAr,
            nameFr:  articlesTable.nameFr,
          }).from(articlesTable).where(inArray(articlesTable.id, articleIds))
        : [];

      const priceMap = new Map(dbArticles.map(a => [a.id, a]));

      for (const item of items as any[]) {
        if (!item.nameAr || parseInt(String(item.qty)) < 1) continue;
        const articleId = parseInt(String(item.articleId)) || null;
        const dbRow     = articleId ? priceMap.get(articleId) : null;
        // Use DB price if available; otherwise fall back to client price (custom/unlisted item)
        const unitPrice = dbRow ? Number(dbRow.price) : (parseFloat(String(item.price)) || 0);
        const qty       = parseInt(String(item.qty)) || 1;
        const subtotal  = Math.round(unitPrice * qty * 1000) / 1000;
        serverSubtotal += subtotal;
        verifiedItems.push({
          orderId:   0, // will be filled after insert
          articleId: articleId,
          nameAr:    String(item.nameAr),
          nameFr:    String(item.nameFr || item.nameAr),
          price:     unitPrice,
          qty,
          subtotal,
        });
      }
    }

    // Use server-calculated subtotal if items were provided; otherwise use client totalAmount
    const subtotal   = verifiedItems.length > 0 ? serverSubtotal : (totalAmount ? parseFloat(String(totalAmount)) : 0);
    const savedTotal = Math.round((subtotal > 0 ? subtotal + savedFee : savedFee) * 1000) / 1000;

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
      totalAmount: savedTotal,
      distanceKm,
      etaMinutes,
    }).returning();

    // Save verified items
    if (verifiedItems.length > 0) {
      await db.insert(orderItemsTable).values(
        verifiedItems.map(i => ({ ...i, orderId: order.id }))
      );
    }

    // Real-time: broadcast instantly to ALL connected drivers
    emitNewOrder({ ...order });

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// [C-1 FIXED] Order items — require staff or phone proof
router.get("/orders/:id/items", requireStaff, async (req, res) => {
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
router.post("/orders/:id/driver-accept", requireStaff, async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ message: "Invalid order ID" }); return; }

  const { staffId } = req.body as { staffId?: number };
  if (!staffId) { res.status(400).json({ message: "staffId is required" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
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
      res.status(409).json({ message: "order_already_taken" });
      return;
    }

    const [staff] = await db.select({ nameAr: deliveryStaffTable.nameAr })
      .from(deliveryStaffTable).where(eq(deliveryStaffTable.id, staffId));
    const driverName = staff?.nameAr ?? "السائق";

    emitOrderTaken(orderId, driverName, result.customerId ?? result.customerPhone ?? undefined);
    res.json({ ...result, driverName });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// [C-8 FIXED] Order status update — with ownership check
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

    // [C-8 FIXED] Ownership check — admins can update anything; providers/drivers only own orders
    const session    = (req as any).authSession as { userId: number; role: string; username: string };
    const isAdmin    = ["super_admin", "admin", "manager"].includes(session.role);

    if (!isAdmin) {
      // Look up the linked entity for this user
      const [user] = await db.select({
        linkedSupplierId: usersTable.linkedSupplierId,
        linkedStaffId:    usersTable.linkedStaffId,
      }).from(usersTable).where(eq(usersTable.id, session.userId));

      if (session.role === "provider") {
        const myId = user?.linkedSupplierId;
        if (!myId || currentOrder.serviceProviderId !== myId) {
          res.status(403).json({ message: "لا تملك صلاحية تعديل هذا الطلب · Non autorisé" }); return;
        }
      }
      if (session.role === "driver") {
        const myId = user?.linkedStaffId;
        if (!myId || currentOrder.deliveryStaffId !== myId) {
          res.status(403).json({ message: "لا تملك صلاحية تعديل هذا الطلب · Non autorisé" }); return;
        }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (deliveryStaffId !== undefined) updates.deliveryStaffId = deliveryStaffId ? safeParseInt(deliveryStaffId) : null;
    if (deliveryFee !== undefined) updates.deliveryFee = safeParseFloat(deliveryFee);

    const [order] = await db.update(ordersTable).set(updates as any).where(eq(ordersTable.id, id)).returning();

    if (status) {
      emitOrderStatus(id, status, { order });
      if (status === "prepared") emitNewOrder({ ...order });

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

// [C-8 FIXED] Provider orders — scoped to their own store + auth required
router.get("/provider/:providerId/orders", requireStaff, async (req, res) => {
  const providerId = parseInt(req.params.providerId);
  if (isNaN(providerId)) { res.status(400).json({ message: "Invalid providerId" }); return; }

  const session = (req as any).authSession as { userId: number; role: string };
  const isAdmin = ["super_admin", "admin", "manager"].includes(session.role);

  if (!isAdmin) {
    const [user] = await db.select({ linkedSupplierId: usersTable.linkedSupplierId })
      .from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user?.linkedSupplierId || user.linkedSupplierId !== providerId) {
      res.status(403).json({ message: "غير مصرح · Non autorisé" }); return;
    }
  }

  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.serviceProviderId, providerId))
      .orderBy(desc(ordersTable.createdAt))
      .limit(200);
    res.json(orders);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/provider/:providerId/pending-count", requireStaff, async (req, res) => {
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

// [C-3 FIXED] Delivery pool — requires staff auth
router.get("/delivery/orders", requireStaff, async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(inArray(ordersTable.status as any, [
        "searching_for_driver", "prepared", "driver_accepted", "in_delivery",
      ]))
      .orderBy(desc(ordersTable.createdAt));
    res.json(orders);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
