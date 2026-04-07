import { pgTable, text, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  articleId: integer("article_id"),
  nameAr: text("name_ar").notNull(),
  nameFr: text("name_fr").notNull().default(""),
  price: real("price").notNull().default(0),
  qty: integer("qty").notNull().default(1),
  subtotal: real("subtotal").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_order_items_order_id").on(t.orderId),
]);

export type OrderItem = typeof orderItemsTable.$inferSelect;
