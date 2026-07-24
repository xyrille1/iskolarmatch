import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Baseline tests (docs/QA-CHECKLIST.md P1-07) for the two anon-facing write
// actions -- both are rate-limited Server Actions using the service-role /
// anon client (never a client-side RLS write). Each returns a state object
// rather than throwing, so we assert the returned status.

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4 })) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => "1.2.3.4" })) }));

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => mockClient) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: vi.fn(() => mockClient) }));

import { submitScholarshipReport } from "./reports";
import { submitProfileForm } from "./match-profile";

function reportForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
});

describe("submitScholarshipReport (FR13, anon write)", () => {
  it("inserts a valid report (happy path)", async () => {
    mockClient = createMockSupabase({ tables: { scholarship_reports: [{ error: null }] } });
    const res = await submitScholarshipReport({ status: "idle" }, reportForm({ scholarship_id: "sch-1", reason: "broken_link" }));
    expect(res.status).toBe("success");
  });

  it("rejects a payload with no valid reason", async () => {
    mockClient = createMockSupabase({});
    const res = await submitScholarshipReport({ status: "idle" }, reportForm({ scholarship_id: "sch-1", reason: "nonsense" }));
    expect(res.status).toBe("error");
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("rejects when rate-limited before touching the DB", async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0 });
    mockClient = createMockSupabase({});
    const res = await submitScholarshipReport({ status: "idle" }, reportForm({ scholarship_id: "sch-1", reason: "other" }));
    expect(res.status).toBe("error");
    expect(res.formError).toMatch(/too many requests/i);
    expect(mockClient.from).not.toHaveBeenCalled();
  });
});

describe("submitProfileForm (FR1/FR2, anon match)", () => {
  it("returns matches for a valid profile (happy path)", async () => {
    mockClient = createMockSupabase({ tables: { scholarships: [{ data: [], error: null }] } });
    const res = await submitProfileForm({ status: "idle" }, reportForm({ education_level: "college" }));
    expect(res.status).toBe("success");
    expect(res.results).toBeDefined();
  });

  it("rejects an out-of-range GWA before hitting the DB", async () => {
    mockClient = createMockSupabase({});
    const res = await submitProfileForm({ status: "idle" }, reportForm({ education_level: "college", gwa: "150" }));
    expect(res.status).toBe("error");
    expect(res.fieldErrors?.gwa).toMatch(/between 0 and 100/i);
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("rejects when rate-limited", async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0 });
    mockClient = createMockSupabase({});
    const res = await submitProfileForm({ status: "idle" }, reportForm({ education_level: "college" }));
    expect(res.status).toBe("error");
    expect(res.formError).toMatch(/too many requests/i);
  });
});
