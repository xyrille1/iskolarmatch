import { vi } from "vitest";

// Minimal, deterministic mock of the Supabase JS query builder for unit-testing
// the server actions and cron routes with NO network/DB (docs/QA-CHECKLIST.md
// P0-02, P1-06, P1-07). The real PostgrestFilterBuilder is thenable and every
// filter method returns `this`; we reproduce exactly that surface:
//
//   - chain methods (select/insert/update/upsert/delete/eq/order/limit/...)
//     return the same builder, so any call shape chains,
//   - the builder is awaitable (a `then`) and also answers .single()/
//     .maybeSingle()/.csv(), all resolving to one queued `{ data, error, count }`.
//
// Each `.from(table)` call consumes the next queued result for that table, in
// order, so a test scripts a sequence of responses per table and the action
// draws them as it runs. An empty queue throws a loud, descriptive error rather
// than silently returning undefined -- a missing queue entry is a test bug.

export interface QueuedResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

type TableQueues = Record<string, QueuedResult[]>;

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "not",
  "match",
  "or",
  "filter",
  "order",
  "limit",
  "range",
  "contains",
  "overlaps",
] as const;

function makeBuilder(table: string, result: QueuedResult) {
  const resolved: QueuedResult = { data: null, error: null, count: null, ...result };
  const builder: Record<string, unknown> = {};

  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(resolved));
  builder.maybeSingle = vi.fn(() => Promise.resolve(resolved));
  // Awaiting the builder directly (queries with no .single()) resolves here.
  builder.then = (onFulfilled: (v: QueuedResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected);
  builder.__table = table;

  return builder;
}

export interface MockSupabaseScript {
  tables?: TableQueues;
  auth?: {
    getUser?: QueuedResult;
    getUserById?: QueuedResult[];
  };
  rpc?: Record<string, QueuedResult[]>;
}

export function createMockSupabase(script: MockSupabaseScript = {}) {
  const queues: TableQueues = {};
  for (const [table, results] of Object.entries(script.tables ?? {})) {
    queues[table] = [...results];
  }

  const getUserByIdQueue = [...(script.auth?.getUserById ?? [])];
  const rpcQueues: Record<string, QueuedResult[]> = {};
  for (const [name, results] of Object.entries(script.rpc ?? {})) {
    rpcQueues[name] = [...results];
  }

  const from = vi.fn((table: string) => {
    const queue = queues[table];
    if (!queue || queue.length === 0) {
      throw new Error(
        `createMockSupabase: no queued result for .from("${table}"). ` +
          `Add one to tables["${table}"] (they're consumed in call order).`
      );
    }
    return makeBuilder(table, queue.shift()!);
  });

  const client = {
    from,
    auth: {
      getUser: vi.fn(async () => script.auth?.getUser ?? { data: { user: null } }),
      admin: {
        getUserById: vi.fn(async () => getUserByIdQueue.shift() ?? { data: { user: null }, error: null }),
      },
    },
    rpc: vi.fn((name: string) => {
      const queue = rpcQueues[name] ?? [];
      return Promise.resolve(queue.shift() ?? { data: null, error: null });
    }),
  };

  return client;
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;
