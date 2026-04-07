import { pgTable, text, serial, integer, boolean, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceCategoryEnum = ["restaurant", "pharmacy", "lawyer", "grocery", "mechanic", "doctor", "car", "hotel", "car_rental", "sos", "taxi"] as const;
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
  isActive: boolean("is_active").default(true).notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  // Taxi-specific fields (nullable for non-taxi providers)
  linkedUserId: integer("linked_user_id"),
  carModel: text("car_model"),
  carColor: text("car_color"),
  carPlate: text("car_plate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_providers_category").on(t.category),
  index("idx_providers_is_available").on(t.isAvailable),
  index("idx_providers_linked_user").on(t.linkedUserId),
]);

export const insertServiceProviderSchema = createInsertSchema(serviceProvidersTable).omit({ id: true, createdAt: true });
export type InsertServiceProvider = z.infer<typeof insertServiceProviderSchema>;
export type ServiceProvider = typeof serviceProvidersTable.$inferSelect;
