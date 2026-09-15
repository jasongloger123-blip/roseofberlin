import { editOrder, requestPayment, transitionOrder } from "../../../../../lib/orders/service";
import { getOrder, getItems, getEvents } from "../../../../../lib/orders/repository";
import { sendOrderEmails } from "../../../../../lib/orders/mail";
import { errorResponse, json, readJson, requireAdmin, sameOrigin } from "../../../../../lib/orders/http";
import { OrderError } from "../../../../../lib/orders/domain";
import { orderDatabase } from "../../../../../lib/orders/runtime";
import { paymentPath } from "../../../../../lib/orders/templates";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function detail(id: string) {
  const [order, events, items] = await Promise.all([getOrder(id), getEvents(id), getItems(id)]);
  const attempts = (await orderDatabase().prepare(`SELECT a.* FROM order_email_attempts a JOIN order_email_events e ON e.id=a.event_id WHERE e.order_id=? ORDER BY a.created_at DESC LIMIT 100`).bind(id).all()).results;
  // Payment bank data stays in the server-rendered customer document and emails.
  const { payment_snapshot: _snapshot, public_token: token, request_hash: _hash, idempotency_key: _key, mutation_id: _mutation, ...safe } = order;
  void _snapshot; void _hash; void _key; void _mutation;
  return { order: safe, items, paymentPath: order.payment_snapshot ? paymentPath(token) : null,
    events: events.map(({ payload_json: _payload, lease_id: _lease, dedupe_key: _dedupe, ...event }) => { void _payload; void _lease; void _dedupe; return event; }), attempts };
}
export async function GET(request: Request, context: Context) {
  try { requireAdmin(request); return json(await detail((await context.params).id)); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    requireAdmin(request); sameOrigin(request);
    const { id } = await context.params, body = await readJson(request);
    if (body.action === "edit") await editOrder(id, body);
    else if (body.action === "payment") await requestPayment(id, body);
    else if (body.action === "status") await transitionOrder(id, body);
    else if (body.action === "retry_emails") await getOrder(id);
    else if (body.action === "reconcile_email") {
      // Only reconcile an uncertain old send after checking the provider manually.
      if (typeof body.eventId !== "string" || typeof body.providerId !== "string" || !body.providerId.trim() || body.providerId.length > 100) throw new OrderError("invalid_input");
      await orderDatabase().prepare(`UPDATE order_email_events SET status='sent',provider_id=?,sent_at=?,error_code=NULL WHERE id=? AND order_id=? AND status='manual_review'`)
        .bind(body.providerId.trim(), new Date().toISOString(), body.eventId, id).run();
    } else if (body.action === "reconcile_not_sent") {
      if (typeof body.eventId !== "string") throw new OrderError("invalid_input");
      await orderDatabase().prepare(`UPDATE order_email_events SET status='pending',dedupe_key=?,first_attempt_at=NULL,error_code=NULL
        WHERE id=? AND order_id=? AND status='manual_review'`).bind(`${id}/reconciled/${crypto.randomUUID()}`, body.eventId, id).run();
    } else throw new OrderError("invalid_action");
    try { await sendOrderEmails(id); } catch { console.error("[orders] mail_queue_pending"); }
    return json(await detail(id));
  } catch (error) { return errorResponse(error); }
}
