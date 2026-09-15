import { createOrder } from "../../../lib/orders/service";
import { sendOrderEmails } from "../../../lib/orders/mail";
import { errorResponse, json, rateLimit, readJson, sameOrigin } from "../../../lib/orders/http";
import { idempotencyKey, parseOrder } from "../../../lib/orders/domain";
import { orderDatabase } from "../../../lib/orders/runtime";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await readJson(request);
    if (input.website) return json({ ok: true }, 201);
    const parsed = parseOrder(input), key = idempotencyKey(request.headers.get("Idempotency-Key"));
    // Valid retries must not be throttled after a successful write.
    const existing = await orderDatabase().prepare("SELECT id FROM orders WHERE idempotency_key=?").bind(key).first();
    if (!existing) await rateLimit(request, parsed.email);
    const { order, duplicate } = await createOrder(input, key);
    try { await sendOrderEmails(order.id); } catch { console.error("[orders] mail_queue_pending"); }
    return json({ ok: true, orderNumber: order.order_number, duplicate }, duplicate ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}
