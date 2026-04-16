import { pgTable, serial, integer, real, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { serviceProvidersTable } from "./serviceProviders";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "cascade" }),
  providerId: integer("provider_id").references(() => serviceProvidersTable.id, { onDelete: "cascade" }),
  articleId: integer("article_id"),
  userId: integer("user_id"),
  reviewerName: text("reviewer_name"),
  rating: real("rating").notNull(),
  comment: text("comment"),
  isVerifiedBuyer: boolean("is_verified_buyer").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_ratings_article_id").on(t.articleId),
  index("idx_ratings_is_approved").on(t.isApproved),
  index("idx_ratings_user_article").on(t.userId, t.articleId),
]);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
