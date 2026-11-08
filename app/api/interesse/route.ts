import { createOrder } from "../../../lib/orders/service";
import { sendOrderEmails } from "../../../lib/orders/mail";
import { errorResponse, json, rateLimit, readJson, sameOrigin } from "../../../lib/orders/http";
import { emailDomainSuggestion, idempotencyKey, OrderError, parseOrder } from "../../../lib/orders/domain";
import { orderDatabase } from "../../../lib/orders/runtime";

export const runtime = "nodejs";

// The public site is deployed on Vercel while the order worker owns the D1
// database. Keep the database boundary in one place and forward the browser
// request to the published worker when this route runs on Vercel.
const ORDER_BACKEND_ORIGIN = (process.env.ORDER_BACKEND_URL || "https://selesitina-rosenparfum.jasooon-san.chatgpt.site").replace(/\/$/, "");

async function forwardToOrderWorker(request: Request, input: Record<string, unknown>) {
  const headers = new Headers(request.headers);
  headers.set("origin", ORDER_BACKEND_ORIGIN);
  headers.delete("host");
  headers.delete("content-length");
  return fetch(`${ORDER_BACKEND_ORIGIN}/api/interesse`, { method: "POST", headers, body: JSON.stringify(input) });
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await readJson(request);
    if (input.website) return json({ ok: true }, 201);
    if (typeof input.email === "string" && emailDomainSuggestion(input.email)) throw new OrderError("email_domain_typo");
    if (process.env.VERCEL === "1") return await forwardToOrderWorker(request, input);
    const parsed = parseOrder(input), key = idempotencyKey(request.headers.get("Idempotency-Key"));
    // Valid retries must not be throttled after a successful write.
    const existing = await orderDatabase().prepare("SELECT id FROM orders WHERE idempotency_key=?").bind(key).first();
    if (!existing) await rateLimit(request, parsed.email);
    const { order, duplicate } = await createOrder(input, key);
    try { await sendOrderEmails(order.id); } catch { console.error("[orders] mail_queue_pending"); }
    return json({ ok: true, orderNumber: order.order_number, duplicate }, duplicate ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}
