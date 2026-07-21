import { describe, expect, it } from "vitest";
import { computeDeadlineStatus } from "./compute-status";

describe("computeDeadlineStatus", () => {
  it("returns upcoming when today is before opens_at", () => {
    expect(computeDeadlineStatus("2026-05-01", "2026-06-01", "2026-09-01")).toBe("upcoming");
  });

  it("returns open when today is well within the window", () => {
    expect(computeDeadlineStatus("2026-07-01", "2026-06-01", "2026-09-01")).toBe("open");
  });

  it("returns closing_soon within the 7-day window before closes_at", () => {
    expect(computeDeadlineStatus("2026-08-25", "2026-06-01", "2026-09-01")).toBe("closing_soon");
  });

  it("treats exactly 7 days out as closing_soon (boundary)", () => {
    expect(computeDeadlineStatus("2026-08-25", null, "2026-09-01")).toBe("closing_soon");
  });

  it("treats 8 days out as still open (boundary)", () => {
    expect(computeDeadlineStatus("2026-08-24", null, "2026-09-01")).toBe("open");
  });

  it("returns closed the day after closes_at", () => {
    expect(computeDeadlineStatus("2026-09-02", "2026-06-01", "2026-09-01")).toBe("closed");
  });

  it("treats closes_at itself as still open/closing_soon, not closed", () => {
    expect(computeDeadlineStatus("2026-09-01", "2026-06-01", "2026-09-01")).toBe("closing_soon");
  });

  it("handles a null opens_at as always past-open (no upcoming state)", () => {
    expect(computeDeadlineStatus("2026-01-01", null, "2026-09-01")).toBe("open");
  });
});
