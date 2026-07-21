import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/verify-cron-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeDeadlineStatus } from "@/lib/deadline/compute-status";
import { getManilaTodayIso } from "@/lib/deadline/manila-date";
import type { DeadlineStatus } from "@/lib/deadline/format-status";

// FR5: deadline status auto-computed, refreshed daily. Runs as a Vercel Cron
// -> Route Handler hitting this endpoint (see vercel.json), authenticated via
// CRON_SECRET rather than a Supabase Edge Function -- consistent with the
// rest of this app being plain Next.js Route Handlers/Server Actions.
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const today = getManilaTodayIso();

  const { data: cycles, error } = await supabase
    .from("deadline_cycles")
    .select("id, opens_at, closes_at, status");

  if (error) {
    return NextResponse.json({ error: "Failed to load deadline cycles." }, { status: 500 });
  }

  const updates = (cycles ?? [])
    .map((cycle) => ({
      id: cycle.id as string,
      currentStatus: cycle.status as DeadlineStatus,
      nextStatus: computeDeadlineStatus(today, cycle.opens_at, cycle.closes_at),
    }))
    .filter((c) => c.nextStatus !== c.currentStatus);

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("deadline_cycles")
      .update({ status: update.nextStatus })
      .eq("id", update.id);
    if (updateError) {
      return NextResponse.json({ error: "Failed to update a deadline cycle." }, { status: 500 });
    }
  }

  return NextResponse.json({ checked: cycles?.length ?? 0, updated: updates.length });
}
