import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  usersTable, sessionsTable, serviceProvidersTable, articlesTable,
  ordersTable, orderItemsTable, ratingsTable, deliveryStaffTable,
  taxiDriversTable, taxiRequestsTable, hotelBookingsTable,
  sosRequestsTable, lawyerRequestsTable, broadcastsTable,
  adsTable, promoBannersTable, tickerAdsTable, partnerLogosTable,
  pushSubscriptionsTable, passwordResetTokensTable, vendorMessagesTable,
} from "@workspace/db/schema";
import { requireSuperAdmin } from "../lib/authMiddleware";
import { ne } from "drizzle-orm";

const router: IRouter = Router();

/**
 * POST /admin/reset-all-data
 * DEVELOPMENT ONLY — wipes all data except the current super_admin user.
 * Requires: super_admin role.
 */
router.post("/admin/reset-all-data", requireSuperAdmin, async (req, res) => {
  try {
    const currentSession = (req as any).authSession;
    const currentUserId: number = currentSession?.userId;

    // Delete in dependency order (children before parents, or use CASCADE)
    await db.delete(orderItemsTable);
    await db.delete(ordersTable);
    await db.delete(vendorMessagesTable);
    await db.delete(ratingsTable);
    await db.delete(articlesTable);
    await db.delete(hotelBookingsTable);
    await db.delete(taxiRequestsTable);
    await db.delete(taxiDriversTable);
    await db.delete(lawyerRequestsTable);
    await db.delete(sosRequestsTable);
    await db.delete(deliveryStaffTable);
    await db.delete(serviceProvidersTable);
    await db.delete(broadcastsTable);
    await db.delete(adsTable);
    await db.delete(promoBannersTable);
    await db.delete(tickerAdsTable);
    await db.delete(partnerLogosTable);
    await db.delete(pushSubscriptionsTable);
    await db.delete(passwordResetTokensTable);
    // Keep the current super_admin user; delete everyone else
    if (currentUserId) {
      await db.delete(usersTable).where(ne(usersTable.id, currentUserId));
    } else {
      await db.delete(usersTable).where(ne(usersTable.role, "super_admin"));
    }
    // Delete all sessions (forces logout everywhere)
    await db.delete(sessionsTable);

    res.json({ ok: true, message: "All data cleared. You have been logged out." });
  } catch (err) {
    req.log.error({ err }, "Error during data reset");
    res.status(500).json({ message: "Reset failed", error: String(err) });
  }
});

export default router;
