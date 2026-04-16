import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ratingsTable, serviceProvidersTable, usersTable,
  ordersTable, orderItemsTable,
} from "@workspace/db/schema";
import { eq, avg, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /reviews  — Submit a product review (auth required)
// Checks for a completed order containing this article to set isVerifiedBuyer.
// Reviews are held for admin approval (isApproved = false) by default.
// One review per user per article (prevents spam).
// ─────────────────────────────────────────────────────────────────────────────
router.post("/reviews", requireAuth, async (req, res) => {
  const session = (req as any).authSession as { userId: number; username: string };
  const { articleId, providerId, rating, comment } = req.body as {
    articleId?: number; providerId?: number;
    rating?: number; comment?: string;
  };

  if (!articleId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ message: "articleId and rating (1-5) are required" });
    return;
  }

  try {
    // Reject duplicate review (same user + article)
    const [existing] = await db
      .select({ id: ratingsTable.id })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.userId, session.userId), eq(ratingsTable.articleId, articleId)));

    if (existing) {
      res.status(409).json({ message: "لقد سبق وكتبت تقييماً لهذا المنتج · Vous avez déjà évalué ce produit" });
      return;
    }

    // Fetch reviewer display name
    const [userRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, session.userId));
    const reviewerName = userRow?.name ?? session.username ?? "مجهول";

    // Check for a completed order containing this article
    const completedOrders = await db
      .select({ orderId: ordersTable.id })
      .from(ordersTable)
      .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(
        and(
          eq(ordersTable.customerId, session.userId),
          eq(ordersTable.status, "delivered"),
          eq(orderItemsTable.articleId, articleId),
        ),
      )
      .limit(1);

    const isVerifiedBuyer = completedOrders.length > 0;

    const [row] = await db.insert(ratingsTable).values({
      articleId,
      providerId: providerId ?? null,
      userId: session.userId,
      reviewerName,
      rating,
      comment: comment?.trim() || null,
      isVerifiedBuyer,
      isApproved: true,
    }).returning();

    res.status(201).json({
      ...row,
      message: "تم إرسال تقييمك بنجاح · Merci pour votre avis !",
    });
  } catch (err) {
    req.log.error({ err }, "Error posting review");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /reviews?articleId=X  — Public: fetch approved reviews for a product
// Returns average rating + approved review list (reviewer name, date, stars).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/reviews", async (req, res) => {
  const articleId = req.query.articleId ? parseInt(req.query.articleId as string) : null;
  const providerId = req.query.providerId ? parseInt(req.query.providerId as string) : null;

  if (!articleId && !providerId) {
    res.status(400).json({ message: "articleId or providerId is required" });
    return;
  }

  try {
    const whereClause = articleId
      ? and(eq(ratingsTable.articleId, articleId), eq(ratingsTable.isApproved, true))
      : and(eq(ratingsTable.providerId, providerId!), eq(ratingsTable.isApproved, true));

    const rows = await db
      .select({
        id: ratingsTable.id,
        rating: ratingsTable.rating,
        comment: ratingsTable.comment,
        reviewerName: ratingsTable.reviewerName,
        isVerifiedBuyer: ratingsTable.isVerifiedBuyer,
        createdAt: ratingsTable.createdAt,
      })
      .from(ratingsTable)
      .where(whereClause)
      .orderBy(desc(ratingsTable.createdAt))
      .limit(50);

    const avgResult = await db
      .select({ avg: avg(ratingsTable.rating), count: sql<number>`count(*)::int` })
      .from(ratingsTable)
      .where(whereClause!);

    res.json({
      reviews: rows,
      average: avgResult[0]?.avg ? parseFloat(avgResult[0].avg) : null,
      count: avgResult[0]?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching reviews");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/reviews  — Admin: all reviews with filters
// ?status=pending|approved|all  (default: all)
// ?providerId=X   filter by store
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/reviews", requireAdmin, async (req, res) => {
  const status = (req.query.status as string) ?? "all";
  const providerIdQ = req.query.providerId ? parseInt(req.query.providerId as string) : null;

  try {
    let query = db
      .select({
        id: ratingsTable.id,
        articleId: ratingsTable.articleId,
        providerId: ratingsTable.providerId,
        userId: ratingsTable.userId,
        reviewerName: ratingsTable.reviewerName,
        rating: ratingsTable.rating,
        comment: ratingsTable.comment,
        isVerifiedBuyer: ratingsTable.isVerifiedBuyer,
        isApproved: ratingsTable.isApproved,
        createdAt: ratingsTable.createdAt,
      })
      .from(ratingsTable)
      .$dynamic();

    const conditions = [];
    if (status === "pending")  conditions.push(eq(ratingsTable.isApproved, false));
    if (status === "approved") conditions.push(eq(ratingsTable.isApproved, true));
    if (providerIdQ)           conditions.push(eq(ratingsTable.providerId, providerIdQ));

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(ratingsTable.createdAt)).limit(200);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error in admin reviews list");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/reviews/:id  — Admin: approve or reject a review
// Body: { isApproved: boolean }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/admin/reviews/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { isApproved } = req.body as { isApproved: boolean };

  if (typeof isApproved !== "boolean") {
    res.status(400).json({ message: "isApproved (boolean) is required" });
    return;
  }

  try {
    const [updated] = await db
      .update(ratingsTable)
      .set({ isApproved })
      .where(eq(ratingsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ message: "Review not found" }); return; }

    // If approved and has a providerId, recalculate the store's average rating
    if (isApproved && updated.providerId) {
      const result = await db
        .select({ avg: avg(ratingsTable.rating) })
        .from(ratingsTable)
        .where(and(eq(ratingsTable.providerId, updated.providerId), eq(ratingsTable.isApproved, true)));
      const newAvg = result[0]?.avg;
      if (newAvg) {
        await db.update(serviceProvidersTable)
          .set({ rating: parseFloat(newAvg) })
          .where(eq(serviceProvidersTable.id, updated.providerId));
      }
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating review approval");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/reviews/:id  — Admin: permanently delete a review
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/admin/reviews/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [deleted] = await db
      .delete(ratingsTable)
      .where(eq(ratingsTable.id, id))
      .returning({ id: ratingsTable.id, providerId: ratingsTable.providerId });

    if (!deleted) { res.status(404).json({ message: "Review not found" }); return; }

    // Recalculate store average after deletion
    if (deleted.providerId) {
      const result = await db
        .select({ avg: avg(ratingsTable.rating) })
        .from(ratingsTable)
        .where(and(eq(ratingsTable.providerId, deleted.providerId), eq(ratingsTable.isApproved, true)));
      const newAvg = result[0]?.avg;
      if (newAvg) {
        await db.update(serviceProvidersTable)
          .set({ rating: parseFloat(newAvg) })
          .where(eq(serviceProvidersTable.id, deleted.providerId));
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting review");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Keep old POST /ratings endpoint working (backward compat for provider-level)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ratings", async (req, res) => {
  const { orderId, providerId, rating, comment } = req.body;
  if (!providerId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ message: "providerId and rating (1-5) required" });
    return;
  }
  try {
    const [row] = await db.insert(ratingsTable).values({
      orderId, providerId, rating, comment,
      isApproved: true, isVerifiedBuyer: false,
    }).returning();
    const result = await db.select({ avg: avg(ratingsTable.rating) })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.providerId, providerId), eq(ratingsTable.isApproved, true)));
    const newAvg = result[0]?.avg;
    if (newAvg) {
      await db.update(serviceProvidersTable).set({ rating: parseFloat(newAvg) }).where(eq(serviceProvidersTable.id, providerId));
    }
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Keep old GET /ratings endpoint
router.get("/ratings", async (req, res) => {
  const { providerId } = req.query;
  try {
    let rows;
    if (providerId) {
      rows = await db.select().from(ratingsTable)
        .where(and(eq(ratingsTable.providerId, parseInt(providerId as string)), eq(ratingsTable.isApproved, true)));
    } else {
      rows = await db.select().from(ratingsTable)
        .where(eq(ratingsTable.isApproved, true))
        .orderBy(desc(ratingsTable.createdAt));
    }
    res.json(rows);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
