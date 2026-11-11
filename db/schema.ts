import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const purchaseInterests = sqliteTable("purchase_interests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  product: text("product").notNull(),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  notificationStatus: text("notification_status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Durable orders. Existing purchase_interests records remain untouched.
export const orders = sqliteTable("orders", {
  sequence: integer("sequence").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  order_number: text("order_number").unique(),
  idempotency_key: text("idempotency_key").notNull().unique(),
  request_hash: text("request_hash").notNull(),
  public_token: text("public_token").notNull().unique(),
  customer_name: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address_line1: text("address_line1").notNull(),
  address_line2: text("address_line2"),
  postal_code: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  language: text("language", { enum: ["de", "en"] }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  subtotal_cents: integer("subtotal_cents").notNull(),
  shipping_cents: integer("shipping_cents"),
  total_cents: integer("total_cents"),
  status: text("status", { enum: ["received", "needs_review", "awaiting_payment", "paid", "processing", "shipped", "cancelled"] }).notNull().default("received"),
  availability_confirmed: integer("availability_confirmed").notNull().default(0),
  seller_note: text("seller_note").notNull().default(""),
  tracking_number: text("tracking_number"),
  payment_revision: integer("payment_revision").notNull().default(0),
  payment_snapshot: text("payment_snapshot"),
  payment_requested_at: text("payment_requested_at"),
  paid_at: text("paid_at"),
  shipped_at: text("shipped_at"),
  source: text("source").notNull().default("website"),
  version: integer("version").notNull().default(1),
  mutation_id: text("mutation_id"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
}, table => [index("orders_status_sequence_idx").on(table.status, table.sequence)]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  order_id: text("order_id").notNull().references(() => orders.id),
  product_key: text("product_key").notNull(),
  product_label: text("product_label").notNull(),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull(),
  unit_price_cents: integer("unit_price_cents").notNull(),
  line_total_cents: integer("line_total_cents").notNull(),
}, table => [index("order_items_order_id_idx").on(table.order_id)]);

export const orderEmailEvents = sqliteTable("order_email_events", {
  id: text("id").primaryKey(),
  order_id: text("order_id").notNull().references(() => orders.id),
  kind: text("kind", { enum: ["received", "internal", "payment", "paid", "shipped", "invoice"] }).notNull(),
  revision: integer("revision").notNull().default(0),
  dedupe_key: text("dedupe_key").notNull().unique(),
  status: text("status", { enum: ["pending", "sending", "sent", "failed", "manual_review", "cancelled"] }).notNull().default("pending"),
  payload_json: text("payload_json"),
  attempts: integer("attempts").notNull().default(0),
  first_attempt_at: text("first_attempt_at"),
  last_attempt_at: text("last_attempt_at"),
  lease_id: text("lease_id"),
  lease_until: text("lease_until"),
  provider_id: text("provider_id"),
  error_code: text("error_code"),
  sent_at: text("sent_at"),
  created_at: text("created_at").notNull(),
}, table => [index("order_email_events_order_id_idx").on(table.order_id)]);

export const orderEmailAttempts = sqliteTable("order_email_attempts", {
  id: text("id").primaryKey(),
  event_id: text("event_id").notNull().references(() => orderEmailEvents.id),
  outcome: text("outcome").notNull(),
  error_code: text("error_code"),
  created_at: text("created_at").notNull(),
}, table => [index("order_email_attempts_event_id_idx").on(table.event_id)]);

export const orderRateLimits = sqliteTable("order_rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expires_at: integer("expires_at").notNull(),
});

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type EmailEvent = typeof orderEmailEvents.$inferSelect;

export const invoiceSettings = sqliteTable("invoice_settings", {
  id: integer("id").primaryKey(), version: integer("version").notNull(), payload: text("payload").notNull(),
}, table => [check("invoice_settings_singleton", sql`${table.id}=1`)]);
export const invoices = sqliteTable("invoices", {
  sequence: integer("sequence").primaryKey({ autoIncrement:true }), id:text("id").notNull().unique(),
  number:text("number").unique(), order_id:text("order_id").notNull().references(()=>orders.id), token:text("token").notNull().unique(),
  snapshot:text("snapshot").notNull(), issued_at:text("issued_at").notNull(), issued_by:text("issued_by").notNull(),
  cancelled_at:text("cancelled_at"), cancelled_by:text("cancelled_by"), cancellation_reason:text("cancellation_reason"),
}, table => [uniqueIndex("invoices_one_active_per_order").on(table.order_id).where(sql`${table.cancelled_at} IS NULL`)]);
export const invoiceArchive=sqliteTable("invoice_archive", {
  id:text("id").primaryKey(), fingerprint:text("fingerprint").notNull().unique(), label:text("label").notNull(),
  content:text("content").notNull(), imported_at:text("imported_at").notNull(), imported_by:text("imported_by").notNull(),
});
