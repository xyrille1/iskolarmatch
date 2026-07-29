import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// P0-03 (docs/INFRA-AUDIT-REPORT.md): notifyCronFailure is the single
// on-failure alert path all 5 cron handlers call. It must never throw --
// a broken alert channel is not allowed to mask (or crash the reporting of)
// the cron's original failure -- and it must degrade to a console.error
// signal whenever it can't actually reach an operator.

type SendResult = {
  data: { id: string } | null;
  error: { name: string; message: string } | null;
};

const { send } = vi.hoisted(() => ({
  send: vi.fn<(arg: { to: string; subject: string; text: string }) => Promise<SendResult>>(async () => ({
    data: { id: "email_123" },
    error: null,
  })),
}));

vi.mock("resend", () => ({
  // A class, not vi.fn().mockImplementation(arrowFn) -- the source calls
  // `new Resend(apiKey)`, and an arrow-function implementation throws
  // "is not a constructor" under `new` (arrow functions are never
  // constructible). Matches the class-mock convention already used for
  // PushSubscriptionExpiredError in app/api/cron/cron-routes.test.ts.
  Resend: class {
    emails = { send };
  },
}));

import { notifyCronFailure } from "./notify-cron-failure";

describe("notifyCronFailure", () => {
  const originalEnv = { ...process.env };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    send.mockResolvedValue({ data: { id: "email_123" }, error: null });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    consoleErrorSpy.mockRestore();
  });

  it("sends an alert email when RESEND_API_KEY and CRON_ALERT_EMAIL are configured", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.CRON_ALERT_EMAIL = "ops@example.com";

    await notifyCronFailure({ cron: "refresh-deadlines", reason: "Failed to load deadline cycles." });

    expect(send).toHaveBeenCalledOnce();
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("ops@example.com");
    expect(arg.subject).toContain("refresh-deadlines");
    expect(arg.text).toContain("Failed to load deadline cycles.");
  });

  it("falls back to console.error and never throws when no alert channel is configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.CRON_ALERT_EMAIL;

    await expect(
      notifyCronFailure({ cron: "send-reminders", reason: "Failed to load due reminders." })
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("send-reminders"));
  });

  it("logs but never throws when the Resend call itself fails", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.CRON_ALERT_EMAIL = "ops@example.com";
    send.mockRejectedValueOnce(new Error("network down"));

    await expect(
      notifyCronFailure({ cron: "send-digest", reason: "Failed to load digest inputs." })
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("network down"));
  });

  it("logs but never throws when Resend returns an error payload", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.CRON_ALERT_EMAIL = "ops@example.com";
    send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "invalid `to` field" } });

    await expect(
      notifyCronFailure({ cron: "watch-sources", reason: "Source-watcher run failed." })
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("invalid `to` field"));
  });
});
