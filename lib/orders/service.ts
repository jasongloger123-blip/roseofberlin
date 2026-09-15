import type { Order, EmailEvent } from "../../db/schema";
import { assertTransition, hash, idempotencyKey, OrderError, parseOrder, record, secureToken, shippingCents, statuses, type OrderStatus } from "./domain";
import { orderDatabase, publicBaseUrl } from "./runtime";
import { getOrder, getItems, getEvents } from "./repository";
import { emailPayload, paymentDetails } from "./templates";

export async function createOrder(input: unknown, key: string | null) {
  const parsed = parseOrder(input), token = idempotencyKey(key);
  const fingerprint = await hash(JSON.stringify(parsed)), db = orderDatabase();
  const previous = await db.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(token).first<Order>();
  if (previous) {
    if (previous.request_hash !== fingerprint) throw new OrderError("idempotency_conflict", 409);
    return { order: previous, duplicate: true };
  }
  const id = crypto.randomUUID(), now = new Date().toISOString(), year = new Date().getUTCFullYear();
  await db.batch([
    db.prepare(`INSERT INTO orders (id,idempotency_key,request_hash,public_token,customer_name,email,phone,address_line1,address_line2,postal_code,city,country,language,subtotal_cents,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`).bind(
      id, token, fingerprint, secureToken(), parsed.customerName, parsed.email, parsed.phone || null, parsed.addressLine1, parsed.addressLine2 || null, parsed.postalCode, parsed.city, parsed.country, parsed.language, parsed.subtotalCents, now, now),
    db.prepare("UPDATE orders SET order_number = 'ROB-' || ? || '-' || printf('%06d', sequence) WHERE id=?").bind(String(year), id),
    db.prepare(`INSERT INTO order_items (id,order_id,product_key,product_label,size,quantity,unit_price_cents,line_total_cents)
      SELECT ?,id,?,?,?,?,?,? FROM orders WHERE id=?`).bind(crypto.randomUUID(), parsed.product, parsed.productLabel, parsed.size, parsed.quantity, parsed.unitPriceCents, parsed.subtotalCents, id),
    ...(["received", "internal"] as const).map(kind => db.prepare(`INSERT INTO order_email_events (id,order_id,kind,dedupe_key,created_at) SELECT ?,id,?,?,? FROM orders WHERE id=?`)
      .bind(crypto.randomUUID(), kind, `${id}/${kind}`, now, id)),
  ]);
  const saved = await db.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(token).first<Order>();
  if (!saved || saved.request_hash !== fingerprint) throw new OrderError("idempotency_conflict", 409);
  return { order: saved, duplicate: saved.id !== id };
}

export async function editOrder(id: string, input: unknown) {
  const data = record(input), db = orderDatabase(), order = await getOrder(id);
  if (data.version !== order.version) throw new OrderError("stale_order", 409);
  const shipping = shippingCents(data.shippingCents);
  if (typeof data.availabilityConfirmed !== "boolean" || typeof data.sellerNote !== "string" || data.sellerNote.length > 4000) throw new OrderError("invalid_input");
  const changeTerms = shipping !== order.shipping_cents || Number(data.availabilityConfirmed) !== order.availability_confirmed;
  if (changeTerms && !["received", "needs_review", "awaiting_payment"].includes(order.status)) throw new OrderError("terms_locked", 409);
  const invalidatesPayment = changeTerms && order.status === "awaiting_payment";
  const now = new Date().toISOString(), mutation = crypto.randomUUID();
  // Block changes while a payment email is in flight (including expired, uncertain leases).
  const noMailInFlight = "NOT EXISTS (SELECT 1 FROM order_email_events WHERE order_id=orders.id AND kind='payment' AND status IN ('sending','manual_review'))";
  await db.batch([
    db.prepare(`UPDATE orders SET shipping_cents=?,total_cents=?,availability_confirmed=?,seller_note=?,updated_at=?,version=version+1,mutation_id=?,
      status=?,public_token=?,payment_snapshot=?,payment_requested_at=? WHERE id=? AND version=? ${changeTerms ? `AND ${noMailInFlight}` : ""}`)
      .bind(shipping, shipping === null ? null : order.subtotal_cents + shipping, Number(data.availabilityConfirmed), data.sellerNote.trim(), now, mutation,
        invalidatesPayment || order.status === "received" ? "needs_review" : order.status,
        invalidatesPayment ? secureToken() : order.public_token, invalidatesPayment ? null : order.payment_snapshot, invalidatesPayment ? null : order.payment_requested_at, id, order.version),
    db.prepare(`UPDATE order_email_events SET status='cancelled' WHERE order_id=? AND kind='payment' AND status IN ('pending','failed')
      AND EXISTS (SELECT 1 FROM orders WHERE id=? AND mutation_id=? AND payment_snapshot IS NULL)`).bind(id, id, mutation),
  ]);
  const updated = await getOrder(id);
  if (updated.mutation_id !== mutation) throw new OrderError("stale_or_sending", 409);
  return updated;
}

export async function requestPayment(id: string, input: unknown) {
  const data = record(input), db = orderDatabase(), order = await getOrder(id);
  // Retrying this action never creates another payment revision or event.
  if (order.status === "awaiting_payment") return order;
  if (data.version !== order.version) throw new OrderError("stale_order", 409);
  if (!["received", "needs_review"].includes(order.status) || !order.availability_confirmed || order.shipping_cents === null) throw new OrderError("payment_not_ready", 409);
  const items = await getItems(id);
  if (!items.length || items.some(i => !Number.isSafeInteger(i.unit_price_cents) || i.unit_price_cents <= 0 || i.quantity < 1 || i.quantity > 5 || i.line_total_cents !== i.quantity * i.unit_price_cents)) throw new OrderError("invalid_order", 409);
  const subtotal = items.reduce((sum, i) => sum + i.line_total_cents, 0);
  if (subtotal !== order.subtotal_cents) throw new OrderError("invalid_order", 409);
  publicBaseUrl();
  const now = new Date().toISOString(), mutation = crypto.randomUUID(), revision = order.payment_revision + 1;
  const updated: Order = { ...order, total_cents: subtotal + order.shipping_cents, status: "awaiting_payment", payment_snapshot: JSON.stringify(paymentDetails()), payment_requested_at: now, payment_revision: revision };
  const eventId = crypto.randomUUID(), event = { kind: "payment" } as EmailEvent;
  // Freeze the exact content and payment details before committing the transition.
  const payload = JSON.stringify(emailPayload(event, updated, items));
  await db.batch([
    db.prepare(`UPDATE orders SET status='awaiting_payment',total_cents=?,payment_snapshot=?,payment_requested_at=?,payment_revision=?,updated_at=?,version=version+1,mutation_id=? WHERE id=? AND version=?`)
      .bind(updated.total_cents, updated.payment_snapshot, now, revision, now, mutation, id, order.version),
    db.prepare(`INSERT INTO order_email_events (id,order_id,kind,revision,dedupe_key,payload_json,created_at)
      SELECT ?,id,'payment',?,?,?,? FROM orders WHERE id=? AND mutation_id=?`)
      .bind(eventId, revision, `${id}/payment/${revision}`, payload, now, id, mutation),
  ]);
  const saved = await getOrder(id);
  if (saved.mutation_id !== mutation && saved.status !== "awaiting_payment") throw new OrderError("stale_order", 409);
  return saved;
}

export async function transitionOrder(id: string, input: unknown) {
  const data = record(input), db = orderDatabase(), order = await getOrder(id);
  if (typeof data.status !== "string" || !statuses.includes(data.status as OrderStatus)) throw new OrderError("invalid_status");
  const next = data.status as OrderStatus;
  if (order.status === next) return order;
  if (data.version !== order.version) throw new OrderError("stale_order", 409);
  assertTransition(order.status, next);
  if (next === "cancelled" && (await getEvents(id)).some(e => e.kind === "payment" && ["sending", "manual_review"].includes(e.status))) throw new OrderError("stale_or_sending", 409);
  const tracking = data.trackingNumber ?? order.tracking_number;
  if (tracking !== null && (typeof tracking !== "string" || tracking.length > 150 || /[\u0000-\u001f]/.test(tracking))) throw new OrderError("invalid_tracking");
  const now = new Date().toISOString(), mutation = crypto.randomUUID();
  const updated: Order = { ...order, status: next, paid_at: next === "paid" ? now : order.paid_at, shipped_at: next === "shipped" ? now : order.shipped_at, tracking_number: next === "shipped" ? tracking as string | null : order.tracking_number };
  const event = ["paid", "shipped"].includes(next) ? next as "paid" | "shipped" : null;
  // Outbox creation is independent of provider/env availability: a payment must remain recorded.
  let actualPayload: string | null = null;
  if (event) {
    try { actualPayload = JSON.stringify(emailPayload({ kind: event } as EmailEvent, updated, await getItems(id))); }
    catch { /* The durable event can be rendered on retry after configuration is repaired. */ }
  }
  await db.batch([
    db.prepare(`UPDATE orders SET status=?,paid_at=?,shipped_at=?,tracking_number=?,updated_at=?,version=version+1,mutation_id=? WHERE id=? AND version=?
      ${next === "cancelled" ? "AND NOT EXISTS (SELECT 1 FROM order_email_events WHERE order_id=orders.id AND kind='payment' AND status IN ('sending','manual_review'))" : ""}`)
      .bind(next, updated.paid_at, updated.shipped_at, updated.tracking_number, now, mutation, id, order.version),
    ...(event ? [db.prepare(`INSERT INTO order_email_events (id,order_id,kind,dedupe_key,payload_json,created_at)
      SELECT ?,id,?,?,?,? FROM orders WHERE id=? AND mutation_id=? ON CONFLICT(dedupe_key) DO NOTHING`)
      .bind(crypto.randomUUID(), event, `${id}/${event}`, actualPayload, now, id, mutation)] : []),
    ...(["cancelled", "paid"].includes(next) ? [db.prepare(`UPDATE order_email_events SET status='cancelled' WHERE order_id=? AND kind='payment' AND status IN ('pending','failed')
      AND EXISTS (SELECT 1 FROM orders WHERE id=? AND mutation_id=?)`).bind(id, id, mutation)] : []),
  ]);
  const saved = await getOrder(id);
  if (saved.mutation_id !== mutation && saved.status !== next) throw new OrderError("stale_order", 409);
  return saved;
}

export async function listOrders(status: string | null, before: number | null) {
  if (status && !statuses.includes(status as OrderStatus)) throw new OrderError("invalid_status");
  const result = await orderDatabase().prepare(`SELECT o.*, (SELECT count(*) FROM order_email_events e WHERE e.order_id=o.id AND e.status IN ('failed','manual_review','pending','sending')) AS email_attention
    FROM orders o WHERE (? IS NULL OR status=?) AND (? IS NULL OR sequence < ?) ORDER BY sequence DESC LIMIT 51`)
    .bind(status, status, before, before).all<Order & { email_attention: number }>();
  return { orders: result.results.slice(0, 50), next: result.results.length > 50 ? result.results[49].sequence : null };
}
