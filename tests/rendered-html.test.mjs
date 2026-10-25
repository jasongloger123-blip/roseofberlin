import assert from "node:assert/strict";
import test from "node:test";

const productionCanonical = /<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/roseofberlin\.com\/")[^>]*>/i;

test("renders the storefront without embedding checkout on the homepage", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, productionCanonical);
  assert.match(html, /Explore the collection/);
  assert.match(html, /\/shop/);
  assert.doesNotMatch(html, /name="addressLine1"/);
  for (const path of ["/shop", "/warenkorb", "/kasse", "/impressum", "/datenschutz"]) {
    const page = await worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", {status:404}) } }, {waitUntil(){},passThroughOnException(){}});
    assert.equal(page.status,200,path);
  }
  assert.doesNotMatch(html, /formsubmit\.co|vercel\.app/);
});
