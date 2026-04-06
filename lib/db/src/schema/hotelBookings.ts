import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceProvidersTable } from "./serviceProviders";

export const hotelBookingStatusEnum = ["pending", "confirmed", "rejected", "cancelled"] as const;
export type HotelBookingStatus = typeof hotelBookingStatusEnum[number];

export const hotelBookingsTable = pgTable("hotel_bookings", {
  id: serial("id").primaryKey(),
  hotelId: integer("hotel_id").references(() => serviceProvidersTable.id, { onDelete: "cascade" }).notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  guests: integer("guests").notNull().default(1),
  notes: text("notes"),
  // JSON: [{roomId, nameAr, nameFr, qty, pricePerNight, photoUrl}]
  selectedRooms: text("selected_rooms"),
  totalPrice: real("total_price"),
  status: text("status").$type<HotelBookingStatus>().default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHotelBookingSchema = createInsertSchema(hotelBookingsTable).omit({ id: true, createdAt: true, status: true });
export type InsertHotelBooking = z.infer<typeof insertHotelBookingSchema>;
export type HotelBooking = typeof hotelBookingsTable.$inferSelect;
