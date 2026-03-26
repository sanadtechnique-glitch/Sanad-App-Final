import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceProvidersTable } from "./serviceProviders";

export const orderStatusEnum = ["pending", "confirmed", "in_progress", "delivered", "cancelled"] as const;
export type OrderStatus = typeof orderStatusEnum[number];

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerAddress: text("customer_address").notNull(),
  notes: text("notes"),
  serviceType: text("service_type").notNull(),
  status: text("status").$type<OrderStatus>().default("pending").notNull(),
  serviceProviderId: integer("service_provider_id").references(() => serviceProvidersTable.id).notNull(),
  serviceProviderName: text("service_provider_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true, status: true, serviceProviderName: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
