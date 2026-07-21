import { describe, expect, it } from "vitest";
import { isNearingOrPastStaleness, STALENESS_WORKLIST_LEAD_DAYS } from "./staleness";
import { VERIFIED_STALENESS_DAYS } from "./verified-eyebrow";

describe("isNearingOrPastStaleness", () => {
  it("treats a never-verified record as needing attention", () => {
    expect(isNearingOrPastStaleness(null)).toBe(true);
  });

  it("is false well before the threshold", () => {
    expect(isNearingOrPastStaleness(0)).toBe(false);
  });

  it("is true exactly at the lead-in boundary", () => {
    expect(isNearingOrPastStaleness(VERIFIED_STALENESS_DAYS - STALENESS_WORKLIST_LEAD_DAYS)).toBe(true);
  });

  it("is false one day before the lead-in boundary", () => {
    expect(isNearingOrPastStaleness(VERIFIED_STALENESS_DAYS - STALENESS_WORKLIST_LEAD_DAYS - 1)).toBe(false);
  });

  it("is true well past the threshold", () => {
    expect(isNearingOrPastStaleness(VERIFIED_STALENESS_DAYS + 30)).toBe(true);
  });
});
