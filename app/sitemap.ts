import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://roseofberlin-git-main-jasongloger123-5906s-projects.vercel.app", lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
