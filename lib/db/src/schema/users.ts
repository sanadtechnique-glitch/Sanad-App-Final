import { pgTable, text, serial, boolean, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ROLES = ["super_admin", "manager", "provider", "driver", "customer"] as const;
export type AppRole = (typeof ROLES)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  role: text("role").notNull().default("customer"),
  password: text("password").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  linkedSupplierId: integer("linked_supplier_id"),
  linkedStaffId: integer("linked_staff_id"),
  dateOfBirth: date("date_of_birth"),
  defaultAddress: text("default_address"),
  googleId: text("google_id").unique(),
}, (t) => [
  index("idx_users_phone").on(t.phone),
  index("idx_users_role").on(t.role),
  index("idx_users_is_active").on(t.isActive),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRecord = typeof usersTable.$inferSelect;
