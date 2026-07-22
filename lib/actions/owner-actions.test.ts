import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Baseline happy-path + rejection tests (docs/QA-CHECKLIST.md P1-07) for the
// owner-scoped server actions -- all share the createSupabaseServerClient +
// session convention, so they're covered together. Each asserts: the happy
// path writes, a validation/authz rejection short-circuits before the DB.

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => mockClient),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveScholarship, unsaveScholarship, setReminder } from "./saved";
import { subscribeToPush } from "./push";
import { setApplicationStatus } from "./application-tracker";
import { saveProfileForDigest } from "./saved-profile";
import { createSavedListShare } from "./share";

const USER = { id: "00000000-0000-0000-0000-0000000000aa" };
// A valid RFC v4 UUID (version nibble 4, variant 8-b) -- production ids come
// from gen_random_uuid(), which always produces these; the all-zero seed ids
// are the exception and aren't passed through the .uuid()-validated actions.
const SCH_ID = "123e4567-e89b-42d3-a456-556642440000";
const signedIn = { data: { user: USER } };
const signedOut = { data: { user: null } };

beforeEach(() => vi.clearAllMocks());

describe("saved.ts", () => {
  it("saveScholarship inserts for the session user (happy path)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn }, tables: { saved_scholarships: [{ error: null }] } });
    await expect(saveScholarship(SCH_ID)).resolves.toBeUndefined();
    const builder = mockClient.from.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>;
    expect(builder.insert).toHaveBeenCalledWith({ user_id: USER.id, scholarship_id: SCH_ID });
  });

  it("saveScholarship rejects a non-UUID id before any DB call (P2-05)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn } });
    await expect(saveScholarship("not-a-uuid")).rejects.toThrow(/invalid scholarship id/i);
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("unsaveScholarship rejects when signed out", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedOut } });
    await expect(unsaveScholarship(SCH_ID)).rejects.toThrow(/signed in/i);
  });

  it("setReminder rejects a non-UUID id", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn } });
    await expect(setReminder("nope", 7)).rejects.toThrow(/invalid scholarship id/i);
  });
});

describe("push.ts", () => {
  it("subscribeToPush upserts a valid subscription (happy path)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn }, tables: { push_subscriptions: [{ error: null }] } });
    await expect(
      subscribeToPush({ endpoint: "https://push.example.com/x", keys: { p256dh: "a", auth: "b" } })
    ).resolves.toBeUndefined();
  });

  it("subscribeToPush rejects a malformed payload before the DB call (P1-04)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn } });
    await expect(
      subscribeToPush({ endpoint: "not-a-url", keys: { p256dh: "", auth: "" } })
    ).rejects.toThrow(/invalid push subscription/i);
    expect(mockClient.from).not.toHaveBeenCalled();
  });
});

describe("application-tracker.ts", () => {
  it("setApplicationStatus upserts a valid status (happy path)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn }, tables: { application_progress: [{ error: null }] } });
    await expect(setApplicationStatus(SCH_ID, "applied")).resolves.toBeUndefined();
  });

  it("setApplicationStatus rejects an out-of-enum status", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn } });
    await expect(setApplicationStatus(SCH_ID, "not-a-status")).rejects.toThrow(/invalid application status/i);
  });
});

describe("saved-profile.ts", () => {
  it("saveProfileForDigest upserts a valid profile (happy path)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn }, tables: { saved_profiles: [{ error: null }] } });
    await expect(saveProfileForDigest({ education_level: "college", gwa: 90 })).resolves.toBeUndefined();
  });

  it("saveProfileForDigest rejects an invalid profile shape", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn } });
    // gwa must be a number; a string fails profileSchema.parse().
    await expect(saveProfileForDigest({ gwa: "high" } as never)).rejects.toThrow();
  });
});

describe("share.ts", () => {
  it("createSavedListShare returns an unguessable slug (happy path)", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedIn }, tables: { saved_list_shares: [{ error: null }] } });
    const { slug } = await createSavedListShare();
    expect(slug).toMatch(/^[A-Za-z0-9_-]{10,}$/);
  });

  it("createSavedListShare rejects when signed out", async () => {
    mockClient = createMockSupabase({ auth: { getUser: signedOut } });
    await expect(createSavedListShare()).rejects.toThrow(/signed in/i);
  });
});
