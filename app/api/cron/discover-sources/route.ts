import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/verify-cron-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runSourceDiscovery } from "@/lib/source-discovery/run-discovery";

// FR22 (docs/PRD.md §4.7): the new-scholarship discovery cron. Thin gate over
// the crawler loop in lib/source-discovery/run-discovery.ts -- same shape as the
// other four crons (verifyCronSecret -> 401 -> service-role client). Weekly
// cadence (vercel.json), Node runtime (jsdom / pdf-parse / node:dns are not
// edge-safe). Files curator candidates only -- never publishes, never touches
// real scholarship data.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    const summary = await runSourceDiscovery(supabase);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
