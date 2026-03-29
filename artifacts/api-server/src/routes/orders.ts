import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, serviceProvidersTable, deliveryStaffTable } from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { sendSMS } from "../services/sms";

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

router.post("/orders", async (req, res) => {
  const { customerName, customerPhone, customerAddress, delegationId, notes, serviceProviderId, serviceType, photoUrl } = req.body;
  if (!customerName || !customerAddress || !serviceProviderId || !serviceType) {
    res.status(400).json({ message: "customerName, customerAddress, serviceProviderId, serviceType are required" });
    return;
  }
  try {
    const [provider] = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.id, parseInt(serviceProviderId)));
    if (!provider) { res.status(400).json({ message: "Service provider not found" }); return; }

    const [order] = await db.insert(ordersTable).values({
      customerName, customerPhone, customerAddress,
      delegationId: delegationId ? parseInt(delegationId) : null,
      notes: notes || null,
      photoUrl: photoUrl || null,
      serviceType,
      serviceProviderId: provider.id,
      serviceProviderName: provider.name,
      status: "pending",
    }).returning();

    // ── SMS Trigger 1: Notify provider of new order ──
    if (provider.phone) {
      sendSMS(provider.phone,
        `🔔 طلب جديد #${order.id}\nالعميل: ${customerName}\nالعنوان: ${customerAddress}\nالخدمة: ${serviceType}${notes ? `\nملاحظة: ${notes}` : ""}`
      ).catch(() => {});
    }

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid order ID" }); return; }

  const { status, deliveryStaffId, deliveryFee } = req.body;
  const validStatuses = ["pending", "accepted", "prepared", "in_delivery", "delivered", "cancelled", "confirmed", "in_progress"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ message: `Invalid status.` }); return;
  }
  try {
    // Fetch current order before update (needed for SMS context)
    const [currentOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!currentOrder) { res.status(404).json({ message: "Order not found" }); return; }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (deliveryStaffId !== undefined) updates.deliveryStaffId = deliveryStaffId ? parseInt(deliveryStaffId) : null;
    if (deliveryFee !== undefined) updates.deliveryFee = parseFloat(deliveryFee);

    const [order] = await db.update(ordersTable).set(updates as any).where(eq(ordersTable.id, id)).returning();
    res.json(order);

    // ── SMS Trigger 2: Order prepared → notify all available delivery staff ──
    if (status === "prepared") {
      try {
        const availableStaff = await db.select().from(deliveryStaffTable)
          .where(eq(deliveryStaffTable.isAvailable, true));
        for (const staff of availableStaff) {
          if (staff.phone) {
            sendSMS(staff.phone,
              `🚀 طلب جاهز للتوصيل! #${id}\nالعميل: ${order.customerName}\nالعنوان: ${order.customerAddress}\nالمزود: ${order.serviceProviderName}`
            ).catch(() => {});
          }
        }
      } catch {}
    }

    // ── SMS Trigger 3: In delivery → notify customer ──
    if (status === "in_delivery" && order.customerPhone) {
      sendSMS(order.customerPhone,
        `🚗 طلبك #${id} من ${order.serviceProviderName} في طريقه إليك الآن!\nسيصل قريباً. شكراً لاستخدامك المدينة الرقمية 🌟`
      ).catch(() => {});
    }

  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// Provider: orders for a specific provider
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

// Provider: count of pending orders (notification polling)
router.get("/provider/:providerId/pending-count", async (req, res) => {
  const providerId = parseInt(req.params.providerId);
  if (isNaN(providerId)) { res.status(400).json({ message: "Invalid providerId" }); return; }
  try {
    const orders = await db.select({ id: ordersTable.id }).from(ordersTable)
      .where(and(eq(ordersTable.serviceProviderId, providerId), eq(ordersTable.status as any, "pending")));
    res.json({ count: orders.length });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// Delivery pool: prepared + in_delivery orders
router.get("/delivery/orders", async (req, res) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(inArray(ordersTable.status as any, ["prepared", "in_delivery"]));
    res.json(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
