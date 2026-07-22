import { hashSection } from "./section-hash";
import type { NormalizedSection, StoredSection } from "./types";

// Deterministic diff between the previously-stored sections of a source and
// the freshly-normalized sections of a new fetch. Pure and I/O-free -- this is
// the cost-control heart of the watcher: if nothing changed, the caller skips
// the LLM call entirely.
//
// Matching strategy: prefer heading_label (stable across inserts elsewhere in
// the doc), fall back to section_index only for unlabeled sections. This means
// inserting a new section near the top doesn't falsely flag every section
// below it as "changed" just because their indices shifted.

export interface ChangeGateResult {
  changed: ChangedSection[];
  added: NormalizedSection[];
  removed: StoredSection[];
  unchangedCount: number;
}

export interface ChangedSection {
  section: NormalizedSection;
  previous: StoredSection;
}

export function hasChanges(result: ChangeGateResult): boolean {
  return result.changed.length > 0 || result.added.length > 0 || result.removed.length > 0;
}

function keyOf(labelOrIndex: { headingLabel: string | null; sectionIndex: number }): string {
  return labelOrIndex.headingLabel !== null
    ? `label:${labelOrIndex.headingLabel.trim().toLowerCase()}`
    : `index:${labelOrIndex.sectionIndex}`;
}

export function computeChangeGate(
  previous: StoredSection[],
  next: NormalizedSection[]
): ChangeGateResult {
  const previousByKey = new Map<string, StoredSection>();
  for (const p of previous) {
    // If two previous sections collapse to the same key (e.g. duplicate
    // headings), the first wins; the second falls through to "removed", which
    // is the safe direction (surfaces rather than hides a change).
    const key = keyOf(p);
    if (!previousByKey.has(key)) previousByKey.set(key, p);
  }

  const changed: ChangedSection[] = [];
  const added: NormalizedSection[] = [];
  let unchangedCount = 0;
  const matchedKeys = new Set<string>();

  for (const section of next) {
    const key = keyOf(section);
    const prev = previousByKey.get(key);

    if (!prev) {
      added.push(section);
      continue;
    }

    matchedKeys.add(key);
    if (hashSection(section.text) === prev.sectionHash) {
      unchangedCount += 1;
    } else {
      changed.push({ section, previous: prev });
    }
  }

  const removed = previous.filter((p) => !matchedKeys.has(keyOf(p)));

  return { changed, added, removed, unchangedCount };
}
