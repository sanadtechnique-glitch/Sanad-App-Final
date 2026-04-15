import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vendorMessagesTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireStaff } from "../lib/authMiddleware";

const router: IRouter = Router();

// [C-7 FIXED] GET vendor thread — requires staff auth (providers and admins only)
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

// [C-6 FIXED] POST send message — vendor role requires staff token; admin role requires admin token
router.post("/vendor-messages/:supplierId", async (req, res) => {
  const supplierId = parseInt(req.params.supplierId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid supplierId" }); return; }
  const { senderRole, body } = req.body;
  if (!body?.trim()) { res.status(400).json({ message: "body is required" }); return; }
  if (!["admin", "vendor"].includes(senderRole)) {
    res.status(400).json({ message: "Invalid senderRole" }); return;
  }

  // [C-6] Validate token for the claimed role
  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Authentication required" }); return;
  }
  const { getSession } = await import("../lib/sessionStore");
  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ message: "Session expired or invalid" }); return;
  }

  const ADMIN_ROLES  = new Set(["super_admin", "admin", "manager"]);
  const VENDOR_ROLES = new Set(["provider", "super_admin", "admin", "manager"]);

  if (senderRole === "admin" && !ADMIN_ROLES.has(session.role)) {
    res.status(403).json({ message: "Admin token required to send as admin" }); return;
  }
  if (senderRole === "vendor" && !VENDOR_ROLES.has(session.role)) {
    res.status(403).json({ message: "Provider token required to send as vendor" }); return;
  }

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

// PATCH mark thread as read (admin only)
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

// GET /admin/vendor-messages — all conversations summary (admin only)
router.get("/admin/vendor-messages", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        supplierId:    vendorMessagesTable.supplierId,
        supplierName:  serviceProvidersTable.nameAr,
        lastBody:      vendorMessagesTable.body,
        senderRole:    vendorMessagesTable.senderRole,
        isRead:        vendorMessagesTable.isRead,
        createdAt:     vendorMessagesTable.createdAt,
      })
      .from(vendorMessagesTable)
      .leftJoin(serviceProvidersTable, eq(vendorMessagesTable.supplierId, serviceProvidersTable.id))
      .orderBy(desc(vendorMessagesTable.createdAt));

    // Deduplicate — only latest message per supplier
    const seen = new Set<number>();
    const summary = rows.filter(r => {
      if (seen.has(r.supplierId)) return false;
      seen.add(r.supplierId);
      return true;
    });

    res.json(summary);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

export default router;
