import type { MetadataRoute } from "next";

// Web app manifest -- completes the PWA story alongside the existing service
// worker (public/sw.js) and push-notification opt-in. Monochrome to match the
// editorial palette; the SVG mark stays byte-light and scales cleanly.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IskolarMatch",
    short_name: "IskolarMatch",
    description:
      "Find CHED, DOST-SEI, and local scholarships you actually qualify for -- verified, deadline-tracked, built for Filipino students.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    // Matches app/layout.tsx's viewport.themeColor -- kept in agreement
    // deliberately (docs/QA-CHECKLIST.md P2-07).
    theme_color: "#ffffff",
    lang: "en-PH",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
