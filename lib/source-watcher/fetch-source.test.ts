import { afterEach, describe, expect, it, vi } from "vitest";

// DNS is mocked to a public address so these tests are deterministic offline --
// the allowlist + private-IP layers are exercised via the URL/host, not real
// resolution. global fetch is stubbed so no real HTTP happens either.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { fetchSource } from "./fetch-source";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchSource", () => {
  it("rejects a non-allowlisted host before any fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchSource("https://evil.example.com/page");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/allowlist/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-HTTPS URL", async () => {
    const result = await fetchSource("http://ched.gov.ph/page");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/non-HTTPS/i);
  });

  it("rejects a malformed URL", async () => {
    const result = await fetchSource("not a url");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/malformed/i);
  });

  it("returns a typed failure (never throws) on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 }))
    );

    const result = await fetchSource("https://ched.gov.ph/missing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(404);
      expect(result.error).toMatch(/404/);
    }
  });

  it("aborts and fails when the body exceeds the byte cap", async () => {
    // 6 MB > MAX_RESPONSE_BYTES (5 MB).
    const huge = new Uint8Array(6 * 1024 * 1024);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(huge, {
            status: 200,
            headers: { "content-type": "text/html" },
          })
      )
    );

    const result = await fetchSource("https://ched.gov.ph/huge");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/exceeded/i);
  });

  it("returns the body and inferred kind on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html><body>hi</body></html>", {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          })
      )
    );

    const result = await fetchSource("https://ched.gov.ph/ok");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sourceKind).toBe("html");
      expect(result.body.toString("utf-8")).toContain("hi");
      expect(result.httpStatus).toBe(200);
    }
  });
});
