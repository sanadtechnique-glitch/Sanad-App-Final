import { pgTable, text, serial, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceCategoryEnum = ["restaurant", "pharmacy", "lawyer", "grocery", "mechanic", "doctor", "car", "hotel"] as const;
export type ServiceCategory = typeof serviceCategoryEnum[number];

export const pharmacyShiftEnum = ["day", "night", "all"] as const;
export type PharmacyShift = typeof pharmacyShiftEnum[number];

export const serviceProvidersTable = pgTable("service_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  category: text("category").$type<ServiceCategory>().notNull(),
  description: text("description").notNull().default(""),
  descriptionAr: text("description_ar").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  shift: text("shift").$type<PharmacyShift>().default("all"),
  rating: real("rating").default(4.5),
  isAvailable: boolean("is_available").default(true).notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceProviderSchema = createInsertSchema(serviceProvidersTable).omit({ id: true, createdAt: true });
export type InsertServiceProvider = z.infer<typeof insertServiceProviderSchema>;
export type ServiceProvider = typeof serviceProvidersTable.$inferSelect;
