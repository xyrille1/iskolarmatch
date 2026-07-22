// Tunables for the FR10 source-watcher. The Groq model name is read from env
// (never hardcoded at call sites) because Groq's free-tier catalog changes
// over time -- a deprecation should be a one-line env change, not a code edit
// (docs plan §2). The rest are safety limits for the SSRF-guarded fetch.

// Largest current free-tier Groq model with strict JSON-Schema support at time
// of writing; override with GROQ_EXTRACTION_MODEL if the catalog changes.
// LLM_MODEL takes precedence when pointing the client at a different
// OpenAI-compatible provider (e.g. Gemini's /openai/ endpoint -> "gemini-flash-latest").
//
// Resolved lazily (a function, not a module-level const) so it reads process.env
// at call time -- the same reason the API key is read per-call. A const would be
// bound at import time, before a standalone script's .env is loaded, and pin the
// wrong model. See lib/groq/client.ts.
export function getExtractionModel(): string {
  return process.env.LLM_MODEL ?? process.env.GROQ_EXTRACTION_MODEL ?? "openai/gpt-oss-120b";
}

// Abort a fetch that takes longer than this (hung connection / slow server).
export const FETCH_TIMEOUT_MS = 15_000;

// Hard cap on downloaded bytes (zip-bomb-style PDF / runaway response defense).
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

// Redirects are followed manually so each hop can be re-validated; this caps
// the chain length.
export const MAX_REDIRECTS = 5;

// Scholarships processed per cron tick (round-robin by oldest fetch), so the
// job stays within the serverless function budget as the catalog grows.
export const WATCH_BATCH_SIZE = 10;
