import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://roseofberlin-git-main-jasongloger123-5906s-projects.vercel.app/sitemap.xml" };
}
