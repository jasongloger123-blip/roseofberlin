import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { Miniflare } from "miniflare";

test("compiled Worker runs checkout, admin, payment document and fulfilment with D1", async () => {
  const mf = new Miniflare({ modules: true, script: "export default { fetch(){return new Response('test')} }", compatibilityDate: "2026-05-22", d1Databases: ["DB"] });
  try {
    const db = await mf.getD1Database("DB");
    for (const file of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) {
      for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint").filter(s => s.trim())) await db.prepare(sql).run();
    }
    const { default: worker } = await import("../dist/server/index.js");
    const env = { DB: db, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, PUBLIC_BASE_URL: "https://roseofberlin.de", ORDER_FROM_EMAIL: "Rose of Berlin <test@example.test>", ORDER_NOTIFICATION_EMAIL: "seller@example.test", ORDER_ADMIN_EMAILS: "admin@example.test", PAYPAL_ADDRESS: "paypal-fixture@example.test" };
    // Intentionally no RESEND_API_KEY: this integration test cannot send real email.
    const ctx = { waitUntil() {}, passThroughOnException() {} };
    const adminHeaders = { "oai-authenticated-user-id": "local-admin", "oai-authenticated-user-email": "admin@example.test" };
    const fetchWorker = (path, body, admin = false, key) => worker.fetch(new Request(`https://roseofberlin.de${path}`, { headers: { ...(body ? { "Content-Type": "application/json", Origin: "https://roseofberlin.de" } : {}), ...(admin ? adminHeaders : {}), ...(key ? { "Idempotency-Key": key } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) }), env, ctx);
    const input = { product: "parfum", size: "50 ml", quantity: 2, firstName: "Maria", lastName: "Beispiel", email: "worker-qa@example.test", addressLine1: "Musterstraße 12", postalCode: "31137", city: "Hildesheim", country: "DE", language: "de" };
    const key = crypto.randomUUID();
    const create = await fetchWorker("/api/interesse", input, false, key); assert.equal(create.status, 201);
    const receipt = await create.json(); assert.match(receipt.orderNumber, /^ROB-\d{4}-\d{6}$/);
    assert.equal((await fetchWorker("/api/interesse", input, false, key)).status, 200);
    assert.equal((await fetchWorker("/api/admin/orders")).status, 401);
    const list = await fetchWorker("/api/admin/orders", undefined, true); assert.equal(list.status, 200);
    const row = (await list.json()).orders[0];
    const adminPage = await fetchWorker("/admin/orders", undefined, true); assert.equal(adminPage.status, 200); assert.match(adminPage.headers.get("cache-control"), /no-store/);
    const detail = await (await fetchWorker(`/api/admin/orders/${row.id}`, undefined, true)).json();
    const edited = await fetchWorker(`/api/admin/orders/${row.id}`, { action: "edit", version: detail.order.version, shippingCents: 590, availabilityConfirmed: true, sellerNote: "not public" }, true); assert.equal(edited.status, 200);
    const version = (await edited.json()).order.version;
    const payment = await fetchWorker(`/api/admin/orders/${row.id}`, { action: "payment", version }, true); assert.equal(payment.status, 200);
    const payData = await payment.json(); assert.equal(payData.order.total_cents, 7570);
    assert.match(payData.paymentPath, /^\/order\/[a-f0-9]{64}\/payment$/);
    const document = await fetchWorker(payData.paymentPath); assert.equal(document.status, 200);
    const html = await document.text(); assert.match(html, /75,70/); assert.match(html, /paypal-fixture@example.test/); assert.doesNotMatch(html, /not public/);
    if (process.env.ORDER_QA_FIXTURES === "1") await writeFile(".sites-runtime/payment-qa.html", html);
    let currentVersion = payData.order.version;
    for (const status of ["paid", "processing", "shipped"]) {
      const action = await fetchWorker(`/api/admin/orders/${row.id}`, { action: "status", version: currentVersion, status, trackingNumber: "QA-123" }, true);
      assert.equal(action.status, 200); const data = await action.json(); currentVersion = data.order.version; assert.equal(data.order.status, status);
    }
    const paidDocument = await (await fetchWorker(payData.paymentPath)).text(); assert.doesNotMatch(paidDocument, /paypal-fixture@example.test/); assert.match(paidDocument, /QA-123/);
  } finally { await mf.dispose(); }
});
