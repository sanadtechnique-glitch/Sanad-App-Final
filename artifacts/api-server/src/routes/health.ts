import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  usersTable, serviceProvidersTable, articlesTable,
  ordersTable, promoBannersTable, adsTable,
  deliveryStaffTable, broadcastsTable, ratingsTable,
} from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /api/admin/db-stats — live row counts from PostgreSQL
router.get("/admin/db-stats", async (_req, res) => {
  try {
    const [
      usersCount,
      providersCount,
      articlesCount,
      ordersCount,
      bannersCount,
      adsCount,
      deliveryCount,
      broadcastsCount,
      ratingsCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(serviceProvidersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(articlesTable),
      db.select({ count: sql<number>`count(*)::int` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(promoBannersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(adsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(deliveryStaffTable),
      db.select({ count: sql<number>`count(*)::int` }).from(broadcastsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(ratingsTable),
    ]);

    res.json({
      database: "PostgreSQL",
      status: "connected",
      timestamp: new Date().toISOString(),
      tables: {
        users:          usersCount[0]?.count ?? 0,
        providers:      providersCount[0]?.count ?? 0,
        articles:       articlesCount[0]?.count ?? 0,
        orders:         ordersCount[0]?.count ?? 0,
        banners:        bannersCount[0]?.count ?? 0,
        ads:            adsCount[0]?.count ?? 0,
        delivery_staff: deliveryCount[0]?.count ?? 0,
        broadcasts:     broadcastsCount[0]?.count ?? 0,
        ratings:        ratingsCount[0]?.count ?? 0,
      },
    });
  } catch (err) {
    res.status(500).json({ database: "PostgreSQL", status: "error", error: String(err) });
  }
});

export default router;
