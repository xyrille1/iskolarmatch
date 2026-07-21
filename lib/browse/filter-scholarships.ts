import type { BrowseScholarshipItem } from "@/lib/data/get-published-scholarships";

export interface BrowseFilters {
  coverageType?: string;
  providerType?: string;
  region?: string;
  status?: string;
  q?: string;
}

// Pure, unit-tested filter over already-fetched published scholarships
// (FR17, docs/PRD.md §4.2). Kept separate from lib/data/get-published-scholarships.ts
// (the DB read) so filtering logic is testable without mocking supabase-js,
// mirroring lib/matching/build-scholarship-matches.ts's pure/impure split.
export function filterScholarships(items: BrowseScholarshipItem[], filters: BrowseFilters): BrowseScholarshipItem[] {
  return items.filter((item) => {
    if (filters.coverageType && item.coverageType !== filters.coverageType) return false;
    if (filters.providerType && item.providerType !== filters.providerType) return false;
    if (filters.status && item.status !== filters.status) return false;
    // A scholarship with no region rule is open to every region -- only
    // exclude it when it HAS regions listed and the filter isn't one of them.
    if (filters.region && item.regions.length > 0 && !item.regions.includes(filters.region)) return false;
    if (filters.q) {
      const q = filters.q.trim().toLowerCase();
      if (q) {
        const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });
}
