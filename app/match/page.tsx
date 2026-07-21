import type { Metadata } from "next";
import { MatchExperience } from "@/components/match/match-experience";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "Find your scholarships — IskolarMatch",
};

export default function MatchPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <MatchExperience />
      </main>
      <SiteFooter />
    </>
  );
}
