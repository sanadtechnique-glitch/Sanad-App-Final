import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { broadcastsTable } from "@workspace/db/schema";
import { desc, gte, or, eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/notifications/broadcast?role=client&since=<unix_ms>
router.get("/notifications/broadcast", async (req, res) => {
  try {
    const role = (req.query.role as string) || "all";
    const since = req.query.since ? new Date(parseInt(req.query.since as string)) : null;

    let query = db.select().from(broadcastsTable).$dynamic();

    if (since) {
      query = query.where(gte(broadcastsTable.createdAt, since));
    }

    const all = await query.orderBy(desc(broadcastsTable.createdAt)).limit(30);

    // Filter by targetRole
    const filtered = all.filter(b =>
      b.targetRole === "all" || b.targetRole === role
    );

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/admin/broadcasts — full list for admin
router.get("/admin/broadcasts", async (req, res) => {
  try {
    const rows = await db.select().from(broadcastsTable)
      .orderBy(desc(broadcastsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/broadcast — create broadcast
router.post("/admin/broadcast", async (req, res) => {
  const { message, messageAr, targetRole, createdBy } = req.body;
  if (!message) {
    res.status(400).json({ message: "message is required" });
    return;
  }
  try {
    const [row] = await db.insert(broadcastsTable).values({
      message,
      messageAr: messageAr || message,
      targetRole: targetRole || "all",
      createdBy: createdBy || "admin",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/broadcast/:id
router.delete("/admin/broadcast/:id", async (req, res) => {
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
