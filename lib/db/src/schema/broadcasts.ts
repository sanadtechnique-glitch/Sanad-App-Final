import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  targetRole: text("target_role").default("all").notNull(),
  createdBy: text("created_by").default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Broadcast = typeof broadcastsTable.$inferSelect;
export type InsertBroadcast = typeof broadcastsTable.$inferInsert;
