import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  username: text("username").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_sessions_user_id").on(t.userId),
  index("idx_sessions_expires_at").on(t.expiresAt),
]);

export type Session = typeof sessionsTable.$inferSelect;
