import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json(order);
  } catch (err) {
    req.log.error({ err }, "Error fetching order");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/orders", async (req, res) => {
  const { customerName, customerAddress, notes, serviceProviderId, serviceType } = req.body;

  if (!customerName || !customerAddress || !serviceProviderId || !serviceType) {
    res.status(400).json({ message: "Missing required fields: customerName, customerAddress, serviceProviderId, serviceType" });
    return;
  }

  try {
    const [provider] = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.id, parseInt(serviceProviderId)));
    if (!provider) {
      res.status(400).json({ message: "Service provider not found" });
      return;
    }

    const [order] = await db.insert(ordersTable).values({
      customerName,
      customerAddress,
      notes: notes || null,
      serviceType,
      serviceProviderId: provider.id,
      serviceProviderName: provider.name,
      status: "pending",
    }).returning();

    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }, "Error creating order");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid order ID" });
    return;
  }

  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "in_progress", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  try {
    const [order] = await db.update(ordersTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json(order);
  } catch (err) {
    req.log.error({ err }, "Error updating order");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
