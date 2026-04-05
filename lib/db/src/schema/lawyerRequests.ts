import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lawyerRequestStatusEnum = ["pending", "accepted", "rejected"] as const;
export type LawyerRequestStatus = typeof lawyerRequestStatusEnum[number];

export const caseTypeEnum = [
  "criminal", "civil", "administrative", "commercial", "family", "real_estate", "other"
] as const;
export type CaseType = typeof caseTypeEnum[number];

export const lawyerRequestsTable = pgTable("lawyer_requests", {
  id:              serial("id").primaryKey(),
  customerId:      integer("customer_id"),
  customerName:    text("customer_name").notNull(),
  customerPhone:   text("customer_phone").notNull(),
  lawyerId:        integer("lawyer_id").notNull(),
  lawyerName:      text("lawyer_name").notNull(),
  caseType:        text("case_type").$type<CaseType>().notNull().default("other"),
  court:           text("court").notNull().default(""),
  photos:          text("photos").default("[]"),
  notes:           text("notes").default(""),
  status:          text("status").$type<LawyerRequestStatus>().notNull().default("pending"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_lawyer_requests_lawyer_id").on(t.lawyerId),
  index("idx_lawyer_requests_status").on(t.status),
  index("idx_lawyer_requests_customer_id").on(t.customerId),
]);

export const insertLawyerRequestSchema = createInsertSchema(lawyerRequestsTable).omit({
  id: true, createdAt: true, updatedAt: true, status: true,
});
export type InsertLawyerRequest = z.infer<typeof insertLawyerRequestSchema>;
export type LawyerRequest = typeof lawyerRequestsTable.$inferSelect;
