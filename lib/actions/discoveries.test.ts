import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Trust-boundary tests (docs/QA-CHECKLIST.md P0-02, invariant d) for the FR22
// candidate-promotion gate: promotion must create an is_published=false DRAFT
// via the SAME validated upsertScholarship action -- it must NEVER auto-publish
// -- and must refuse an already-reviewed candidate or a non-admin caller.

const { admin, logAudit, requireAdmin } = vi.hoisted(() => ({
  admin: { upsertScholarship: vi.fn(async () => ({ id: "new-sch" })) },
  logAudit: vi.fn(async () => {}),
  requireAdmin: vi.fn(async () => ({ userId: "admin-1", __brand: "AdminContext" as const })),
}));

vi.mock("@/lib/actions/admin", () => admin);
vi.mock("@/lib/actions/log-audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// redirect() throws a control-flow signal in Next.js -- mock it so we can let
// the action run to completion and then assert the earlier side effects.
class RedirectSignal extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin }));

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => mockClient),
}));

import { promoteCandidateFormAction } from "./discoveries";

function promoteForm(): FormData {
  const fd = new FormData();
  fd.set("provider_id", "prov-1");
  fd.set("title", "New Scholarship");
  fd.set("slug", "new-scholarship");
  fd.set("summary", "A summary");
  fd.set("coverage_type", "full");
  fd.set("benefit_summary", "Full ride");
  fd.set("official_url", "https://ched.gov.ph/new");
  return fd;
}

describe("promoteCandidateFormAction (trust boundary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ userId: "admin-1", __brand: "AdminContext" });
    admin.upsertScholarship.mockResolvedValue({ id: "new-sch" });
  });

  it("(d) creates a DRAFT (is_published=false, no verified date) and never auto-publishes", async () => {
    mockClient = createMockSupabase({
      tables: {
        scholarship_candidates: [
          { data: { id: "cand-1", status: "pending" }, error: null }, // load candidate
          { data: null, error: null }, // close candidate
        ],
      },
    });

    // The action ends in redirect() to the edit page -- expected control flow.
    await expect(promoteCandidateFormAction("cand-1", promoteForm())).rejects.toMatchObject({
      to: "/admin/scholarships/new-sch/edit",
    });

    expect(admin.upsertScholarship).toHaveBeenCalledTimes(1);
    const payload = (admin.upsertScholarship.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    // The core invariant: promotion is draft-only.
    expect(payload.is_published).toBe(false);
    expect(payload.last_verified_at).toBeNull();
    expect(payload.title).toBe("New Scholarship");
    expect(logAudit).toHaveBeenCalledWith(
      "admin-1",
      "promote_candidate",
      "scholarship_candidate",
      "cand-1",
      expect.objectContaining({ scholarship_id: "new-sch" })
    );
  });

  it("refuses a candidate that was already reviewed", async () => {
    mockClient = createMockSupabase({
      tables: {
        scholarship_candidates: [{ data: { id: "cand-1", status: "approved" }, error: null }],
      },
    });

    await expect(promoteCandidateFormAction("cand-1", promoteForm())).rejects.toThrow(/already been reviewed/i);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
  });

  it("refuses a non-admin caller (requireAdmin rejects)", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("REDIRECT:/"));
    mockClient = createMockSupabase({});

    await expect(promoteCandidateFormAction("cand-1", promoteForm())).rejects.toThrow(/REDIRECT/);
    expect(admin.upsertScholarship).not.toHaveBeenCalled();
  });
});
