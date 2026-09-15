import { metadataBaseUrl } from "../lib/site-url";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: metadataBaseUrl(), lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
