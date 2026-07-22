/*
 * Extraction eval runner (docs plan §3). NOT part of `npm run test`/CI: it
 * makes real Groq calls (tokens) and is non-deterministic, so it stays opt-in.
 *
 *   GROQ_API_KEY=... npm run eval:source-watcher
 *
 * Reports precision/recall of the extraction+diff pipeline against the golden
 * set, so extraction quality can be tracked over time as the model/prompt
 * change. It exercises the real runExtraction() path end-to-end (minus the
 * fetch/normalize front half, which the golden set stands in for).
 */
import { loadEnvConfig } from "@next/env";
import { runExtraction } from "../run-extraction";
import { GOLDEN_SET } from "./golden-set";

// Standalone tsx script: unlike `next dev`, nothing auto-loads .env.local here.
// Load it the same way Next does. Safe before the import above because the
// extraction client reads its API key lazily (per call), not at import time.
loadEnvConfig(process.cwd());

function norm(value: unknown): string {
  if (typeof value === "string") return value.trim().toLowerCase();
  return String(value);
}

async function main(): Promise<void> {
  if (!process.env.LLM_API_KEY && !process.env.GROQ_API_KEY) {
    console.error("LLM_API_KEY or GROQ_API_KEY is not set. Set it to run the extraction eval.");
    process.exit(1);
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const testCase of GOLDEN_SET) {
    const proposals = await runExtraction(testCase.record, testCase.changedSections);

    const got = proposals.map((p) => `${p.targetTable}.${p.targetField}=${norm(p.newValue)}`);
    const want = testCase.expected.map((e) => `${e.table}.${e.field}=${norm(e.value)}`);

    const gotSet = new Set(got);
    const wantSet = new Set(want);

    const matched = [...wantSet].filter((w) => gotSet.has(w));
    const missed = [...wantSet].filter((w) => !gotSet.has(w));
    const extra = [...gotSet].filter((g) => !wantSet.has(g));

    truePositives += matched.length;
    falseNegatives += missed.length;
    falsePositives += extra.length;

    const status = missed.length === 0 && extra.length === 0 ? "PASS" : "DIFF";
    console.log(`\n[${status}] ${testCase.name}`);
    if (missed.length) console.log(`  missed:   ${missed.join(", ")}`);
    if (extra.length) console.log(`  spurious: ${extra.join(", ")}`);
    if (status === "PASS") console.log(`  ok (${matched.length} expected diff(s))`);
  }

  const precision = truePositives / (truePositives + falsePositives || 1);
  const recall = truePositives / (truePositives + falseNegatives || 1);

  console.log("\n=== Extraction eval summary ===");
  console.log(`  true positives:  ${truePositives}`);
  console.log(`  false positives: ${falsePositives}`);
  console.log(`  false negatives: ${falseNegatives}`);
  console.log(`  precision:       ${(precision * 100).toFixed(1)}%`);
  console.log(`  recall:          ${(recall * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
