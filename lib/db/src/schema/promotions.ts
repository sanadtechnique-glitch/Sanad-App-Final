import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { articlesTable } from "./articles";
import { serviceProvidersTable } from "./serviceProviders";

// ── Product categories that MAY have promotions ───────────────────────────────
// Service categories (hotel, car_rental, sos, lawyer, taxi) are EXCLUDED.
export const PROMO_ELIGIBLE_CATEGORIES = [
  "restaurant", "grocery", "vegetables", "pharmacy",
  "bakery", "butcher", "cafe", "sweets", "clothing",
] as const;
export type PromoEligibleCategory = typeof PROMO_ELIGIBLE_CATEGORIES[number];

export function isPromoEligibleCategory(cat: string): cat is PromoEligibleCategory {
  return (PROMO_ELIGIBLE_CATEGORIES as readonly string[]).includes(cat);
}

// ── Promotion types ───────────────────────────────────────────────────────────
// qty    → Buy N, get M free of the SAME article (e.g., 2+1)
// bundle → Buy article A, get article B free
export type PromotionType = "qty" | "bundle";

// ── promotions table ──────────────────────────────────────────────────────────
// DB-level enforcement:
//   • supplierId must reference a provider whose category is in PROMO_ELIGIBLE_CATEGORIES
//     — enforced at the application level on INSERT / UPDATE.
//   • getArticleId is required for "bundle" type, null for "qty" type.
//   • buyQty ≥ 1, getFreeQty ≥ 1.
export const promotionsTable = pgTable("promotions", {
  id:           serial("id").primaryKey(),
  supplierId:   integer("supplier_id").notNull().references(() => serviceProvidersTable.id, { onDelete: "cascade" }),
  type:         text("type").$type<PromotionType>().notNull().default("qty"),
  buyArticleId: integer("buy_article_id").notNull().references(() => articlesTable.id, { onDelete: "cascade" }),
  getArticleId: integer("get_article_id").references(() => articlesTable.id, { onDelete: "set null" }),
  buyQty:       integer("buy_qty").notNull().default(2),
  getFreeQty:   integer("get_free_qty").notNull().default(1),
  labelAr:      text("label_ar").notNull().default(""),
  labelFr:      text("label_fr").notNull().default(""),
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_promotions_supplier").on(t.supplierId),
  index("idx_promotions_active").on(t.isActive),
]);

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({
  id: true, createdAt: true,
});
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotionsTable.$inferSelect;
