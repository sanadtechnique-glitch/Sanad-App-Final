import { pgTable, serial, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliveryConfigTable = pgTable("delivery_config", {
  id:                       serial("id").primaryKey(),
  baseFee:                  real("base_fee").notNull().default(2.0),
  ratePerKm:                real("rate_per_km").notNull().default(0.5),
  minFee:                   real("min_fee").notNull().default(2.0),
  maxFee:                   real("max_fee"),
  nightSurchargePercent:    integer("night_surcharge_percent").notNull().default(0),
  nightStartHour:           integer("night_start_hour").notNull().default(22),
  nightEndHour:             integer("night_end_hour").notNull().default(6),
  platformCommissionPercent:integer("platform_commission_percent").notNull().default(0),
  prepTimeMinutes:          integer("prep_time_minutes").notNull().default(15),
  avgSpeedKmPerMin:         real("avg_speed_km_per_min").notNull().default(0.5),
  expressEnabled:           boolean("express_enabled").notNull().default(false),
  expressSurchargeTnd:      real("express_surcharge_tnd").notNull().default(1.0),
  fixedFeeEnabled:          boolean("fixed_fee_enabled").notNull().default(false),
  fixedFeeTnd:              real("fixed_fee_tnd").notNull().default(5.0),
  updatedAt:                timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeliveryConfigSchema = createInsertSchema(deliveryConfigTable).omit({ id: true, updatedAt: true });
export type InsertDeliveryConfig = z.infer<typeof insertDeliveryConfigSchema>;
export type DeliveryConfig = typeof deliveryConfigTable.$inferSelect;
