import { pgTable, text, serial, boolean, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tickerAdsTable = pgTable("ticker_ads", {
  id: serial("id").primaryKey(),
  textAr: text("text_ar").notNull(),
  textFr: text("text_fr"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  supplierId: integer("supplier_id"),
  bgColor: varchar("bg_color", { length: 30 }).default("#1A4D1F"),
  textColor: varchar("text_color", { length: 30 }).default("#FFFFFF"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTickerAdSchema = createInsertSchema(tickerAdsTable).omit({ id: true, createdAt: true });
export type InsertTickerAd = z.infer<typeof insertTickerAdSchema>;
export type TickerAd = typeof tickerAdsTable.$inferSelect;
