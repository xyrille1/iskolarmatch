import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// P1-06: FR22 discovery orchestrator control-flow, fully mocked (no network,
// no LLM, no real hashing). Asserts three invariants:
//   - an unchanged index page (content hash matches) skips the LLM entirely;
//   - the per-run detail-page budget caps how many pages are fetched;
//   - the seenKeys dedupe set prevents re-filing a URL we already have.

const { fetchSource, normalizeHtml, extractAnchors, selectScholarshipLinks, extractCandidate, scoreCandidate, hashDocument, hashSection, robotsRulesFor, isPathAllowed } =
  vi.hoisted(() => ({
    fetchSource: vi.fn(),
    normalizeHtml: vi.fn(),
    extractAnchors: vi.fn(() => [{ href: "https://ched.gov.ph/list", text: "list" }]),
    selectScholarshipLinks: vi.fn(),
    extractCandidate: vi.fn(),
    scoreCandidate: vi.fn(() => "high"),
    hashDocument: vi.fn(() => "CONTENT_HASH"),
    hashSection: vi.fn(() => "sec"),
    robotsRulesFor: vi.fn(async () => ({ crawlDelaySeconds: undefined, disallow: [], allow: [] })),
    isPathAllowed: vi.fn(() => true),
  }));

vi.mock("@/lib/source-watcher/fetch-source", () => ({ fetchSource }));
vi.mock("@/lib/source-watcher/normalize-html", () => ({ normalizeHtml }));
vi.mock("@/lib/source-watcher/normalize-pdf", () => ({ normalizePdf: vi.fn() }));
vi.mock("@/lib/source-watcher/section-hash", () => ({ hashDocument, hashSection }));
vi.mock("./extract-anchors", () => ({ extractAnchors }));
vi.mock("./select-listing", () => ({ selectScholarshipLinks }));
vi.mock("./extract-candidate", () => ({ extractCandidate }));
vi.mock("./score-candidate", () => ({ scoreCandidate }));
vi.mock("./robots", () => ({ robotsRulesFor, isPathAllowed }));
// Zero crawl delay so the test doesn't actually sleep between fetches.
vi.mock("./config", () => ({
  DISCOVER_INDEX_BATCH_SIZE: 3,
  DISCOVER_MAX_DETAIL_PAGES_PER_RUN: 2,
  DISCOVER_CRAWL_DELAY_MS: 0,
  MAX_CRAWL_DELAY_MS: 0,
}));

import { runSourceDiscovery } from "./run-discovery";

function indexPage(lastHash: string | null) {
  return { id: "page-1", index_url: "https://ched.gov.ph/list", last_content_hash: lastHash, last_crawled_at: null };
}

function htmlFetch(url: string) {
  return { ok: true, sourceKind: "html", body: Buffer.from("<html>"), finalUrl: url, httpStatus: 200 };
}

function candidateDraft() {
  return {
    title: "A Scholarship",
    summary: null,
    coverage_type: "full",
    benefit_summary: null,
    provider_name: null,
    application_url: null,
    deadline_closes_at: null,
    deadline_academic_year: null,
    eligibility_notes: [],
    requirement_labels: [],
  };
}

let mockClient: MockSupabase;

beforeEach(() => {
  vi.clearAllMocks();
  scoreCandidate.mockReturnValue("high");
  hashDocument.mockReturnValue("CONTENT_HASH");
  robotsRulesFor.mockResolvedValue({ crawlDelaySeconds: undefined, disallow: [], allow: [] });
  isPathAllowed.mockReturnValue(true);
  normalizeHtml.mockReturnValue([{ sectionIndex: 0, headingLabel: "H", text: "text" }]);
  extractCandidate.mockResolvedValue(candidateDraft());
  fetchSource.mockImplementation(async (url: string) => htmlFetch(url));
});

describe("runSourceDiscovery (orchestrator control-flow)", () => {
  it("skips the LLM when the index page's content hash is unchanged", async () => {
    // page.last_content_hash matches the (mocked) hashDocument value.
    mockClient = createMockSupabase({
      tables: {
        source_index_pages: [{ data: [indexPage("CONTENT_HASH")], error: null }, { data: null, error: null }],
        scholarships: [{ data: [], error: null }],
        scholarship_candidates: [{ data: [], error: null }],
      },
    });

    const summary = await runSourceDiscovery(mockClient as never);

    expect(selectScholarshipLinks).not.toHaveBeenCalled();
    expect(extractCandidate).not.toHaveBeenCalled();
    expect(summary.candidatesCreated).toBe(0);
    // Only the index page itself was fetched; no detail pages.
    expect(summary.detailPagesFetched).toBe(0);
  });

  it("caps detail-page fetches at the per-run budget", async () => {
    selectScholarshipLinks.mockResolvedValue([
      { href: "https://ched.gov.ph/a", text: "A" },
      { href: "https://ched.gov.ph/b", text: "B" },
      { href: "https://ched.gov.ph/c", text: "C" },
      { href: "https://ched.gov.ph/d", text: "D" },
      { href: "https://ched.gov.ph/e", text: "E" },
    ]);

    mockClient = createMockSupabase({
      tables: {
        source_index_pages: [{ data: [indexPage("OLD_HASH")], error: null }, { data: null, error: null }],
        scholarships: [{ data: [], error: null }],
        // seenKeys read + up to 2 candidate inserts (budget = 2).
        scholarship_candidates: [{ data: [], error: null }, { error: null }, { error: null }],
      },
    });

    const summary = await runSourceDiscovery(mockClient as never);

    // Budget is 2 -> only 2 detail pages fetched despite 5 selected links.
    expect(summary.detailPagesFetched).toBe(2);
    expect(summary.candidatesCreated).toBe(2);
    expect(extractCandidate).toHaveBeenCalledTimes(2);
  });

  it("skips a link already present via the seenKeys dedupe set", async () => {
    selectScholarshipLinks.mockResolvedValue([
      { href: "https://ched.gov.ph/a", text: "A" },
      { href: "https://ched.gov.ph/b", text: "B" },
    ]);

    mockClient = createMockSupabase({
      tables: {
        source_index_pages: [{ data: [indexPage("OLD_HASH")], error: null }, { data: null, error: null }],
        // An existing scholarship whose official_url normalizes to link A's key,
        // so A is a known duplicate and must be skipped without a fetch.
        scholarships: [{ data: [{ official_url: "https://ched.gov.ph/a" }], error: null }],
        scholarship_candidates: [{ data: [], error: null }, { error: null }],
      },
    });

    const summary = await runSourceDiscovery(mockClient as never);

    expect(summary.duplicatesSkipped).toBeGreaterThanOrEqual(1);
    // Only link B was actually fetched as a detail page.
    expect(summary.detailPagesFetched).toBe(1);
    expect(summary.candidatesCreated).toBe(1);
  });
});
