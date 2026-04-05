import { pgTable, text, serial, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceProvidersTable } from "./serviceProviders";

export const carRentalStatusEnum = ["pending", "confirmed", "rejected", "active", "completed", "cancelled"] as const;
export type CarRentalStatus = typeof carRentalStatusEnum[number];

export const carsTable = pgTable("cars", {
  id:           serial("id").primaryKey(),
  agencyId:     integer("agency_id").references(() => serviceProvidersTable.id).notNull(),
  make:         text("make").notNull(),
  model:        text("model").notNull(),
  year:         integer("year"),
  color:        text("color").default(""),
  pricePerDay:  real("price_per_day").notNull(),
  seats:        integer("seats").default(5),
  transmission: text("transmission").default("manual"),
  fuelType:     text("fuel_type").default("essence"),
  imageUrl:     text("image_url"),
  isAvailable:  boolean("is_available").default(true).notNull(),
  description:  text("description").default(""),
  descriptionAr: text("description_ar").default(""),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const carRentalBookingsTable = pgTable("car_rental_bookings", {
  id:           serial("id").primaryKey(),
  customerId:   integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  carId:        integer("car_id").references(() => carsTable.id).notNull(),
  agencyId:     integer("agency_id").references(() => serviceProvidersTable.id).notNull(),
  startDate:    text("start_date").notNull(),
  endDate:      text("end_date").notNull(),
  durationDays: integer("duration_days").notNull(),
  totalPrice:   real("total_price").notNull(),
  status:       text("status").$type<CarRentalStatus>().default("pending").notNull(),
  notes:        text("notes"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const insertCarSchema = createInsertSchema(carsTable).omit({ id: true, createdAt: true });
export type InsertCar = z.infer<typeof insertCarSchema>;
export type Car = typeof carsTable.$inferSelect;

export const insertCarRentalBookingSchema = createInsertSchema(carRentalBookingsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertCarRentalBooking = z.infer<typeof insertCarRentalBookingSchema>;
export type CarRentalBooking = typeof carRentalBookingsTable.$inferSelect;
