import { listOrders } from "../../../../lib/orders/service";
import { errorResponse, json, requireAdmin } from "../../../../lib/orders/http";
import { OrderError } from "../../../../lib/orders/domain";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const url = new URL(request.url), raw = url.searchParams.get("before"), before = raw === null ? null : Number(raw);
    if (before !== null && (!Number.isSafeInteger(before) || before < 1)) throw new OrderError("invalid_page");
    const result = await listOrders(url.searchParams.get("status"), before);
    // Do not serialize payment snapshots or idempotency credentials to the admin list.
    return json({ ...result, orders: result.orders.map(o => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name, country: o.country, subtotal_cents: o.subtotal_cents, shipping_cents: o.shipping_cents, total_cents: o.total_cents, status: o.status, created_at: o.created_at, email_attention: o.email_attention })) });
  } catch (error) { return errorResponse(error); }
}
