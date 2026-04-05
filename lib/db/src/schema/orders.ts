import { pgTable, text, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceProvidersTable } from "./serviceProviders";

export const orderStatusEnum = ["searching_for_driver", "pending", "accepted", "prepared", "driver_accepted", "in_delivery", "delivered", "cancelled"] as const;
export type OrderStatus = typeof orderStatusEnum[number];

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address").notNull(),
  customerLat: real("customer_lat"),
  customerLng: real("customer_lng"),
  delegationId: integer("delegation_id"),
  notes: text("notes"),
  serviceType: text("service_type").notNull(),
  status: text("status").$type<OrderStatus>().default("pending").notNull(),
  serviceProviderId: integer("service_provider_id").references(() => serviceProvidersTable.id).notNull(),
  serviceProviderName: text("service_provider_name").notNull(),
  deliveryStaffId: integer("delivery_staff_id"),
  customerId: integer("customer_id"),
  deliveryFee: real("delivery_fee").default(0),
  distanceKm: real("distance_km"),
  etaMinutes: integer("eta_minutes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_orders_status").on(t.status),
  index("idx_orders_provider_id").on(t.serviceProviderId),
  index("idx_orders_customer_id").on(t.customerId),
  index("idx_orders_staff_id").on(t.deliveryStaffId),
  index("idx_orders_created_at").on(t.createdAt),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true, createdAt: true, updatedAt: true, status: true, serviceProviderName: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
