import { createHash } from "node:crypto";

// Deterministic content hashing for the change-gate. Pure and I/O-free so it
// unit-tests exactly like lib/matching/*. Whitespace is normalized before
// hashing so cosmetic reflow (extra spaces, reindented HTML) doesn't register
// as a real content change and trigger a needless LLM call.

export function normalizeForHashing(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function hashSection(text: string): string {
  return createHash("sha256").update(normalizeForHashing(text)).digest("hex");
}

// Whole-document hash = hash of the joined section hashes. Gives the cron a
// fast "nothing changed at all" short-circuit before any per-section diffing.
export function hashDocument(sectionHashes: string[]): string {
  return createHash("sha256").update(sectionHashes.join("\n")).digest("hex");
}
