import type { Order, OrderItem, EmailEvent } from "../../db/schema";
import { orderDatabase } from "./runtime";
import { OrderError } from "./domain";
export async function getOrder(id: string): Promise<Order> {
  const order = await orderDatabase().prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Order>();
  if (!order) throw new OrderError("order_not_found", 404);
  return order;
}
export async function getItems(id: string): Promise<OrderItem[]> {
  return (await orderDatabase().prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").bind(id).all<OrderItem>()).results;
}
export async function getEvents(id: string): Promise<EmailEvent[]> {
  return (await orderDatabase().prepare("SELECT * FROM order_email_events WHERE order_id = ? ORDER BY created_at, id").bind(id).all<EmailEvent>()).results;
}
