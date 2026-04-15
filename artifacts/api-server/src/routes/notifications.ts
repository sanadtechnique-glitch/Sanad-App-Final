import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { broadcastsTable, usersTable } from "@workspace/db/schema";
import { desc, gte, eq, or, and } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";
import { sendPushToUsers } from "./push";

const router: IRouter = Router();

// Public — clients poll for broadcasts directed at them
// [P: FIXED] Broadcast fetch — role filter applied in SQL, not in JS memory
router.get("/notifications/broadcast", async (req, res) => {
  const role  = (req.query.role as string) || "all";
  const since = req.query.since ? new Date(parseInt(req.query.since as string)) : null;

  // Accept only known roles to prevent enumeration
  const VALID_ROLES = new Set(["all", "customer", "driver", "provider", "admin", "manager"]);
  const safeRole    = VALID_ROLES.has(role) ? role : "all";

  try {
    const roleFilter = or(
      eq(broadcastsTable.targetRole, "all"),
      eq(broadcastsTable.targetRole, safeRole),
    );
    const whereClause = since
      ? and(roleFilter, gte(broadcastsTable.createdAt, since))
      : roleFilter;

    const rows = await db.select().from(broadcastsTable)
      .where(whereClause)
      .orderBy(desc(broadcastsTable.createdAt))
      .limit(30);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin: full broadcast list [ADMIN ONLY]
router.get("/admin/broadcasts", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(broadcastsTable)
      .orderBy(desc(broadcastsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin: send a broadcast [ADMIN ONLY]
router.post("/admin/broadcast", requireAdmin, async (req, res) => {
  const { message, messageAr, targetRole, createdBy } = req.body;
  if (!message) {
    res.status(400).json({ message: "message is required" }); return;
  }
  const session = (req as any).authSession;
  try {
    const [row] = await db.insert(broadcastsTable).values({
      message,
      messageAr: messageAr || message,
      targetRole: targetRole || "all",
      createdBy: createdBy || session?.username || "admin",
    }).returning();

    /* ── Also send Web Push to subscribed users ── */
    try {
      let users: { id: number }[];
      const role = targetRole || "all";
      if (role === "all") {
        users = await db.select({ id: usersTable.id }).from(usersTable);
      } else {
        users = await db.select({ id: usersTable.id }).from(usersTable)
          .where(eq(usersTable.role, role));
      }
      await sendPushToUsers(
        users.map((u) => u.id),
        {
          title: "سند · Sanad",
          body: messageAr || message,
          url: "/",
          tag: "broadcast",
        }
      );
    } catch { /* push failure should not block response */ }

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin: delete a broadcast [ADMIN ONLY]
router.delete("/admin/broadcast/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }
  try {
    await db.delete(broadcastsTable).where(eq(broadcastsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
