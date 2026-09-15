import { hash, OrderError, record } from "./domain";
import { hasTrustedSitesIdentity, orderDatabase, orderEnvironment } from "./runtime";

export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
export function errorResponse(error: unknown) {
  if (error instanceof OrderError) return json({ error: error.code }, error.status);
  // Never log request bodies, email provider responses, tokens, or database exceptions.
  console.error("[orders] operation_failed");
  return json({ error: "service_unavailable" }, 503);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new OrderError("invalid_origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OrderError("invalid_content_type", 415);
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 16384) throw new OrderError("request_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OrderError("invalid_input");
  let size = 0, body = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) { await reader.cancel(); throw new OrderError("request_too_large", 413); }
    body += decoder.decode(value, { stream: true });
  }
  try { return record(JSON.parse(body + decoder.decode())); } catch { throw new OrderError("invalid_input"); }
}
export function requireAdmin(request: Request) {
  // Only the Sites dispatch-owned Worker entry can establish this trust boundary.
  // Client-supplied identity headers on Node/Vercel are never authentication.
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const userId = request.headers.get("oai-authenticated-user-id");
  const allowed = orderEnvironment().ORDER_ADMIN_EMAILS?.split(",").map(e => e.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!hasTrustedSitesIdentity() || !email || !userId) throw new OrderError("authentication_required", 401);
  if (!allowed.includes(email)) throw new OrderError("access_denied", 403);
  return email;
}
export async function rateLimit(request: Request, email: string) {
  const db = orderDatabase(), slot = Math.floor(Date.now() / 3600000);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const keys = await Promise.all([hash(`order/email/${email}/${slot}`), hash(`order/ip/${ip}/${slot}`)]);
  const counts = await Promise.all(keys.map(key => db.prepare(`INSERT INTO order_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).bind(key, (slot + 1) * 3600000).first<{ count: number }>()));
  await db.prepare("DELETE FROM order_rate_limits WHERE expires_at < ?").bind(Date.now() - 3600000).run();
  if ((counts[0]?.count ?? 99) > 5 || (counts[1]?.count ?? 99) > 30) throw new OrderError("rate_limited", 429);
}
