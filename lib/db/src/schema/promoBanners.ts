import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promoBannersTable = pgTable("promo_banners", {
  id: serial("id").primaryKey(),
  titleAr: text("title_ar").notNull(),
  titleFr: text("title_fr").notNull(),
  imageUrl: text("image_url"),
  link: text("link"),
  bgColor: text("bg_color").default("#D4AF37"),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPromoBannerSchema = createInsertSchema(promoBannersTable).omit({ id: true, createdAt: true });
export type InsertPromoBanner = z.infer<typeof insertPromoBannerSchema>;
export type PromoBanner = typeof promoBannersTable.$inferSelect;
