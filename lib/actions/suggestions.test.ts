import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Trust-boundary tests (docs/QA-CHECKLIST.md P0-02) for the FR10 suggestion
// approval gate:
//   (a) approval routes a field change through the SAME validated admin action
//       a curator uses by hand (upsertScholarship), never a raw write;
//   (b) the optimistic-concurrency assertUnchanged guard refuses a stale write;
//   (c) the field-allowlist blocks a non-allowlisted target_field;
//   plus: only 'pending' suggestions apply, only update_field is auto-appliable,
//   and a non-admin caller is refused.
// All external effects are mocked; no network/DB.

// Hoisted so these mocks exist before vi.mock's (hoisted) factories reference
// them -- a plain top-level const would be in the temporal dead zone at
// factory-eval time.
const { admin, logAudit, requireAdmin } = vi.hoisted(() => ({
  admin: {
    markVerified: vi.fn(async () => {}),
    updateDeadlineCycle: vi.fn(async () => {}),
    updateEligibilityRule: vi.fn(async () => {}),
    updateRequirement: vi.fn(async () => {}),
    upsertScholarship: vi.fn(async () => ({ id: "sch1" })),
  },
  logAudit: vi.fn(async () => {}),
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", __brand: "AdminContext" as const })),
}));

vi.mock("@/lib/actions/admin", () => admin);
vi.mock("@/lib/actions/log-audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin }));

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => mockClient),
}));

import { approveSuggestion } from "./suggestions";

const SCH_ROW = {
  id: "sch1",
  provider_id: "prov1",
  title: "CHED Merit",
  slug: "ched-merit",
  summary: "s",
  description: "d",
  coverage_type: "partial",
  benefit_summary: "Old benefit",
  official_url: "https://ched.gov.ph/x",
  application_url: "https://ched.gov.ph/x/apply",
  is_published: true,
  last_verified_at: "2026-01-01T00:00:00.000Z",
};

function scholarshipSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "sug1",
    scholarship_id: "sch1",
    target_table: "scholarships",
    target_row_id: "sch1",
    target_field: "benefit_summary",
    change_kind: "update_field",
    old_value: "Old benefit",
    new_value: "New benefit",
    status: "pending",
    ...overrides,
  };
}

describe("approveSuggestion (trust boundary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ userId: "admin-1", __brand: "AdminContext" });
    admin.upsertScholarship.mockResolvedValue({ id: "sch1" });
  });

  it("(a) routes the change through the validated upsertScholarship action, then re-verifies", async () => {
    mockClient = createMockSupabase({
      tables: {
        scholarship_suggestions: [
          { data: scholarshipSuggestion(), error: null }, // load suggestion
          { data: null, error: null }, // status update
        ],
        scholarships: [
          { data: SCH_ROW, error: null }, // load current row
          { data: { slug: "ched-merit" }, error: null }, // slug lookup for revalidate
        ],
      },
    });

    await approveSuggestion("sug1");

    // Routed through the real admin action, carrying the overridden field on an
    // otherwise-current, already-valid payload -- nothing bypasses its Zod +
    // URL-allowlist + publish guard.
    expect(admin.upsertScholarship).toHaveBeenCalledTimes(1);
    const payload = (admin.upsertScholarship.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload.benefit_summary).toBe("New benefit");
    expect(payload.id).toBe("sch1");
    expect(payload.official_url).toBe(SCH_ROW.official_url);

    // Approval is itself a re-verification (FR9) and is audit-logged.
    expect(admin.markVerified).toHaveBeenCalledWith("sch1");
    expect(logAudit).toHaveBeenCalledWith(
      "admin-1",
      "approve_suggestion",
      "scholarship_suggestion",
      "sug1",
      expect.objectContaining({ target_field: "benefit_summary", new_value: "New benefit" })
    );
  });

  it("(b) refuses a stale write when the live value drifted from old_value", async () => {
    mockClient = createMockSupabase({
      tables: {
        scholarship_suggestions: [{ data: scholarshipSuggestion(), error: null }],
        // Live benefit_summary no longer equals the suggestion's recorded old_value.
        scholarships: [{ data: { ...SCH_ROW, benefit_summary: "Curator already changed this" }, error: null }],
      },
    });

    await expect(approveSuggestion("sug1")).rejects.toThrow(/changed since the suggestion was filed/i);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
    expect(admin.markVerified).not.toHaveBeenCalled();
  });

  it("(c) blocks a non-allowlisted target_field before any write", async () => {
    mockClient = createMockSupabase({
      tables: {
        // is_published is not in ALLOWED_FIELDS_BY_TABLE.scholarships.
        scholarship_suggestions: [
          { data: scholarshipSuggestion({ target_field: "is_published", old_value: true, new_value: false }), error: null },
        ],
      },
    });

    await expect(approveSuggestion("sug1")).rejects.toThrow(/not approvable/i);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
  });

  it("refuses a suggestion that was already reviewed", async () => {
    mockClient = createMockSupabase({
      tables: {
        scholarship_suggestions: [{ data: scholarshipSuggestion({ status: "approved" }), error: null }],
      },
    });

    await expect(approveSuggestion("sug1")).rejects.toThrow(/already been reviewed/i);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
  });

  it("refuses add_row/remove_row (only update_field auto-applies)", async () => {
    mockClient = createMockSupabase({
      tables: {
        scholarship_suggestions: [{ data: scholarshipSuggestion({ change_kind: "add_row" }), error: null }],
      },
    });

    await expect(approveSuggestion("sug1")).rejects.toThrow(/add\/remove must be done by hand/i);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
  });

  it("refuses a non-admin caller (requireAdmin rejects)", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("REDIRECT:/"));
    mockClient = createMockSupabase({});

    await expect(approveSuggestion("sug1")).rejects.toThrow(/REDIRECT/);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
  });
});
