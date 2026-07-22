import { describe, expect, it } from "vitest";
import { computeChangeGate, hasChanges } from "./change-gate";
import { hashSection } from "./section-hash";
import type { NormalizedSection, StoredSection } from "./types";

function stored(index: number, label: string | null, text: string): StoredSection {
  return {
    id: `sec-${index}`,
    sectionIndex: index,
    headingLabel: label,
    sectionHash: hashSection(text),
    sectionText: text,
  };
}

function next(index: number, label: string | null, text: string): NormalizedSection {
  return { sectionIndex: index, headingLabel: label, text };
}

describe("computeChangeGate", () => {
  it("reports no changes when every section is identical", () => {
    const prev = [stored(0, "Overview", "A"), stored(1, "Deadline", "June 30")];
    const now = [next(0, "Overview", "A"), next(1, "Deadline", "June 30")];

    const result = computeChangeGate(prev, now);

    expect(hasChanges(result)).toBe(false);
    expect(result.unchangedCount).toBe(2);
  });

  it("flags a section whose text changed", () => {
    const prev = [stored(0, "Deadline", "June 30, 2026")];
    const now = [next(0, "Deadline", "July 30, 2026")];

    const result = computeChangeGate(prev, now);

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].previous.id).toBe("sec-0");
    expect(result.changed[0].section.text).toBe("July 30, 2026");
    expect(hasChanges(result)).toBe(true);
  });

  it("ignores whitespace-only reflow", () => {
    const prev = [stored(0, "Deadline", "June 30, 2026")];
    const now = [next(0, "Deadline", "June 30,   2026")];

    expect(hasChanges(computeChangeGate(prev, now))).toBe(false);
  });

  it("matches by heading label, so an inserted section does not falsely flag the rest", () => {
    const prev = [stored(0, "Overview", "A"), stored(1, "Deadline", "June 30")];
    // A new "Benefits" section is inserted at index 1, pushing "Deadline" to 2.
    const now = [
      next(0, "Overview", "A"),
      next(1, "Benefits", "Full tuition"),
      next(2, "Deadline", "June 30"),
    ];

    const result = computeChangeGate(prev, now);

    expect(result.added.map((s) => s.headingLabel)).toEqual(["Benefits"]);
    expect(result.changed).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.unchangedCount).toBe(2);
  });

  it("reports a removed section", () => {
    const prev = [stored(0, "Overview", "A"), stored(1, "Deadline", "June 30")];
    const now = [next(0, "Overview", "A")];

    const result = computeChangeGate(prev, now);

    expect(result.removed.map((s) => s.headingLabel)).toEqual(["Deadline"]);
  });

  it("falls back to section index for unlabeled sections", () => {
    const prev = [stored(0, null, "intro text")];
    const now = [next(0, null, "intro text changed")];

    const result = computeChangeGate(prev, now);
    expect(result.changed).toHaveLength(1);
  });
});
