import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type VendorMessageType = "chat" | "info" | "warning" | "success";

export const vendorMessagesTable = pgTable("vendor_messages", {
  id:         serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  senderRole: text("sender_role").$type<"admin" | "vendor">().notNull(),
  type:       text("type").$type<VendorMessageType>().notNull().default("chat"),
  title:      text("title"),
  body:       text("body").notNull(),
  isRead:     boolean("is_read").default(false).notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_vendor_messages_supplier").on(t.supplierId),
  index("idx_vendor_messages_read").on(t.isRead),
]);

export const insertVendorMessageSchema = createInsertSchema(vendorMessagesTable).omit({
  id: true, createdAt: true, isRead: true,
});
export type InsertVendorMessage = z.infer<typeof insertVendorMessageSchema>;
export type VendorMessage = typeof vendorMessagesTable.$inferSelect;
