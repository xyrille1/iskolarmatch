import { beforeEach, describe, expect, it, vi } from "vitest";

// Baseline tests (docs/QA-CHECKLIST.md P1-07) for the magic-link action:
// happy path sends an OTP with a same-site redirect, a bad email is rejected,
// a crafted `next` can't open-redirect off-site, and rate-limiting short-
// circuits before sending.

const { checkRateLimit, signInWithOtp } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4 })),
  signInWithOtp: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => "1.2.3.4" })) }));
vi.mock("@/lib/site-url", () => ({ siteUrl: () => "https://iskolarmatch.app" }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithOtp } })),
}));

import { requestMagicLink } from "./auth";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("requestMagicLink", () => {
  it("sends an OTP for a valid email (happy path)", async () => {
    const res = await requestMagicLink({ status: "idle" }, form({ email: "iskolar@example.com", next: "/saved" }));
    expect(res.status).toBe("sent");
    expect(signInWithOtp).toHaveBeenCalledOnce();
    const arg = (signInWithOtp.mock.calls[0] as unknown[])[0] as { email: string; options: { emailRedirectTo: string } };
    expect(arg.email).toBe("iskolar@example.com");
    expect(arg.options.emailRedirectTo).toContain("/auth/confirm?next=%2Fsaved");
  });

  it("rejects an invalid email without sending", async () => {
    const res = await requestMagicLink({ status: "idle" }, form({ email: "not-an-email" }));
    expect(res.status).toBe("error");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("sanitizes an off-site `next` to a safe default (no open redirect)", async () => {
    await requestMagicLink({ status: "idle" }, form({ email: "iskolar@example.com", next: "//evil.com/phish" }));
    const arg = (signInWithOtp.mock.calls[0] as unknown[])[0] as { options: { emailRedirectTo: string } };
    // The protocol-relative //evil.com must not survive into the redirect.
    expect(arg.options.emailRedirectTo).toContain("next=%2Fsaved");
    expect(arg.options.emailRedirectTo).not.toContain("evil.com");
  });

  it("short-circuits when rate-limited", async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await requestMagicLink({ status: "idle" }, form({ email: "iskolar@example.com" }));
    expect(res.status).toBe("error");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
