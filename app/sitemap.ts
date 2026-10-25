import { absoluteUrl, localizedPath } from "../lib/seo";
import { productKeys, products } from "../lib/storefront";
import type { MetadataRoute } from "next";
// Change only when the public content changes; never claim every crawl is an update.
const contentUpdated = new Date("2026-10-25T00:00:00+02:00");
export default function sitemap(): MetadataRoute.Sitemap {
 return ["/", "/shop", ...productKeys.map(key=>`/produkte/${products[key].slug}`)].flatMap(path=>(["de","en"] as const).map(language=>({url:absoluteUrl(localizedPath(path,language)),lastModified:contentUpdated,alternates:{languages:{de:absoluteUrl(path),en:absoluteUrl(`${path}?lang=en`)} }})));
}
