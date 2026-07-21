import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/verify-cron-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getManilaTodayIso } from "@/lib/deadline/manila-date";
import { sendReminderEmail } from "@/lib/email/send-reminder-email";
import { sendPushNotification, PushSubscriptionExpiredError } from "@/lib/push/send-push-notification";

interface DueReminderRow {
  id: string;
  user_id: string;
  scholarship_id: string;
  scholarships: {
    title: string;
    slug: string;
    deadline_cycles: { closes_at: string; status: string }[];
  } | null;
}

// FR8, sent_at-guarded so a reminder is never sent twice (idempotent even if
// the cron fires more than once for the same day).
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const today = getManilaTodayIso();

  const { data: dueRows, error } = await supabase
    .from("reminders")
    .select(
      `id, user_id, scholarship_id,
       scholarships ( title, slug, deadline_cycles ( closes_at, status ) )`
    )
    .is("sent_at", null)
    .lte("remind_on", today);

  if (error) {
    return NextResponse.json({ error: "Failed to load due reminders." }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (dueRows ?? []) as unknown as DueReminderRow[]) {
    const scholarship = row.scholarships;
    if (!scholarship) {
      skipped += 1;
      continue;
    }

    // Never remind about a cycle that has already closed.
    const closedCycle = scholarship.deadline_cycles.find((c) => c.status === "closed");
    if (closedCycle) {
      skipped += 1;
      continue;
    }

    const cycle = [...scholarship.deadline_cycles].sort(
      (a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at)
    )[0];
    if (!cycle) {
      skipped += 1;
      continue;
    }

    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(row.user_id);
    const email = userResult?.user?.email;
    if (userError || !email) {
      failed += 1;
      continue;
    }

    try {
      await sendReminderEmail({
        to: email,
        scholarshipTitle: scholarship.title,
        scholarshipSlug: scholarship.slug,
        closesAt: cycle.closes_at,
      });
    } catch {
      failed += 1;
      continue;
    }

    // FR18: best-effort push in addition to email -- email is the primary
    // channel, so a push failure here never blocks marking the reminder sent.
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", row.user_id);

    for (const sub of subscriptions ?? []) {
      try {
        await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          {
            title: "Deadline coming up",
            body: `${scholarship.title} closes ${cycle.closes_at}.`,
            url: `/s/${scholarship.slug}`,
          }
        );
      } catch (pushErr) {
        if (pushErr instanceof PushSubscriptionExpiredError) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    const { error: markSentError } = await supabase
      .from("reminders")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);

    if (markSentError) {
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({ due: dueRows?.length ?? 0, sent, skipped, failed });
}
