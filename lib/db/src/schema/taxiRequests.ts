import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { taxiDriversTable } from "./taxiDrivers";

export const taxiStatusEnum = [
  "searching",    // looking for a driver
  "pending",      // waiting for driver response
  "accepted",     // driver accepted, ETA set
  "in_progress",  // ride ongoing
  "completed",    // ride done
  "cancelled",    // no driver found or customer cancelled
] as const;
export type TaxiStatus = typeof taxiStatusEnum[number];

export const taxiCommissionEnum = ["meter", "fixed"] as const;
export type TaxiCommission = typeof taxiCommissionEnum[number];

export const taxiRequestsTable = pgTable("taxi_requests", {
  id:                 serial("id").primaryKey(),
  customerId:         integer("customer_id").references(() => usersTable.id),
  customerName:       text("customer_name").notNull(),
  customerPhone:      text("customer_phone"),
  pickupAddress:      text("pickup_address").notNull(),
  pickupLat:          real("pickup_lat"),
  pickupLng:          real("pickup_lng"),
  dropoffAddress:     text("dropoff_address"),
  notes:              text("notes"),
  commissionType:     text("commission_type").$type<TaxiCommission>().notNull().default("meter"),
  fixedAmount:        real("fixed_amount"),
  status:             text("status").$type<TaxiStatus>().notNull().default("searching"),
  assignedDriverId:   integer("assigned_driver_id").references(() => taxiDriversTable.id),
  etaMinutes:         integer("eta_minutes"),
  rejectedDriverIds:  text("rejected_driver_ids").default(""),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});

export type TaxiRequest = typeof taxiRequestsTable.$inferSelect;
