import { describe, expect, it } from "vitest";
import { normalizeDetailUrl, sameDetailUrl } from "./dedupe";

describe("normalizeDetailUrl", () => {
  it("lowercases host and strips www, port, query, fragment, trailing slash", () => {
    expect(normalizeDetailUrl("https://WWW.Up.PHINMA.edu.ph:443/Scholarships/?x=1#top")).toBe("up.phinma.edu.ph/Scholarships");
  });

  it("collapses www and non-www to the same key", () => {
    expect(sameDetailUrl("https://up.phinma.edu.ph/a/b", "https://www.up.phinma.edu.ph/a/b/")).toBe(true);
  });

  it("keeps the path case-sensitive", () => {
    expect(sameDetailUrl("https://ched.gov.ph/Grant", "https://ched.gov.ph/grant")).toBe(false);
  });

  it("normalizes a bare origin to a single slash", () => {
    expect(normalizeDetailUrl("https://ched.gov.ph")).toBe("ched.gov.ph/");
  });

  it("returns null for an unparseable URL", () => {
    expect(normalizeDetailUrl("not a url")).toBeNull();
    expect(sameDetailUrl("not a url", "also not")).toBe(false);
  });
});
