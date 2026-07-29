import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// P0-04 (docs/INFRA-AUDIT-REPORT.md): /api/health exists so a scheduled ping
// (.github/workflows/keep-alive.yml) can produce a real Supabase query and
// prevent the free-tier project's inactivity auto-pause. Asserts it actually
// reaches the DB (not just a static 200) and surfaces a query failure as 500.

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => mockClient) }));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true and queries scholarships when the DB is reachable", async () => {
    mockClient = createMockSupabase({ tables: { scholarships: [{ data: [{ id: "s1" }], error: null }] } });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockClient.from).toHaveBeenCalledWith("scholarships");
  });

  it("returns 500 with the error surfaced when the query fails", async () => {
    mockClient = createMockSupabase({
      tables: { scholarships: [{ data: null, error: { message: "connection refused" } }] },
    });
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "connection refused" });
  });
});
