import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vendorMessagesTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { requireAdmin, requireStaff } from "../lib/authMiddleware";
import { sendPushToUsers } from "./push";

const router: IRouter = Router();

// GET vendor thread — requires staff auth
router.get("/vendor-messages/:supplierId", requireStaff, async (req, res) => {
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

// POST send message — vendor or admin
router.post("/vendor-messages/:supplierId", async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  const { senderRole, body, type, title } = req.body;
  if (!body?.trim()) { res.status(400).json({ message: "body is required" }); return; }
  if (!["admin", "vendor"].includes(senderRole)) {
    res.status(400).json({ message: "Invalid senderRole" }); return;
  }

  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  const { getSession } = await import("../lib/sessionStore");
  const session = await getSession(token);
  if (!session) { res.status(401).json({ message: "Session expired or invalid" }); return; }

  const ADMIN_ROLES  = new Set(["super_admin", "admin", "manager"]);
  const VENDOR_ROLES = new Set(["provider", "super_admin", "admin", "manager"]);

  if (senderRole === "admin" && !ADMIN_ROLES.has(session.role)) {
    res.status(403).json({ message: "Admin token required" }); return;
  }
  if (senderRole === "vendor" && !VENDOR_ROLES.has(session.role)) {
    res.status(403).json({ message: "Provider token required" }); return;
  }

  const msgType = (type && ["chat", "info", "warning", "success"].includes(type)) ? type : "chat";
  const msgTitle = title?.trim() || null;

  try {
    const [msg] = await db.insert(vendorMessagesTable).values({
      supplierId,
      senderRole,
      type: msgType,
      title: msgTitle,
      body: body.trim(),
    }).returning();
    res.status(201).json(msg);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// PATCH mark thread as read (admin side)
router.patch("/vendor-messages/read/:supplierId", requireAdmin, async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  try {
    await db.update(vendorMessagesTable).set({ isRead: true }).where(
      and(eq(vendorMessagesTable.supplierId, supplierId), eq(vendorMessagesTable.senderRole, "vendor"))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// PATCH mark notifications as read (vendor side — marks admin messages as read)
router.patch("/vendor-messages/mark-read/:supplierId", requireStaff, async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  try {
    await db.update(vendorMessagesTable).set({ isRead: true }).where(
      and(eq(vendorMessagesTable.supplierId, supplierId), eq(vendorMessagesTable.senderRole, "admin"))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// GET /admin/vendor-messages — all conversations summary
router.get("/admin/vendor-messages", requireAdmin, async (req, res) => {
  try {
    // Get all providers
    const providers = await db.select().from(serviceProvidersTable);
    // Get unread counts (vendor messages that admin hasn't seen)
    const allUnread = await db.select().from(vendorMessagesTable).where(
      and(eq(vendorMessagesTable.senderRole, "vendor"), eq(vendorMessagesTable.isRead, false))
    );
    const unreadBySupplier = new Map<number, number>();
    for (const m of allUnread) {
      unreadBySupplier.set(m.supplierId, (unreadBySupplier.get(m.supplierId) ?? 0) + 1);
    }
    // Get last message per supplier
    const allMsgs = await db.select().from(vendorMessagesTable).orderBy(desc(vendorMessagesTable.createdAt));
    const lastMsgBySupplier = new Map<number, typeof allMsgs[0]>();
    for (const m of allMsgs) {
      if (!lastMsgBySupplier.has(m.supplierId)) lastMsgBySupplier.set(m.supplierId, m);
    }
    // Build summary for suppliers that have messages
    const suppliersWithMessages = providers.filter(p => lastMsgBySupplier.has(p.id));
    const result = suppliersWithMessages.map(p => ({
      id:           p.id,
      nameAr:       p.nameAr,
      nameFr:       p.name,
      phone:        p.phone,
      category:     p.category,
      unreadCount:  unreadBySupplier.get(p.id) ?? 0,
      lastMessage:  lastMsgBySupplier.get(p.id)?.body ?? "",
      lastAt:       lastMsgBySupplier.get(p.id)?.createdAt?.toISOString() ?? "",
    }));
    result.sort((a, b) => (a.lastAt > b.lastAt ? -1 : 1));
    res.json(result);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// POST /admin/broadcast/notification — send structured notification to filtered providers
router.post("/admin/broadcast/notification", requireAdmin, async (req, res) => {
  const { type, title, body, targetMode, targetValue } = req.body as {
    type?: string; title?: string; body?: string;
    targetMode?: "all" | "category" | "delegation"; targetValue?: string;
  };
  if (!body?.trim()) { res.status(400).json({ message: "body is required" }); return; }
  const msgType = (type && ["info", "warning", "success", "chat"].includes(type)) ? type : "info";
  const msgTitle = title?.trim() || null;

  try {
    let providers = await db.select().from(serviceProvidersTable);
    if (targetMode === "category" && targetValue) {
      providers = providers.filter(p => p.category === targetValue);
    } else if (targetMode === "delegation" && targetValue) {
      providers = providers.filter(p =>
        p.delegationAr === targetValue || p.delegationFr === targetValue
      );
    }

    if (providers.length === 0) {
      res.status(400).json({ message: "No providers match the filter" }); return;
    }

    // Insert notification for each provider
    const values = providers.map(p => ({
      supplierId: p.id,
      senderRole: "admin" as const,
      type: msgType as "chat" | "info" | "warning" | "success",
      title: msgTitle,
      body: body.trim(),
    }));
    await db.insert(vendorMessagesTable).values(values);

    // Send push notifications to matching providers
    try {
      await sendPushToUsers(
        providers.map(p => p.id),
        {
          title: msgTitle ?? (msgType === "warning" ? "⚠ تنبيه · Alerte" : msgType === "success" ? "✅ إشعار · Notification" : "ℹ إشعار · Info"),
          body: body.trim().slice(0, 120),
          url: "/provider",
        }
      );
    } catch { /* push optional */ }

    res.json({ ok: true, sent: providers.length });
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// GET /admin/broadcast/delegations — unique delegations for filter dropdown
router.get("/admin/broadcast/delegations", requireAdmin, async (req, res) => {
  try {
    const providers = await db.select({ d: serviceProvidersTable.delegationAr }).from(serviceProvidersTable);
    const unique = [...new Set(providers.map(p => p.d).filter(Boolean))];
    res.json(unique);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
