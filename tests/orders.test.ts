import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { withOrderEnvironment, type Database, type OrderEnvironment } from "../lib/orders/runtime";
import { createOrder, editOrder, requestPayment, transitionOrder } from "../lib/orders/service";
import { getEvents, getItems } from "../lib/orders/repository";
import { parseOrder, OrderError } from "../lib/orders/domain";
import { sendEvent, sendOrderEmails } from "../lib/orders/mail";
import { requireAdmin } from "../lib/orders/http";
import { POST as checkout } from "../app/api/interesse/route";
import { GET as paymentPage } from "../app/order/[secureToken]/payment/route";
import { GET as adminList } from "../app/api/admin/orders/route";
import { GET as adminDetail, POST as adminAction } from "../app/api/admin/orders/[id]/route";
import { prepareEmailDraft } from "../lib/orders/import";

let mf: Miniflare, db: Database;
const input = { product: "parfum", size: "30 ml", quantity: 2, firstName: "Test", lastName: "Customer", email: "orders@example.test", addressLine1: "Teststraße 12", addressLine2: "", postalCode: "31137", city: "Hildesheim", country: "DE", phone: "", language: "de" };
const env: OrderEnvironment = { PUBLIC_BASE_URL: "https://roseofberlin.de", ORDER_ADMIN_EMAILS: "admin@example.test", RESEND_API_KEY: "test-key-never-real", ORDER_FROM_EMAIL: "Rose of Berlin <orders@example.test>", ORDER_NOTIFICATION_EMAIL: "seller@example.test", BANK_ACCOUNT_NAME: "TEST ACCOUNT", BANK_IBAN: "DE00123456789000000000", BANK_BIC: "TESTDE00" };
const headers = { "Content-Type": "application/json", Origin: "https://roseofberlin.de", "oai-authenticated-user-id": "local-test-admin", "oai-authenticated-user-email": "admin@example.test" };
const run = <T>(fn: () => T, extra: Partial<OrderEnvironment> = {}) => withOrderEnvironment({ ...env, DB: db, ...extra }, true, fn);
const newOrder = () => createOrder(input, crypto.randomUUID());
let emails: { body: { to: string[]; subject: string; html: string; text: string }; key: string }[] = [];
const originalFetch = globalThis.fetch;
function mockMail(status = 200) {
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(String(url), "https://api.resend.com/emails", "tests must never call a live email provider");
    const key = new Headers(options?.headers).get("Idempotency-Key")!;
    emails.push({ body: JSON.parse(String(options?.body)), key });
    return Response.json(status === 200 ? { id: `mail-${key}` } : { message: "simulated" }, { status });
  }) as typeof fetch;
}
before(async () => {
  mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-05-22", d1Databases: ["DB"] });
  db = await mf.getD1Database("DB") as unknown as Database;
  for (const file of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) {
    for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint").filter(s => s.trim())) await db.prepare(sql).run();
  }
  mockMail();
});
after(async () => { globalThis.fetch = originalFetch; await mf?.dispose(); });

test("rejects invalid and manipulated requests", () => {
  for (const changes of [ { email: "bad" }, { product: "unknown" }, { product: "__proto__" }, { size: "10 ml" }, { size: "constructor" }, { quantity: 0 }, { quantity: 6 }, { quantity: 1.5 }, { quantity: "2" }, { addressLine1: "" }, { city: "" }, { firstName: "" }, { country: "XX" }, { postalCode: "" }, { totalCents: 1 }, { unitPriceCents: 1 }, { shippingCents: 0 }, { currency: "USD" }, { language: "xx" } ]) {
    assert.throws(() => parseOrder({ ...input, ...changes }), OrderError);
  }
  assert.equal(parseOrder(input).subtotalCents, 4980);
  assert.equal(parseOrder({ ...input, product: "oil", size: "100 ml" }).subtotalCents, 3000);
});

test("saves order, item snapshot and both outbox events in real D1", async () => run(async () => {
  const { order } = await newOrder();
  assert.match(order.order_number!, /^ROB-\d{4}-\d{6}$/);
  assert.equal(order.subtotal_cents, 4980); assert.equal(order.shipping_cents, null); assert.equal(order.total_cents, null);
  assert.equal(order.currency, "EUR"); assert.equal(order.status, "received");
  assert.equal((await getItems(order.id))[0].unit_price_cents, 2490);
  assert.equal((await getEvents(order.id)).length, 2);
  await assert.rejects(db.prepare("UPDATE order_items SET unit_price_cents=1 WHERE order_id=?").bind(order.id).run());
}));

test("parallel duplicate submissions create exactly one order and one set of items/events", async () => run(async () => {
  const key = crypto.randomUUID();
  const results = await Promise.all(Array.from({ length: 5 }, () => createOrder(input, key)));
  assert.equal(new Set(results.map(r => r.order.id)).size, 1);
  assert.equal((await getItems(results[0].order.id)).length, 1);
  assert.equal((await getEvents(results[0].order.id)).length, 2);
  await assert.rejects(createOrder({ ...input, quantity: 1 }, key), /idempotency_conflict/);
}));

test("D1 batch rollback prevents partial order creation", async () => run(async () => {
  const before = await db.prepare("SELECT count(*) AS n FROM orders").first<{ n: number }>();
  await assert.rejects(db.batch([
    db.prepare("INSERT INTO order_rate_limits (key,count,expires_at) VALUES ('rollback-proof',1,0)"),
    db.prepare("INSERT INTO order_items (id,order_id,product_key,product_label,size,quantity,unit_price_cents,line_total_cents) VALUES ('bad','missing','oil','Oil','20 ml',0,10,0)"),
  ]));
  assert.equal(await db.prepare("SELECT * FROM order_rate_limits WHERE key='rollback-proof'").first(), null);
  assert.deepEqual(await db.prepare("SELECT count(*) AS n FROM orders").first(), before);
}));

async function ready() {
  const { order } = await newOrder();
  return editOrder(order.id, { version: order.version, shippingCents: 490, availabilityConfirmed: true, sellerNote: "Checked" });
}
test("payment requires availability and shipping, computes totals and prevents duplicate requests", async () => run(async () => {
  const { order } = await newOrder();
  await assert.rejects(requestPayment(order.id, { version: order.version }), /payment_not_ready/);
  const checked = await editOrder(order.id, { version: order.version, shippingCents: 490, availabilityConfirmed: true, sellerNote: "" });
  const results = await Promise.all([requestPayment(order.id, { version: checked.version }), requestPayment(order.id, { version: checked.version })]);
  assert.equal(results[0].total_cents, 5470); assert.equal(results[1].payment_revision, 1);
  const events = (await getEvents(order.id)).filter(e => e.kind === "payment"); assert.equal(events.length, 1);
  const payload = JSON.parse(events[0].payload_json!); assert.match(payload.html, /54,70/); assert.match(payload.text, /TEST ACCOUNT/);
  assert.match(payload.html, /https:\/\/roseofberlin\.de\/order\/[a-f0-9]{64}\/payment/);
}));

test("shipping validates integer cents and supports free shipping", async () => run(async () => {
  const { order } = await newOrder();
  for (const value of [-1, 1.5, 100001, "4.90"]) await assert.rejects(editOrder(order.id, { version: order.version, shippingCents: value, availabilityConfirmed: true, sellerNote: "" }), /invalid_shipping/);
  const free = await editOrder(order.id, { version: order.version, shippingCents: 0, availabilityConfirmed: true, sellerNote: "" });
  assert.equal((await requestPayment(order.id, { version: free.version })).total_cents, 4980);
}));

test("shipping amendments revoke the old payment link and create a new revision", async () => run(async () => {
  const checked = await ready(), first = await requestPayment(checked.id, { version: checked.version });
  const amended = await editOrder(first.id, { version: first.version, shippingCents: 690, availabilityConfirmed: true, sellerNote: "new shipping" });
  assert.equal(amended.status, "needs_review"); assert.notEqual(amended.public_token, first.public_token);
  assert.equal((await paymentPage(new Request("https://roseofberlin.de"), { params: Promise.resolve({ secureToken: first.public_token }) })).status, 404);
  const second = await requestPayment(amended.id, { version: amended.version }); assert.equal(second.total_cents, 5670); assert.equal(second.payment_revision, 2);
  assert.equal((await getEvents(first.id)).find(e => e.kind === "payment" && e.revision === 1)?.status, "cancelled");
}));

test("payment and shipment transitions store timestamps and queue each confirmation once", async () => run(async () => {
  const checked = await ready(), payment = await requestPayment(checked.id, { version: checked.version });
  await assert.rejects(transitionOrder(payment.id, { version: payment.version, status: "shipped" }), /invalid_transition/);
  const paid = await transitionOrder(payment.id, { version: payment.version, status: "paid" }); assert.ok(paid.paid_at);
  await transitionOrder(payment.id, { version: payment.version, status: "paid" });
  await assert.rejects(editOrder(paid.id, { version: paid.version, shippingCents: 0, availabilityConfirmed: true, sellerNote: "" }), /terms_locked/);
  const processing = await transitionOrder(paid.id, { version: paid.version, status: "processing" });
  const shipped = await transitionOrder(paid.id, { version: processing.version, status: "shipped", trackingNumber: "TEST-TRACKING" });
  await transitionOrder(paid.id, { version: processing.version, status: "shipped", trackingNumber: "TEST-TRACKING" });
  assert.ok(shipped.shipped_at); assert.equal(shipped.tracking_number, "TEST-TRACKING");
  const events = await getEvents(paid.id); assert.equal(events.filter(e => e.kind === "paid").length, 1); assert.equal(events.filter(e => e.kind === "shipped").length, 1);
  await assert.rejects(transitionOrder(shipped.id, { version: shipped.version, status: "paid" }), /invalid_transition/);
}));

test("parallel mail sends use leases and stable provider keys; successful mails are never resent", async () => run(async () => {
  emails = []; mockMail(); const { order } = await newOrder(); const event = (await getEvents(order.id))[0];
  await Promise.all(Array.from({ length: 4 }, () => sendEvent(event.id)));
  await sendEvent(event.id);
  assert.equal(emails.length, 1); assert.equal(emails[0].key, event.dedupe_key);
  assert.equal((await getEvents(order.id)).find(e => e.id === event.id)?.status, "sent");
}));

test("provider failure preserves checkout, records attempt and allows safe retry", async () => run(async () => {
  mockMail(500);
  const request = new Request("https://roseofberlin.de/api/interesse", { method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(input) });
  const response = await checkout(request); assert.equal(response.status, 201);
  const result = await response.json() as { orderNumber: string };
  const order = await db.prepare("SELECT * FROM orders WHERE order_number=?").bind(result.orderNumber).first<{ id: string }>(); assert.ok(order);
  assert.ok((await getEvents(order.id)).every(e => e.status === "failed"));
  mockMail(); await sendOrderEmails(order.id); assert.ok((await getEvents(order.id)).every(e => e.status === "sent"));
}));

test("uncertain delivery after provider dedupe window requires manual reconciliation", async () => run(async () => {
  const { order } = await newOrder(), event = (await getEvents(order.id))[0];
  await db.prepare("UPDATE order_email_events SET status='failed',first_attempt_at=? WHERE id=?").bind(new Date(Date.now() - 25 * 3600000).toISOString(), event.id).run();
  emails = []; await sendEvent(event.id);
  assert.equal(emails.length, 0); assert.equal((await getEvents(order.id)).find(e => e.id === event.id)?.status, "manual_review");
}));

test("missing email configuration cannot discard a paid status", async () => run(async () => {
  const checked = await ready(), payment = await requestPayment(checked.id, { version: checked.version });
  const paid = await withOrderEnvironment({ DB: db }, true, () => transitionOrder(payment.id, { version: payment.version, status: "paid" }));
  assert.equal(paid.status, "paid");
  await withOrderEnvironment({ DB: db }, true, () => sendOrderEmails(paid.id));
  assert.equal((await getEvents(paid.id)).find(e => e.kind === "paid")?.status, "failed");
}));

test("unguessable private payment document hides bank instructions after payment/cancellation", async () => run(async () => {
  const checked = await ready(), order = await requestPayment(checked.id, { version: checked.version });
  const params = { params: Promise.resolve({ secureToken: order.public_token }) };
  assert.match(order.public_token, /^[a-f0-9]{64}$/);
  const response = await paymentPage(new Request("https://roseofberlin.de"), params);
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/); assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(await response.text(), /TEST ACCOUNT/);
  await transitionOrder(order.id, { version: order.version, status: "cancelled" });
  const cancelled = await paymentPage(new Request("https://roseofberlin.de"), params); const html = await cancelled.text();
  assert.match(html, /Bitte nicht bezahlen/); assert.doesNotMatch(html, /TEST ACCOUNT/);
  assert.equal((await paymentPage(new Request("https://roseofberlin.de"), { params: Promise.resolve({ secureToken: "123" }) })).status, 404);
}));

test("admin rejects anonymous, unlisted and spoofed Node identities; all actions check origin", async () => run(async () => {
  assert.equal((await adminList(new Request("https://roseofberlin.de/api/admin/orders"))).status, 401);
  assert.throws(() => requireAdmin(new Request("https://roseofberlin.de", { headers: { ...headers, "oai-authenticated-user-email": "intruder@example.test" } })), /access_denied/);
  assert.throws(() => withOrderEnvironment(env, false, () => requireAdmin(new Request("https://roseofberlin.de", { headers }))), /authentication_required/);
  const { order } = await newOrder();
  const response = await adminAction(new Request("https://roseofberlin.de/api/admin/orders/" + order.id, { method: "POST", headers: { ...headers, Origin: "https://evil.example" }, body: JSON.stringify({ action: "edit" }) }), { params: Promise.resolve({ id: order.id }) });
  assert.equal(response.status, 403);
  const detail = await adminDetail(new Request("https://roseofberlin.de", { headers }), { params: Promise.resolve({ id: order.id }) });
  const body = await detail.text(); assert.doesNotMatch(body, /request_hash|idempotency_key|payment_snapshot|payload_json|public_token/);
}));

test("German and English emails escape customer content and omit final payment in receipts", async () => run(async () => {
  emails = []; mockMail();
  const { order } = await createOrder({ ...input, firstName: "<script>alert(1)</script>", language: "en" }, crypto.randomUUID());
  await sendOrderEmails(order.id);
  const customer = emails.find(e => e.body.to.includes(input.email))!;
  assert.match(customer.body.html, /Please do not pay yet/); assert.doesNotMatch(customer.body.html, /<script>alert|TEST ACCOUNT/); assert.match(customer.body.html, /&lt;script&gt;/);
  assert.match(customer.body.text, /Your purchase enquiry is non-binding/);
}));

test("email imports remain unconfirmed drafts and discard extracted price fields", () => {
  const draft = prepareEmailDraft("message-1", { product: "oil", quantity: "2", total: "1" } as never);
  assert.equal(draft.customerConfirmed, false); assert.equal("total" in draft.proposedFields, false);
});
