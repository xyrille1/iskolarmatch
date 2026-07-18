import type { Metadata } from "next";
import { MatchExperience } from "@/components/match/match-experience";

export const metadata: Metadata = {
  title: "Find your scholarships — IskolarMatch",
};

export default function MatchPage() {
  return <MatchExperience />;
}
