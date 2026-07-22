import type { MetadataRoute } from "next";
import { getPublishedScholarships } from "@/lib/data/get-published-scholarships";
import { siteUrl } from "@/lib/site-url";

// Static public routes. Authenticated (/saved), machine (/api), and
// user-generated share (/shared) routes are intentionally excluded -- see
// robots.ts.
const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/scholarships", changeFrequency: "daily", priority: 0.9 },
  { path: "/match", changeFrequency: "monthly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/trust", changeFrequency: "weekly", priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.4 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${url}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Per-scholarship detail pages. If the data read fails (e.g. Supabase
  // unreachable at build), fall back to the static routes rather than failing
  // the whole sitemap.
  let scholarshipEntries: MetadataRoute.Sitemap = [];
  try {
    const scholarships = await getPublishedScholarships();
    scholarshipEntries = scholarships.map((s) => ({
      url: `${url}/s/${s.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    scholarshipEntries = [];
  }

  return [...staticEntries, ...scholarshipEntries];
}
