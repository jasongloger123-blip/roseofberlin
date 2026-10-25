import type { Metadata } from "next";
import { metadataBaseUrl } from "./site-url";
import { products, type ProductKey, type ShopLanguage } from "./storefront";
import { christmasOfferAvailable } from "./orders/domain";

export type SearchParams = Record<string, string | string[] | undefined>;
export function searchLanguage(params: SearchParams): ShopLanguage { return params.lang === "en" ? "en" : "de"; }
export function localizedPath(path: string, language: ShopLanguage) { return language === "en" ? `${path}?lang=en` : path; }
export function absoluteUrl(path: string) { return new URL(path, metadataBaseUrl()).href; }
export const homeDescriptions = {
 de: "Handgemachtes Rosenparfum und Körperöl von Selesitina Tatafu Gloger aus Hohenhameln. Mit Rosen aus dem eigenen Garten. Größen, Preise und Kaufanfrage entdecken.",
 en: "Handmade rose perfume and body oil by Selesitina Tatafu Gloger in Hohenhameln, Germany. Discover small-batch fragrances, sizes, prices and purchase enquiries.",
};
export function pageMetadata(path: string, language: ShopLanguage, title: string, description: string, image = "/rose-of-berlin-hero-mobile.webp"): Metadata {
 const url = localizedPath(path, language);
 return {
  title: path === "/" ? { absolute: title } : title, description,
  alternates: { canonical: url, languages: { de: absoluteUrl(path), en: absoluteUrl(`${path}?lang=en`), "x-default": absoluteUrl(path) } },
  openGraph: { type: "website", siteName: "Rose of Berlin", title, description, url, locale: language === "de" ? "de_DE" : "en_GB", alternateLocale: language === "de" ? ["en_GB"] : ["de_DE"], images: [{ url: image, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
 };
}
export const productTitles: Record<ProductKey, Record<ShopLanguage,string>> = {
 tea: { de: "Bio-Rosentee · 10 handgemachte Teebeutel · Made in Germany", en: "Organic rose tea · 10 handmade tea bags · Made in Germany" },
 parfum: { de: "Rosenparfum · Handgemachtes Eau de Parfum", en: "Rose perfume · Handmade Eau de Parfum" },
 oil: { de: "Rosenpflege · Handgemachtes Haut- & Körperöl", en: "Rose care · Handmade skin & body oil" },
 christmas: { de: "Weihnachts-Geschenkset · Rosenparfum 2 × 100 ml", en: "Christmas gift set · Rose perfume 2 × 100 ml" },
};
export function productStructuredData(key: ProductKey, language: ShopLanguage) {
 const product = products[key];
 const path = `/produkte/${product.slug}`;
 const url = absoluteUrl(localizedPath(path,language));
 const common = { ...(key === "tea" ? { countryOfOrigin: { "@type":"Country", name:"Germany" } } : {}), name: `${product.name} · ${product.category[language]}`, description: `${product.description[language]} ${product.detail[language]}`, image: [absoluteUrl(product.image)], brand: { "@type":"Brand", name:"Rose of Berlin" }, manufacturer:{"@id":absoluteUrl("/#organization")} };
 const variant = (option: typeof product.options[number]) => {
  const variantUrl = new URL(url); variantUrl.searchParams.set("size",option.size);
  return { "@type":"Product", ...common, name: `${product.name} · ${product.category[language]} · ${option.size}`, sku:`ROB-${key}-${option.size.replace(/\s/g,"")}`, size:option.size, url:variantUrl.href,
   offers:{ "@type":"Offer", url:variantUrl.href, price:option.price.toFixed(2), priceCurrency:"EUR", itemCondition:"https://schema.org/NewCondition", seller:{"@id":absoluteUrl("/#organization")}, ...(key === "christmas" ? { priceValidUntil:"2026-12-25", validThrough:"2026-12-25T23:59:59+01:00", ...(!christmasOfferAvailable() ? {availability:"https://schema.org/Discontinued"}: {}) } : {}) } };
 };
 return { "@context":"https://schema.org", "@graph":[
  product.options.length > 1 ? { "@type":"ProductGroup", "@id":`${url}#product`, ...common, url, productGroupID:`ROB-${key}`, variesBy:["https://schema.org/size"], hasVariant:product.options.map(variant) } : { ...variant(product.options[0]), "@id":`${url}#product` },
  { "@type":"BreadcrumbList", itemListElement:[{ "@type":"ListItem",position:1,name:"Rose of Berlin",item:absoluteUrl(localizedPath("/",language)) },{ "@type":"ListItem",position:2,name:"Shop",item:absoluteUrl(localizedPath("/shop",language)) },{ "@type":"ListItem",position:3,name:product.category[language],item:url }] },
 ] };
}
