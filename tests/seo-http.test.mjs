import assert from "node:assert/strict";
import test from "node:test";

// Run explicitly against a preview or production deployment, never send an order.
const origin = process.env.SEO_TEST_ORIGIN;
if (!origin) throw new Error("Set SEO_TEST_ORIGIN to the deployment to verify.");
const canonicalOrigin = "https://roseofberlin.com";
const get = async path => {
 const response = await fetch(new URL(path, origin), { headers: { "user-agent": "Googlebot", accept: "text/html" }, signal: AbortSignal.timeout(30000) });
 return { response, html: await response.text() };
};
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map(match=>match[0]);
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`,"i"))?.[1].replaceAll("&amp;","&");
const schemas = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match=>{ const parsed=JSON.parse(match[1]); return parsed["@graph"] ?? [parsed]; });
const routes = ["/", "/shop", "/produkte/rosenparfum", "/produkte/koerperoel", "/produkte/weihnachtsset"];
for (const path of routes) for (const lang of ["de","en"]) test(`${lang} ${path}: indexable server HTML and localized canonical`, async () => {
 const query=lang === "en" ? "?lang=en" : "";
 const {response,html}=await get(`${path}${query}`);
 assert.equal(response.status,200);
 const links=tags(html,"link");
 assert.equal(links.filter(tag=>attribute(tag,"rel")==="canonical").length,1);
 assert.equal(new URL(attribute(links.find(tag=>attribute(tag,"rel")==="canonical"),"href")).href,new URL(`${canonicalOrigin}${path}${query}`).href);
 for(const locale of ["de","en","x-default"]) assert.ok(links.some(tag=>attribute(tag,"hreflang")===locale),locale);
 const description=tags(html,"meta").find(tag=>attribute(tag,"name")==="description"); assert.ok(attribute(description,"content")?.length>50);
 assert.ok(tags(html,"meta").some(tag=>attribute(tag,"property")==="og:image"));
 assert.doesNotMatch(html, /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);
 assert.equal((html.match(/<h1\b/g) ?? []).length,1);
 assert.match(html,new RegExp(`<main[^>]*lang="${lang}"`));
 const data=schemas(html); assert.ok(data.some(item=>item["@type"]==="Organization"));
 if(path.includes("/produkte/")) {
  const product=data.find(item=>["ProductGroup","Product"].includes(item["@type"])); assert.ok(product);
  assert.ok(data.some(item=>item["@type"]==="BreadcrumbList"));
  const variants=product.hasVariant ?? [product];
  const expected=path.endsWith("rosenparfum") ? [19.9,24.9,34.9,49.9] : path.endsWith("koerperoel") ? [9,15] : [60];
  assert.deepEqual(variants.map(item=>Number(item.offers.price)),expected);
  variants.forEach(item=>{assert.equal(item.offers.priceCurrency,"EUR"); assert.ok(item.offers.url.includes("size="));});
 }
});
test("discovery files, private noindex and actual variant selection",async()=>{
 const {html:robots}=await get("/robots.txt"); assert.match(robots,/Allow: \/\n/);assert.match(robots,/Sitemap: https:\/\/roseofberlin.com\/sitemap.xml/);assert.doesNotMatch(robots,/Disallow: \/\s*$/m);
 const {html:sitemap}=await get("/sitemap.xml");assert.equal((sitemap.match(/<loc>/g)??[]).length,10);
 for(const path of routes) assert.ok(sitemap.includes(`${canonicalOrigin}${path}`));
 for(const path of ["/warenkorb","/kasse"]) {const {html}=await get(path);assert.match(html,/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);}
 const {response}=await get("/produkte/unbekannt");assert.equal(response.status,404);
 const {html:variant}=await get("/produkte/rosenparfum?lang=en&size=100%20ml");assert.match(variant,/value="100 ml"[^>]*checked=""|checked=""[^>]*value="100 ml"/);
 for(const path of ["/rose-of-berlin-hero.webp","/rose-of-berlin-hero-mobile.webp"]) {const {response}=await get(path);assert.equal(response.status,200);assert.match(response.headers.get("content-type"),/image\/webp/);}
});
