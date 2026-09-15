import assert from "node:assert/strict";
import test from "node:test";

const productionCanonical = /<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/roseofberlin\.de\/")[^>]*>/i;

test("renders production metadata and the complete purchase enquiry", async () => {
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
  assert.match(html, /name="addressLine1"/);
  assert.match(html, /Phone number \(optional\)/);
  assert.doesNotMatch(html, /formsubmit\.co|vercel\.app/);
});
