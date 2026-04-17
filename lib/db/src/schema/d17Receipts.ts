import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { serviceProvidersTable } from "./serviceProviders";

export type D17ReceiptStatus = "pending" | "approved" | "rejected" | "manual_review";

export const d17ReceiptsTable = pgTable("d17_receipts", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => serviceProvidersTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  transactionId: text("transaction_id"),
  amount: real("amount"),
  receiptDate: text("receipt_date"),
  extractedText: text("extracted_text"),
  status: text("status").$type<D17ReceiptStatus>().notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type D17Receipt = typeof d17ReceiptsTable.$inferSelect;
