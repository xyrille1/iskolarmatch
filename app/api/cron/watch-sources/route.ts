import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/verify-cron-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSourceWatcher } from "@/lib/source-watcher/run-watch";

// FR10 (docs/PRD.md §1.6, Phase 2): the source-watcher cron. Thin gate over the
// agentic loop in lib/source-watcher/run-watch.ts -- same shape as the other
// three crons (verifyCronSecret -> 401 -> service-role client). Weekly cadence
// (vercel.json), Node runtime (jsdom / pdf-parse / node:dns are not edge-safe).
// Files curator suggestions only -- never touches real scholarship data.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    const summary = await runSourceWatcher(supabase);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Source-watcher run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
