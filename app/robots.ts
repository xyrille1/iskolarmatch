import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Keep private/authenticated and machine routes out of search indexes; the
// public directory (/, /scholarships, /s/*, and the info pages) stays crawlable.
export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/auth", "/saved", "/shared"],
    },
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
