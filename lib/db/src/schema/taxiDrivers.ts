import { pgTable, serial, integer, text, boolean, real, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const taxiDriversTable = pgTable("taxi_drivers", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").references(() => usersTable.id).notNull().unique(),
  name:        text("name").notNull(),
  phone:       text("phone").notNull(),
  carModel:    text("car_model"),
  carColor:    text("car_color"),
  carPlate:    text("car_plate"),
  isAvailable: boolean("is_available").notNull().default(true),
  isActive:    boolean("is_active").notNull().default(true),
  lat:         real("lat"),
  lng:         real("lng"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_taxi_drivers_is_available").on(t.isAvailable),
  index("idx_taxi_drivers_is_active").on(t.isActive),
]);

export type TaxiDriver = typeof taxiDriversTable.$inferSelect;
