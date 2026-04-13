import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vendorMessagesTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

// ── GET /vendor-messages/:supplierId ── fetch thread for one supplier ─────────
router.get("/vendor-messages/:supplierId", async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  try {
    const msgs = await db
      .select()
      .from(vendorMessagesTable)
      .where(eq(vendorMessagesTable.supplierId, supplierId))
      .orderBy(vendorMessagesTable.createdAt);
    res.json(msgs);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── POST /vendor-messages/:supplierId ── send a message ───────────────────────
router.post("/vendor-messages/:supplierId", async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  const { senderRole, body } = req.body;
  if (!body?.trim()) { res.status(400).json({ message: "body is required" }); return; }
  if (!["admin","vendor"].includes(senderRole)) { res.status(400).json({ message: "Invalid senderRole" }); return; }
  try {
    const [msg] = await db.insert(vendorMessagesTable).values({
      supplierId,
      senderRole,
      body: body.trim(),
    }).returning();
    res.status(201).json(msg);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /vendor-messages/read/:supplierId ── mark supplier thread as read (admin) ──
router.patch("/vendor-messages/read/:supplierId", requireAdmin, async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  try {
    await db
      .update(vendorMessagesTable)
      .set({ isRead: true })
      .where(eq(vendorMessagesTable.supplierId, supplierId));
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── GET /admin/vendor-messages ── all conversations summary (admin) ───────────
router.get("/admin/vendor-messages", requireAdmin, async (req, res) => {
  try {
    const [msgs, suppliers] = await Promise.all([
      db.select().from(vendorMessagesTable).orderBy(desc(vendorMessagesTable.createdAt)),
      db.select({
        id: serviceProvidersTable.id,
        name: serviceProvidersTable.name,
        nameAr: serviceProvidersTable.nameAr,
        category: serviceProvidersTable.category,
      }).from(serviceProvidersTable),
    ]);

    const supMap = Object.fromEntries(suppliers.map(s => [s.id, s]));
    const threads: Record<number, {
      supplierId: number; supplierName: string; supplierNameAr: string; category: string;
      lastMessage: string; lastAt: string; unread: number;
    }> = {};

    for (const msg of msgs) {
      if (!threads[msg.supplierId]) {
        const sup = supMap[msg.supplierId];
        threads[msg.supplierId] = {
          supplierId: msg.supplierId,
          supplierName:   sup?.name   ?? `#${msg.supplierId}`,
          supplierNameAr: sup?.nameAr ?? `#${msg.supplierId}`,
          category:       sup?.category ?? "",
          lastMessage: msg.body,
          lastAt: msg.createdAt.toISOString(),
          unread: 0,
        };
      }
      if (!msg.isRead && msg.senderRole === "vendor") {
        threads[msg.supplierId].unread += 1;
      }
    }

    res.json(Object.values(threads).sort((a, b) =>
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    ));
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

export default router;
