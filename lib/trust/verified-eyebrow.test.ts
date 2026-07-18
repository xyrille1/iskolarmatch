import { describe, expect, it, vi } from "vitest";
import { verifiedEyebrowLabel } from "./verified-eyebrow";

describe("verifiedEyebrowLabel", () => {
  it("returns CONFIRM ON OFFICIAL SITE when never verified", () => {
    expect(verifiedEyebrowLabel(null)).toBe("CONFIRM ON OFFICIAL SITE");
  });

  it("returns a VERIFIED stamp within the staleness threshold", () => {
    vi.setSystemTime(new Date("2026-07-18T00:00:00Z"));
    expect(verifiedEyebrowLabel("2026-07-01T00:00:00Z")).toBe("VERIFIED JUL 1, 2026");
    vi.useRealTimers();
  });

  it("flips to CONFIRM ON OFFICIAL SITE past the 60-day staleness threshold", () => {
    vi.setSystemTime(new Date("2026-07-18T00:00:00Z"));
    expect(verifiedEyebrowLabel("2026-04-01T00:00:00Z")).toBe("CONFIRM ON OFFICIAL SITE");
    vi.useRealTimers();
  });
});
