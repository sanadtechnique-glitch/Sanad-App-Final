import { pgTable, text, serial, integer, real, timestamp, boolean, index } from "drizzle-orm/pg-core";
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
  plateNumber:  text("plate_number").default(""),        // رقم اللوحة المنجمية مثال: 123 TU 4567
  pricePerDay:  real("price_per_day").notNull(),
  seats:        integer("seats").default(5),
  transmission: text("transmission").default("manual"),
  fuelType:     text("fuel_type").default("essence"),
  imageUrl:     text("image_url"),
  isAvailable:  boolean("is_available").default(true).notNull(),
  description:  text("description").default(""),
  descriptionAr: text("description_ar").default(""),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_cars_agency_id").on(t.agencyId),
  index("idx_cars_is_available").on(t.isAvailable),
]);

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
}, (t) => [
  index("idx_car_bookings_status").on(t.status),
  index("idx_car_bookings_agency_id").on(t.agencyId),
  index("idx_car_bookings_car_id").on(t.carId),
]);

export const insertCarSchema = createInsertSchema(carsTable).omit({ id: true, createdAt: true });
export type InsertCar = z.infer<typeof insertCarSchema>;
export type Car = typeof carsTable.$inferSelect;

export const insertCarRentalBookingSchema = createInsertSchema(carRentalBookingsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertCarRentalBooking = z.infer<typeof insertCarRentalBookingSchema>;
export type CarRentalBooking = typeof carRentalBookingsTable.$inferSelect;
