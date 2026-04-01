import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { broadcastsTable } from "@workspace/db/schema";
import { desc, gte, eq } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

// Public — clients poll for broadcasts directed at them
router.get("/notifications/broadcast", async (req, res) => {
  try {
    const role = (req.query.role as string) || "all";
    const since = req.query.since ? new Date(parseInt(req.query.since as string)) : null;

    let query = db.select().from(broadcastsTable).$dynamic();
    if (since) query = query.where(gte(broadcastsTable.createdAt, since));

    const all = await query.orderBy(desc(broadcastsTable.createdAt)).limit(30);

    const filtered = all.filter(b =>
      b.targetRole === "all" || b.targetRole === role
    );

    res.json(filtered);
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
