import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// docs/QA-CHECKLIST.md P1-01: a failing audit_log insert must be observable
// (logged AND thrown), never silently swallowed -- an audit trail that lies is
// worse than none for a compliance record (SECURITY.md §3.7).

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => mockClient) }));

import { logAudit } from "./log-audit";

describe("logAudit", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("inserts the audit row on the happy path (no throw)", async () => {
    mockClient = createMockSupabase({ tables: { audit_log: [{ data: null, error: null }] } });

    await expect(logAudit("actor-1", "approve_suggestion", "scholarship_suggestion", "s1", { k: "v" })).resolves.toBeUndefined();

    const builder = mockClient.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>;
    expect(mockClient.from).toHaveBeenCalledWith("audit_log");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "actor-1",
        action: "approve_suggestion",
        entity_type: "scholarship_suggestion",
        entity_id: "s1",
        detail: { k: "v" },
      })
    );
  });

  it("throws AND logs when the audit insert fails (not silent)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClient = createMockSupabase({
      tables: { audit_log: [{ data: null, error: { message: "insert failed" } }] },
    });

    await expect(logAudit("actor-1", "delete", "scholarship", "s1")).rejects.toThrow(/audit-log entry/i);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toMatch(/\[audit\]/);
  });
});
