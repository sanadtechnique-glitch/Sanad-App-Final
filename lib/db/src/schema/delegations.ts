import { pgTable, text, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const delegationsTable = pgTable("delegations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  deliveryFee: real("delivery_fee").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDelegationSchema = createInsertSchema(delegationsTable).omit({ id: true, createdAt: true });
export type InsertDelegation = z.infer<typeof insertDelegationSchema>;
export type Delegation = typeof delegationsTable.$inferSelect;
