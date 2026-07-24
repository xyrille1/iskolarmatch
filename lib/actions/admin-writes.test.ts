import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Baseline tests (docs/QA-CHECKLIST.md P1-07) for the admin writes: each must
// pass through requireAdmin(), validate with Zod, and audit-log. Asserts a
// happy path, a validation rejection, and a non-admin rejection.

const { requireAdmin, logAudit } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", __brand: "AdminContext" as const })),
  logAudit: vi.fn(async () => {}),
}));

let mockClient: MockSupabase;
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin }));
vi.mock("@/lib/actions/log-audit", () => ({ logAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => mockClient) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { upsertScholarship } from "./admin";
import { addSourceIndexPage } from "./source-pages";

const VALID_SCHOLARSHIP = {
  provider_id: "prov-1",
  title: "CHED Merit",
  slug: "ched-merit",
  coverage_type: "full" as const,
  official_url: "https://ched.gov.ph/merit",
  is_published: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ userId: "admin-1", __brand: "AdminContext" });
});

describe("upsertScholarship", () => {
  it("inserts a valid draft and audit-logs it (happy path)", async () => {
    mockClient = createMockSupabase({ tables: { scholarships: [{ data: { id: "new-1" }, error: null }] } });

    await expect(upsertScholarship(VALID_SCHOLARSHIP)).resolves.toEqual({ id: "new-1" });
    expect(logAudit).toHaveBeenCalledWith("admin-1", "create", "scholarship", "new-1", expect.any(Object));
  });

  it("rejects an off-allowlist official_url (Zod validation)", async () => {
    mockClient = createMockSupabase({});
    await expect(
      upsertScholarship({ ...VALID_SCHOLARSHIP, official_url: "https://evil.example.com/x" })
    ).rejects.toThrow();
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("rejects publishing without a verification date (publish guard)", async () => {
    mockClient = createMockSupabase({});
    await expect(
      upsertScholarship({ ...VALID_SCHOLARSHIP, is_published: true, last_verified_at: null })
    ).rejects.toThrow();
  });

  it("rejects a non-admin caller", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("REDIRECT:/"));
    mockClient = createMockSupabase({});
    await expect(upsertScholarship(VALID_SCHOLARSHIP)).rejects.toThrow(/REDIRECT/);
  });
});

describe("addSourceIndexPage", () => {
  it("registers a valid allowlisted index page (happy path)", async () => {
    mockClient = createMockSupabase({ tables: { source_index_pages: [{ data: { id: "sp-1" }, error: null }] } });

    await expect(
      addSourceIndexPage({ index_url: "https://ched.gov.ph/scholarships", provider_id: "", label: "CHED" })
    ).resolves.toBeUndefined();
    expect(logAudit).toHaveBeenCalledWith("admin-1", "create", "source_index_page", "sp-1", expect.any(Object));
  });

  it("rejects an off-allowlist index_url before any DB call", async () => {
    mockClient = createMockSupabase({});
    await expect(addSourceIndexPage({ index_url: "https://evil.example.com", provider_id: "" })).rejects.toThrow();
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("surfaces a friendly message on a duplicate (23505)", async () => {
    mockClient = createMockSupabase({
      tables: { source_index_pages: [{ data: null, error: { code: "23505", message: "dupe" } }] },
    });
    await expect(
      addSourceIndexPage({ index_url: "https://ched.gov.ph/scholarships", provider_id: "" })
    ).rejects.toThrow(/already registered/i);
  });

  it("rejects a non-admin caller", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("REDIRECT:/"));
    mockClient = createMockSupabase({});
    await expect(addSourceIndexPage({ index_url: "https://ched.gov.ph/x", provider_id: "" })).rejects.toThrow(/REDIRECT/);
  });
});
