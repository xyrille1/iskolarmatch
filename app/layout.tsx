import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AppBootSplash } from "@/components/layout/app-boot-splash";
import { siteUrl } from "@/lib/site-url";

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const description =
  "IskolarMatch matches Filipino students to CHED, DOST-SEI, and local scholarships they actually qualify for, then tracks the deadlines.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "IskolarMatch — Find scholarships you actually qualify for",
  description,
  applicationName: "IskolarMatch",
  keywords: [
    "scholarships",
    "Philippines",
    "Filipino students",
    "CHED",
    "DOST-SEI",
    "UniFAST",
    "financial aid",
    "college scholarships",
  ],
  authors: [{ name: "IskolarMatch" }],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "IskolarMatch",
    title: "IskolarMatch — Find scholarships you actually qualify for",
    description,
    url: siteUrl(),
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "IskolarMatch — Find scholarships you actually qualify for",
    description,
  },
  appleWebApp: { capable: true, title: "IskolarMatch", statusBarStyle: "default" },
};

// Matches app/manifest.ts's theme_color -- browser-chrome and installed-PWA
// chrome must agree (docs/QA-CHECKLIST.md P2-07). #ffffff (--paper) rather
// than the dark --ink/--noir tone since every page's dominant background is
// the light "paper" surface; the dark noir moment stays scoped to the footer.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        <AppBootSplash />
        {children}
      </body>
    </html>
  );
}
