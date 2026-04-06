import { pgTable, text, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sosStatusEnum    = ["pending", "offered", "accepted", "done", "cancelled"] as const;
export type SosStatus         = typeof sosStatusEnum[number];

export const sosCategoryEnum  = ["mechanic", "doctor", "emergency", "other"] as const;
export type SosCategory       = typeof sosCategoryEnum[number];

export const sosRequestsTable = pgTable("sos_requests", {
  id:                   serial("id").primaryKey(),
  customerId:           integer("customer_id"),
  customerName:         text("customer_name").notNull(),
  customerPhone:        text("customer_phone").notNull(),
  lat:                  real("lat").notNull(),
  lng:                  real("lng").notNull(),
  description:          text("description").default(""),
  category:             text("category").$type<SosCategory>().default("other").notNull(),
  status:               text("status").$type<SosStatus>().default("pending").notNull(),
  offeredPrice:         real("offered_price"),
  assignedProviderId:   integer("assigned_provider_id"),
  assignedProviderName: text("assigned_provider_name"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_sos_requests_status").on(t.status),
  index("idx_sos_requests_provider_id").on(t.assignedProviderId),
]);

export const insertSosRequestSchema = createInsertSchema(sosRequestsTable).omit({
  id: true, createdAt: true, updatedAt: true,
  status: true, assignedProviderId: true, assignedProviderName: true, offeredPrice: true,
});
export type InsertSosRequest = z.infer<typeof insertSosRequestSchema>;
export type SosRequest       = typeof sosRequestsTable.$inferSelect;
