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
import { defaultSettings, invoiceTotals, parseSettings, suggestTariff, tariffEurCents } from "../lib/invoices/domain";
import { cancelInvoice, getSettings, issueInvoice, queueInvoice, saveSettings } from "../lib/invoices/service";
import { invoiceDocument } from "../lib/invoices/templates";
import { GET as invoiceList, POST as invoiceSettings } from "../app/api/admin/invoices/route";
import { GET as invoicePublic } from "../app/invoice/[token]/route";

let mf: Miniflare, db: Database;
const input = { product: "parfum", size: "30 ml", quantity: 2, firstName: "Test", lastName: "Customer", email: "orders@example.test", addressLine1: "Teststraße 12", addressLine2: "", postalCode: "31137", city: "Hildesheim", country: "DE", phone: "", language: "de" };
const env: OrderEnvironment = { PUBLIC_BASE_URL: "https://roseofberlin.de", ORDER_ADMIN_EMAILS: "admin@example.test", RESEND_API_KEY: "test-key-never-real", ORDER_FROM_EMAIL: "Rose of Berlin <orders@example.test>", ORDER_NOTIFICATION_EMAIL: "seller@example.test", BANK_ACCOUNT_NAME: "TEST ACCOUNT", BANK_IBAN: "DE00123456789000000000", BANK_BIC: "TESTDE00" };
const headers = { "Content-Type": "application/json", Origin: "https://roseofberlin.de", "oai-authenticated-user-id": "local-test-admin", "oai-authenticated-user-email": "admin@example.test" };
const run = <T>(fn: () => T, extra: Partial<OrderEnvironment> = {}) => withOrderEnvironment({ ...env, DB: db, ...extra }, true, fn);
const newOrder = () => createOrder(input, crypto.randomUUID());
let emails: { body: { reply_to: string; to: string[]; subject: string; html: string; text: string }; key: string }[] = [];
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
  assert.match(customer.body.text, /within 48 hours/);
}));

test("email imports remain unconfirmed drafts and discard extracted price fields", () => {
  const draft = prepareEmailDraft("message-1", { product: "oil", quantity: "2", total: "1" } as never);
  assert.equal(draft.customerConfirmed, false); assert.equal("total" in draft.proposedFields, false);
});

// Inspect the actual provider request, including snapshots created before sending.
test("order emails include checkout contact details and route replies correctly", async () => run(async () => {
  emails = []; mockMail();
  const { order } = await createOrder({ ...input, phone: "+49 511 123456", addressLine2: "Hinterhaus" }, crypto.randomUUID());
  await sendOrderEmails(order.id);
  const internal = emails.find(e => e.body.to.includes(env.ORDER_NOTIFICATION_EMAIL!))!.body;
  assert.equal(internal.reply_to, input.email);
  assert.match(internal.html, /mailto:orders@example.test/);
  assert.match(internal.text, /Kunden-E-Mail: orders@example.test/);
  assert.match(internal.text, /Telefon: \+49 511 123456/);
  assert.match(internal.html, /\+49 511 123456/);
  assert.match(internal.text, /Hinterhaus/);
  const receipt = emails.find(e => e.body.to.includes(input.email))!.body;
  assert.match(receipt.html, /innerhalb von 48 Stunden/);
  assert.match(receipt.text, /innerhalb von 48 Stunden/);
  const checked = await editOrder(order.id, { version: order.version, shippingCents: 490, availabilityConfirmed: true, sellerNote: "" });
  const payment = await requestPayment(checked.id, { version: checked.version });
  await sendOrderEmails(order.id);
  const paid = await transitionOrder(payment.id, { version: payment.version, status: "paid" });
  const processing = await transitionOrder(paid.id, { version: paid.version, status: "processing" });
  await transitionOrder(processing.id, { version: processing.version, status: "shipped" });
  await sendOrderEmails(order.id);
  const customer = emails.filter(e => e.body.to.includes(input.email));
  assert.equal(customer.length, 4);
  for (const email of customer) assert.equal(email.body.reply_to, env.ORDER_NOTIFICATION_EMAIL);
}));

 test("Christmas set uses server pricing and closes after December 25 in Berlin", () => {
 const gift = { ...input, product: "christmas", size: "100 ml + 100 ml", quantity: 2 };
 const lastMoment = Date.parse("2026-12-25T22:59:59Z");
 assert.equal(parseOrder(gift, lastMoment).subtotalCents, 12000);
 assert.throws(() => parseOrder({ ...gift, totalCents: 1 }, lastMoment), OrderError);
 assert.throws(() => parseOrder(gift, Date.parse("2026-12-25T23:00:00Z")), (error: unknown) => error instanceof OrderError && error.code === "offer_expired");
 });

test("mixed cart persists every line with a server-calculated total and one order", async () => run(async () => {
  const { product, size, quantity, ...contact } = input;
  void product; void size; void quantity;
  const cart = { ...contact, items: [{ product: "parfum", size: "50 ml", quantity: 2 }, { product: "oil", size: "100 ml", quantity: 1 }] };
  const parsed = parseOrder(cart);
  assert.equal(parsed.subtotalCents, 8480);
  const key = crypto.randomUUID();
  const first = await createOrder(cart,key);
  assert.equal(first.order.subtotal_cents,8480);
  const lines = await getItems(first.order.id);
  assert.equal(lines.length,2);
  assert.equal(lines.reduce((sum,line) => sum + line.line_total_cents,0),8480);
  const repeated = await createOrder({ ...cart, items: [...cart.items].reverse() },key);
  assert.equal(repeated.order.id,first.order.id);
  assert.equal(repeated.duplicate,true);
  const events = await getEvents(first.order.id);
  assert.equal(events.length,2);
  const draft = await import("../lib/orders/templates");
  const email = draft.emailPayload(events.find(event => event.kind === "received")!,first.order,lines);
  assert.match(email.text,/50 ml × 2/);
  assert.match(email.text,/100 ml × 1/);
}));
test("cart rejects empty, tampered and over-limit line items", () => {
  const { product, size, quantity, ...contact } = input;
  void product; void size; void quantity;
  const item = { product:"oil",size:"100 ml",quantity:1 };
  for (const items of [[],[null],[{...item,price:1}],[{...item,quantity:6}],[{...item,quantity:3},{...item,quantity:3}],[{...item,size:"500 ml"}],Array(13).fill(item)]) assert.throws(() => parseOrder({...contact,items}),OrderError);
  assert.throws(() => parseOrder({...input,items:[item]}),OrderError);
  const merged = parseOrder({...contact,items:[item,item]});
  assert.equal(merged.items.length,1); assert.equal(merged.subtotalCents,3000);
});

test("rose tea pack is priced on the server, persisted and included in confirmations", async () => run(async () => {
  const tea = { ...input, product: "tea", size: "10 Teebeutel", quantity: 2 };
  const parsed = parseOrder(tea);
  assert.equal(parsed.subtotalCents, 1980);
  assert.throws(() => parseOrder({ ...tea, size: "1 Teebeutel" }), OrderError);
  const first = await createOrder(tea,crypto.randomUUID());
  const items = await getItems(first.order.id);
  assert.equal(items.length,1);
  assert.equal(items[0].product_key,"tea");
  assert.equal(items[0].unit_price_cents,990);
  assert.equal(items[0].line_total_cents,1980);
  const events = await getEvents(first.order.id);
  const {emailPayload} = await import("../lib/orders/templates");
  const email = emailPayload(events.find(event=>event.kind === "received")!,first.order,items);
  assert.match(email.text,/Bio-Rosentee/);
  assert.match(email.text,/10 Teebeutel × 2/);
}));

test("invoice tariffs never infer an unknown basket and validate rates", () => {
  const t=suggestTariff("AU",[{product_key:"oil",quantity:1}],defaultSettings.tariffs)!;
  assert.equal(t.cents,2500);assert.equal(tariffEurCents(t),1544);
  assert.equal(suggestTariff("DE",[{product_key:"oil",quantity:1}],defaultSettings.tariffs),null);
  assert.equal(suggestTariff("AU",[{product_key:"christmas",quantity:1}],defaultSettings.tariffs),null);
  assert.throws(()=>parseSettings({...defaultSettings,tariffs:[{...t,eurRate:0}]}),OrderError);
  assert.deepEqual(invoiceTotals([{quantity:1,unit_price_cents:6000,line_total_cents:6000}],2996),{subtotal:6000,shipping:2996,total:8996});
  assert.throws(()=>invoiceTotals([{quantity:1,unit_price_cents:6000,line_total_cents:5900}],2996),OrderError);
});
test("invoice settings require an optimistic version and cannot overwrite a concurrent edit",async()=>run(async()=>{
  const {version}=await getSettings();
  const settings={...defaultSettings,taxId:"TEST-ONLY",taxNote:"Test exemption",taxConfirmed:true};
  const updated=await saveSettings({version,settings});assert.equal(updated.version,version+1);
  await assert.rejects(saveSettings({version,settings}),/stale_settings/);
}));
test("invoice issuance requires a reviewed address, complete setup, saved terms and valid delivery date",async()=>run(async()=>{
  const order=await ready();
  await assert.rejects(issueInvoice(order.id,{version:order.version,addressConfirmed:true,deliveryDate:"2026-11-20"},"admin@example.test"),/invoice_not_ready/);
  const payable=await requestPayment(order.id,{version:order.version});
  await assert.rejects(issueInvoice(order.id,{version:payable.version,addressConfirmed:false,deliveryDate:"2026-11-20"},"admin@example.test"),/invoice_setup_required/);
  await assert.rejects(issueInvoice(order.id,{version:payable.version,addressConfirmed:true,deliveryDate:"2026-02-30"},"admin@example.test"),/invalid_delivery_date/);
}));
test("parallel invoice issuance freezes one numbered snapshot and prevents term changes",async()=>run(async()=>{
  const readyOrder=await ready(), order=await requestPayment(readyOrder.id,{version:readyOrder.version});
  const args={version:order.version,addressConfirmed:true,deliveryDate:"2026-11-20"};
  const results=await Promise.all([issueInvoice(order.id,args,"admin@example.test"),issueInvoice(order.id,args,"admin@example.test")]);
  assert.equal(results[0].id,results[1].id);assert.match(results[0].number,/^ROB-RE-\d{4}-\d{6}$/);
  const invoice=results[0], snapshot=invoice.snapshot;
  await assert.rejects(editOrder(order.id,{version:order.version,shippingCents:999,availabilityConfirmed:true,sellerNote:""}),/invoice_terms_locked/);
  await assert.rejects(db.prepare("UPDATE invoices SET snapshot='{}' WHERE id=?").bind(invoice.id).run());
  await assert.rejects(db.prepare("DELETE FROM invoices WHERE id=?").bind(invoice.id).run());
  assert.match(invoiceDocument(invoice),/54,70/);
  assert.match(invoiceDocument(invoice),/TEST-ONLY/);
  const settings=await getSettings();await saveSettings({version:settings.version,settings:{...settings.settings,sellerName:"Different seller"}});
  assert.match(invoiceDocument({...invoice,snapshot}),/Selesitina Gloger/);
  assert.doesNotMatch(invoiceDocument(invoice),/Different seller/);
}));
test("invoice emails reuse the outbox and public documents need a secret token",async()=>run(async()=>{
  const readyOrder=await ready(), order=await requestPayment(readyOrder.id,{version:readyOrder.version});
  const invoice=await issueInvoice(order.id,{version:order.version,addressConfirmed:true,deliveryDate:"2026-11-20"},"admin@example.test");
  await Promise.all([queueInvoice(invoice),queueInvoice(invoice)]);
  const events=(await getEvents(order.id)).filter(e=>e.kind==="invoice");assert.equal(events.length,1);
  assert.match(JSON.parse(events[0].payload_json!).html,/Invoice|Rechnung/);
  assert.equal((await invoicePublic(new Request("https://roseofberlin.de/invoice/bad"),{params:Promise.resolve({token:"bad"})})).status,404);
  const response=await invoicePublic(new Request("https://roseofberlin.de/invoice/"+invoice.token),{params:Promise.resolve({token:invoice.token})});
  assert.equal(response.status,200);assert.match(response.headers.get("Cache-Control")!,/no-store/);
}));
test("cancellation preserves the original and allows a separate replacement invoice",async()=>run(async()=>{
  const readyOrder=await ready(),order=await requestPayment(readyOrder.id,{version:readyOrder.version});
  const input={version:order.version,addressConfirmed:true,deliveryDate:"2026-11-20"};
  const first=await issueInvoice(order.id,input,"admin@example.test");
  const cancelled=await cancelInvoice(first.id,{reason:"Address correction"},"admin@example.test");
  assert.equal(cancelled.snapshot,first.snapshot);assert.match(invoiceDocument(cancelled,undefined,true),/-54,70/);
  await assert.rejects(queueInvoice(cancelled),/invoice_cancelled/);
  const replacement=await issueInvoice(order.id,input,"admin@example.test");
  assert.notEqual(replacement.number,first.number);assert.notEqual(replacement.id,first.id);
}));
test("invoice routes reject anonymous, spoofed identities and cross-origin settings writes",async()=>{
  const req=new Request("https://roseofberlin.de/api/admin/invoices");
  assert.equal((await run(()=>invoiceList(req))).status,401);
  const spoofed=await withOrderEnvironment({...env,DB:db},false,()=>invoiceList(new Request(req,{headers})));
  assert.equal(spoofed.status,401);
  const cross=await run(()=>invoiceSettings(new Request(req,{method:"POST",headers:{...headers,Origin:"https://evil.example"},body:JSON.stringify({action:"settings"})})));
  assert.equal(cross.status,403);
});
