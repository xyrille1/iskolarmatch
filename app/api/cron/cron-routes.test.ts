import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockSupabase } from "@/tests/helpers/mock-supabase";

// Route-level tests for all five cron endpoints (docs/QA-CHECKLIST.md P1-07):
// every route must reject a missing/wrong Bearer with 401 BEFORE doing any
// work, and invoke its pipeline on a valid secret. The pipeline internals are
// mocked -- this asserts the auth gate and wiring, not the pipeline logic
// (that's covered by P1-06 and the domain unit tests).

const { runSourceWatcher, runSourceDiscovery, sendReminderEmail, sendDigestEmail, sendPushNotification } = vi.hoisted(
  () => ({
    runSourceWatcher: vi.fn(async () => ({ processed: 0, changed: 0, suggestionsWritten: 0, failures: 0 })),
    runSourceDiscovery: vi.fn(async () => ({
      indexPagesProcessed: 0,
      candidatesCreated: 0,
      duplicatesSkipped: 0,
      detailPagesFetched: 0,
      robotsBlocked: 0,
      failures: 0,
    })),
    sendReminderEmail: vi.fn(async () => {}),
    sendDigestEmail: vi.fn(async () => {}),
    sendPushNotification: vi.fn(async () => {}),
  })
);

let mockClient: MockSupabase;
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => mockClient) }));
vi.mock("@/lib/source-watcher/run-watch", () => ({ runSourceWatcher }));
vi.mock("@/lib/source-discovery/run-discovery", () => ({ runSourceDiscovery }));
vi.mock("@/lib/email/send-reminder-email", () => ({ sendReminderEmail }));
vi.mock("@/lib/email/send-digest-email", () => ({ sendDigestEmail }));
vi.mock("@/lib/push/send-push-notification", () => ({
  sendPushNotification,
  PushSubscriptionExpiredError: class extends Error {},
}));

import { GET as refreshDeadlines } from "./refresh-deadlines/route";
import { GET as sendReminders } from "./send-reminders/route";
import { GET as sendDigest } from "./send-digest/route";
import { GET as watchSources } from "./watch-sources/route";
import { GET as discoverSources } from "./discover-sources/route";

const SECRET = "test-cron-secret";

function req(bearer?: string): Request {
  const headers: Record<string, string> = {};
  if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`;
  return new Request("http://localhost/api/cron", { headers });
}

const ROUTES = [
  { name: "refresh-deadlines", handler: refreshDeadlines },
  { name: "send-reminders", handler: sendReminders },
  { name: "send-digest", handler: sendDigest },
  { name: "watch-sources", handler: watchSources },
  { name: "discover-sources", handler: discoverSources },
] as const;

describe("cron route auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it.each(ROUTES)("$name returns 401 with no Authorization header", async ({ handler }) => {
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it.each(ROUTES)("$name returns 401 with a wrong Bearer token", async ({ handler }) => {
    const res = await handler(req("not-the-secret"));
    expect(res.status).toBe(401);
  });

  it("watch-sources invokes the source-watcher on a valid secret", async () => {
    const res = await watchSources(req(SECRET));
    expect(res.status).toBe(200);
    expect(runSourceWatcher).toHaveBeenCalledTimes(1);
  });

  it("discover-sources invokes source-discovery on a valid secret", async () => {
    const res = await discoverSources(req(SECRET));
    expect(res.status).toBe(200);
    expect(runSourceDiscovery).toHaveBeenCalledTimes(1);
  });

  it("refresh-deadlines runs its query on a valid secret", async () => {
    mockClient = createMockSupabase({ tables: { deadline_cycles: [{ data: [], error: null }] } });
    const res = await refreshDeadlines(req(SECRET));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ checked: 0, updated: 0 });
  });

  it("send-reminders runs its query on a valid secret", async () => {
    mockClient = createMockSupabase({ tables: { reminders: [{ data: [], error: null }] } });
    const res = await sendReminders(req(SECRET));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ due: 0, sent: 0 });
  });

  it("send-digest runs its queries on a valid secret", async () => {
    mockClient = createMockSupabase({
      tables: { saved_profiles: [{ data: [], error: null }], scholarships: [{ data: [], error: null }] },
    });
    const res = await sendDigest(req(SECRET));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ profiles: 0, sent: 0 });
  });
});
