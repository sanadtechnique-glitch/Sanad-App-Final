import { pgTable, text, serial, boolean, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceProvidersTable } from "./serviceProviders";

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => serviceProvidersTable.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(),
  nameFr: text("name_fr").notNull(),
  descriptionAr: text("description_ar").notNull().default(""),
  descriptionFr: text("description_fr").notNull().default(""),
  price: real("price").notNull().default(0),
  originalPrice: real("original_price"),
  discountedPrice: real("discounted_price"),
  photoUrl: text("photo_url"),
  images: text("images"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true, createdAt: true });
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;
