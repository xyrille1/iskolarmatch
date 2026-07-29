import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// P0-04 (docs/INFRA-AUDIT-REPORT.md): a real, minimal Supabase read that
// counts as "activity" against the free-tier project so a scheduled ping
// (.github/workflows/keep-alive.yml) can prevent the 7-day inactivity
// auto-pause. Deliberately public/unauthenticated (mirrors /trust's public
// read) and uses the anon-scoped client, never the service role -- this
// route reveals nothing beyond "a scholarship row exists," which /scholarships
// already exposes. force-dynamic so every call reaches Postgres rather than
// serving a cached response.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("scholarships").select("id").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
