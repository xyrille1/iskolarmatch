import { describe, expect, it } from "vitest";
import { hashDocument, hashSection, normalizeForHashing } from "./section-hash";

describe("normalizeForHashing", () => {
  it("collapses runs of whitespace to a single space", () => {
    expect(normalizeForHashing("a   b\n\tc")).toBe("a b c");
  });
  it("trims leading and trailing whitespace", () => {
    expect(normalizeForHashing("  hello  ")).toBe("hello");
  });
});

describe("hashSection", () => {
  it("hashes identical text identically", () => {
    expect(hashSection("Deadline: June 30, 2026")).toBe(hashSection("Deadline: June 30, 2026"));
  });
  it("ignores whitespace-only differences", () => {
    expect(hashSection("Deadline:  June 30,\n2026")).toBe(hashSection("Deadline: June 30, 2026"));
  });
  it("changes when the actual text changes", () => {
    expect(hashSection("Deadline: June 30, 2026")).not.toBe(hashSection("Deadline: July 30, 2026"));
  });
});

describe("hashDocument", () => {
  it("is stable for the same section-hash sequence", () => {
    const hashes = [hashSection("a"), hashSection("b")];
    expect(hashDocument(hashes)).toBe(hashDocument([...hashes]));
  });
  it("differs when any section changes", () => {
    const before = [hashSection("a"), hashSection("b")];
    const after = [hashSection("a"), hashSection("b2")];
    expect(hashDocument(before)).not.toBe(hashDocument(after));
  });
  it("is order-sensitive", () => {
    const a = hashSection("a");
    const b = hashSection("b");
    expect(hashDocument([a, b])).not.toBe(hashDocument([b, a]));
  });
});
