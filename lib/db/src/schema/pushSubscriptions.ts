import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_push_subs_user_id").on(t.userId),
]);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
