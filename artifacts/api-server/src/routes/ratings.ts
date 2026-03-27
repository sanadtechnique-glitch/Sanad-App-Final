import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ratingsTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, avg } from "drizzle-orm";

const router: IRouter = Router();

router.post("/ratings", async (req, res) => {
  const { orderId, providerId, rating, comment } = req.body;
  if (!providerId || !rating || rating < 1 || rating > 5) {
    res.status(400).json({ message: "providerId and rating (1-5) required" });
    return;
  }
  try {
    const [row] = await db.insert(ratingsTable).values({ orderId, providerId, rating, comment }).returning();
    // Update provider's average rating
    const result = await db.select({ avg: avg(ratingsTable.rating) }).from(ratingsTable).where(eq(ratingsTable.providerId, providerId));
    const newAvg = result[0]?.avg;
    if (newAvg) {
      await db.update(serviceProvidersTable).set({ rating: parseFloat(newAvg) }).where(eq(serviceProvidersTable.id, providerId));
    }
    res.status(201).json(row);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

router.get("/ratings", async (req, res) => {
  const { providerId } = req.query;
  try {
    let rows;
    if (providerId) {
      rows = await db.select().from(ratingsTable).where(eq(ratingsTable.providerId, parseInt(providerId as string)));
    } else {
      rows = await db.select().from(ratingsTable).orderBy(ratingsTable.createdAt);
    }
    res.json(rows);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
