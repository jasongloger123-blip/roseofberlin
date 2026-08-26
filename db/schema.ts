import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
