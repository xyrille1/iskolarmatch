import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("CHED Merit Scholarship")).toBe("ched-merit-scholarship");
  });

  it("drops punctuation and collapses separators", () => {
    expect(slugify("Iskolar ng Bayan (2026)!!")).toBe("iskolar-ng-bayan-2026");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Grant--  ")).toBe("grant");
  });

  it("strips diacritics", () => {
    expect(slugify("Ñoño Foundation Grant")).toBe("nono-foundation-grant");
  });

  it("always matches the scholarship slug pattern", () => {
    const out = slugify("DOST-SEI: Undergraduate & Merit Award #1");
    expect(out).toMatch(/^[a-z0-9-]+$/);
  });
});
