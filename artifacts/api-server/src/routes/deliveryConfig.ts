import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deliveryConfigTable } from "@workspace/db/schema";
import { requireAdmin } from "../lib/authMiddleware";
import { invalidateConfigCache } from "../lib/distance";
import { getAutoContext, calcAutoFee } from "../lib/auto-pricing";

const router: IRouter = Router();

// GET /delivery-config — public (customer/order page needs it for preview)
router.get("/delivery-config", async (req, res) => {
  try {
    const rows = await db.select().from(deliveryConfigTable).limit(1);
    if (rows.length === 0) {
      await db
        .insert(deliveryConfigTable)
        .values({ id: 1 })
        .onConflictDoNothing();
      const [seeded] = await db.select().from(deliveryConfigTable).limit(1);
      res.json(seeded);
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    req.log?.error({ err }, "Error fetching delivery config");
    res.status(500).json({ message: "Server error" });
  }
});

// GET /auto-context — real-time pricing context (public)
router.get("/auto-context", async (req, res) => {
  try {
    const [cfg] = await db.select().from(deliveryConfigTable).limit(1);
    const ctx  = getAutoContext();
    const demo = calcAutoFee(3, new Date(), cfg ? { baseFee: cfg.baseFee, minFee: cfg.minFee, ratePerKm: cfg.ratePerKm } : undefined);
    res.json({ context: ctx, demo });
  } catch (err) {
    req.log?.error({ err }, "Error fetching auto-context");
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /admin/delivery-config — admin only
router.patch("/admin/delivery-config", requireAdmin, async (req, res) => {
  try {
    const {
      baseFee,
      ratePerKm,
      minFee,
      maxFee,
      nightSurchargePercent,
      nightStartHour,
      nightEndHour,
      platformCommissionPercent,
      prepTimeMinutes,
      avgSpeedKmPerMin,
      expressEnabled,
      expressSurchargeTnd,
      fixedFeeEnabled,
      fixedFeeTnd,
    } = req.body;
    console.log("وصل طلب تحديث! السعر الجديد هو:", baseFee);
    // -------------------------------

    const updates: Record<string, unknown> = {};
    if (baseFee !== undefined) updates.baseFee = Number(baseFee);
    if (ratePerKm !== undefined) updates.ratePerKm = Number(ratePerKm);
    if (minFee !== undefined) updates.minFee = Number(minFee);
    if (maxFee !== undefined)
      updates.maxFee = maxFee === null || maxFee === "" ? null : Number(maxFee);
    if (nightSurchargePercent !== undefined)
      updates.nightSurchargePercent = Number(nightSurchargePercent);
    if (nightStartHour !== undefined)
      updates.nightStartHour = Number(nightStartHour);
    if (nightEndHour !== undefined) updates.nightEndHour = Number(nightEndHour);
    if (platformCommissionPercent !== undefined)
      updates.platformCommissionPercent = Number(platformCommissionPercent);
    if (prepTimeMinutes !== undefined)
      updates.prepTimeMinutes = Number(prepTimeMinutes);
    if (avgSpeedKmPerMin !== undefined)
      updates.avgSpeedKmPerMin = Number(avgSpeedKmPerMin);
    if (expressEnabled !== undefined)
      updates.expressEnabled = Boolean(expressEnabled);
    if (expressSurchargeTnd !== undefined)
      updates.expressSurchargeTnd = Number(expressSurchargeTnd);
    if (fixedFeeEnabled !== undefined)
      updates.fixedFeeEnabled = Boolean(fixedFeeEnabled);
    if (fixedFeeTnd !== undefined) updates.fixedFeeTnd = Number(fixedFeeTnd);
    if (req.body.autoModeEnabled !== undefined)
      updates.autoModeEnabled = Boolean(req.body.autoModeEnabled);
    updates.updatedAt = new Date();

    // Upsert: ensure row id=1 exists
    await db
      .insert(deliveryConfigTable)
      .values({ id: 1 })
      .onConflictDoNothing();
    const { eq } = await import("drizzle-orm");
    const [updated] = await db
      .update(deliveryConfigTable)
      .set(updates)
      .where(eq(deliveryConfigTable.id, 1))
      .returning();

    invalidateConfigCache();
    res.json(updated);
  } catch (err) {
    req.log?.error({ err }, "Error updating delivery config");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
