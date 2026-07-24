import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runStructuredExtraction } from "./client";

// P1-06: the LLM client boundary. Deterministic, network mocked -- asserts it
// fails closed without a key, sends an authenticated request, returns the raw
// content for the caller to Zod-validate, and throws on a non-OK / empty
// response (so the orchestrators' try/catch can fail-safe).

const ARGS = {
  systemPrompt: "sys",
  userPrompt: "user",
  jsonSchema: { name: "x", schema: { type: "object" }, strict: true },
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.LLM_API_KEY = "test-key";
  delete process.env.GROQ_API_KEY;
  delete process.env.LLM_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.LLM_API_KEY;
  vi.restoreAllMocks();
});

describe("runStructuredExtraction", () => {
  it("throws (fails closed) when no API key is configured", async () => {
    delete process.env.LLM_API_KEY;
    await expect(runStructuredExtraction(ARGS)).rejects.toThrow(/API_KEY must be set/i);
  });

  it("sends an authenticated request and returns the raw content", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"candidates":[]}' } }] }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runStructuredExtraction(ARGS);
    expect(result).toBe('{"candidates":[]}');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("throws on a non-OK response", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    })) as unknown as typeof fetch;

    await expect(runStructuredExtraction(ARGS)).rejects.toThrow(/failed: 429/i);
  });

  it("throws on an empty completion", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    })) as unknown as typeof fetch;

    await expect(runStructuredExtraction(ARGS)).rejects.toThrow(/empty response/i);
  });
});
