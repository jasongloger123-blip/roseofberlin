import type { Order } from "../../../../db/schema";
import { orderDatabase } from "../../../../lib/orders/runtime";
import { getItems } from "../../../../lib/orders/repository";
import { paymentDocument } from "../../../../lib/orders/templates";
import { privateHeaders } from "../../../../lib/orders/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ secureToken: string }> }) {
  const { secureToken } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(secureToken)) return new Response("Not found", { status: 404, headers: privateHeaders });
  try {
    const order = await orderDatabase().prepare("SELECT * FROM orders WHERE public_token=? AND payment_snapshot IS NOT NULL").bind(secureToken).first<Order>();
    if (!order) return new Response("Not found", { status: 404, headers: privateHeaders });
    const nonce = crypto.randomUUID();
    return new Response(paymentDocument(order, await getItems(order.id), nonce), { headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` } });
  } catch {
    return new Response("Temporarily unavailable. Please try again later.", { status: 503, headers: privateHeaders });
  }
}
