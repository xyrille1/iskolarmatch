import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Trust-boundary test (docs/QA-CHECKLIST.md P0-02, invariant e): requireAdmin()
// must redirect an unauthenticated caller to /auth and a non-admin to /, and
// only return an AdminContext for a genuine admin. redirect() in Next.js throws
// a control-flow signal; we mock it to throw a sentinel carrying the target so
// we can assert exactly where it sent the caller.

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

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => mockClient),
}));

import { requireAdmin } from "./require-admin";

const ADMIN_USER = { id: "11111111-1111-1111-1111-111111111111" };

describe("requireAdmin (trust boundary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects an unauthenticated caller to /auth", async () => {
    mockClient = createMockSupabase({ auth: { getUser: { data: { user: null } } } });

    await expect(requireAdmin()).rejects.toMatchObject({ to: "/auth?next=/admin" });
  });

  it("redirects an authenticated non-admin to /", async () => {
    mockClient = createMockSupabase({
      auth: { getUser: { data: { user: ADMIN_USER } } },
      // No admin_users row for this user -> maybeSingle resolves null.
      tables: { admin_users: [{ data: null, error: null }] },
    });

    await expect(requireAdmin()).rejects.toMatchObject({ to: "/" });
  });

  it("returns an AdminContext for a genuine admin", async () => {
    mockClient = createMockSupabase({
      auth: { getUser: { data: { user: ADMIN_USER } } },
      tables: { admin_users: [{ data: { user_id: ADMIN_USER.id }, error: null }] },
    });

    const ctx = await requireAdmin();
    expect(ctx.userId).toBe(ADMIN_USER.id);
  });

  it("filters admin_users by the session user id explicitly (P1-02 defense-in-depth)", async () => {
    mockClient = createMockSupabase({
      auth: { getUser: { data: { user: ADMIN_USER } } },
      tables: { admin_users: [{ data: { user_id: ADMIN_USER.id }, error: null }] },
    });

    await requireAdmin();

    // The admin_users lookup must .eq("user_id", <session id>) rather than
    // relying on RLS alone -- assert the explicit filter is present.
    const builder = mockClient.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>;
    expect(builder.eq).toHaveBeenCalledWith("user_id", ADMIN_USER.id);
  });
});
