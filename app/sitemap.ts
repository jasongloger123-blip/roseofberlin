import { metadataBaseUrl } from "../lib/site-url";
import { productKeys, products } from "../lib/storefront";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/shop", ...productKeys.map(key => `/produkte/${products[key].slug}`)].map(path => ({ url: `${metadataBaseUrl()}${path}`, lastModified: new Date(), changeFrequency: "monthly", priority: path === "" ? 1 : 0.8 }));
}
