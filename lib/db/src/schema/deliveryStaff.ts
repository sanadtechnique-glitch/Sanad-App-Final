import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliveryStaffTable = pgTable("delivery_staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  phone: text("phone").notNull(),
  zone: text("zone"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDeliveryStaffSchema = createInsertSchema(deliveryStaffTable).omit({ id: true, createdAt: true });
export type InsertDeliveryStaff = z.infer<typeof insertDeliveryStaffSchema>;
export type DeliveryStaff = typeof deliveryStaffTable.$inferSelect;
