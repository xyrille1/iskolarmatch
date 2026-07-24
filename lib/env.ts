import { z } from "zod";

// Central, fail-fast environment validation (docs/QA-CHECKLIST.md P1-03).
//
// Before this module, ~15 env vars were read ad hoc across the codebase with
// inconsistent behavior: cron/email/push/groq already failed closed with a
// clear per-call error, but proxy.ts (the session-refresh middleware) quietly
// no-op'd on a missing Supabase var -- sessions would silently stop
// refreshing with nothing in the logs to explain why.
//
// Each `require*Env()` below validates only the vars that specific call path
// actually needs (not one giant all-or-nothing schema) and throws ONE clear,
// aggregated error naming every missing/invalid var. Deliberately NOT tagged
// `import "server-only"`: proxy.ts runs on the Edge runtime, which doesn't
// reliably resolve the `server-only` package's "react-server" export
// condition, so tagging this module could turn a missing-env-var no-op into
// a hard crash on every single request. Every var validated here is a
// server-only secret already (never a value we'd worry about leaking into a
// client bundle by omitting the tag).
//
// NEXT_PUBLIC_-prefixed vars used in genuinely browser-safe contexts are
// still fine to read directly via process.env -- Next.js inlines those at
// build time regardless of this module.

function parseOrThrow<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  source: NodeJS.ProcessEnv
): z.infer<z.ZodObject<Shape>> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(
      `Missing or invalid required environment variable(s): ${names.join(", ")}. See .env.example / docs/DEPLOYMENT.md.`
    );
  }
  return parsed.data;
}

// Memoizes a zero-arg parse so repeated calls (every request) don't re-parse
// process.env, while keeping each call path's schema independent -- a missing
// CRON_SECRET must never block Supabase client creation, and vice versa.
function memoize<T>(fn: () => T): () => T {
  let cache: { value: T } | undefined;
  return () => {
    cache ??= { value: fn() };
    return cache.value;
  };
}

const supabaseUrlSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
});

const supabasePublicSchema = supabaseUrlSchema.extend({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const supabaseAdminSchema = supabaseUrlSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

// Used by lib/supabase/server.ts and lib/supabase/client.ts (anon-key clients).
export const requireSupabasePublicEnv = memoize(() => parseOrThrow(supabasePublicSchema, process.env));

// Used by lib/supabase/admin.ts (service-role client).
export const requireSupabaseAdminEnv = memoize(() => parseOrThrow(supabaseAdminSchema, process.env));

const warnedOnce = new Set<string>();

// Logs a warning exactly once per cold start for an optional-but-degraded var,
// instead of staying silent. Used where a hard throw would be worse than the
// degradation (e.g. Edge Middleware, which runs on every request).
function warnOnce(key: string, message: string): void {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(`[env] ${message}`);
}

// Edge-safe, non-throwing variant for proxy.ts: returns null (and warns once)
// instead of crashing every request when Supabase config is missing. The
// session-refresh no-op this causes is now OBSERVABLE, which is the actual
// P1-03 fix for this call path -- proxy.ts intentionally stays degrade-not-crash
// because Edge Middleware failing would take down every route, not just auth.
export function getSupabasePublicConfigOrWarn(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    warnOnce(
      "supabase-public-config",
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set -- session refresh middleware is a no-op until configured."
    );
    return null;
  }
  return { url, anonKey };
}
