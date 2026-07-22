import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/verify-cron-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildScholarshipMatches, type ScholarshipRow } from "@/lib/matching";
import { sendDigestEmail } from "@/lib/email/send-digest-email";
import type { Profile } from "@/lib/types/profile";
import { DIGEST_BATCH_SIZE } from "@/lib/cron/config";

// Explicit runtime/duration budget, matching the crawler crons
// (docs/QA-CHECKLIST.md P1-05) -- this loop makes external calls (Resend,
// auth.admin.getUserById) per profile, so it needs the same declared ceiling
// `watch`/`discover` already have instead of an implicit, undeclared one.
export const runtime = "nodejs";
export const maxDuration = 60;

interface SavedProfileRow {
  id: string;
  user_id: string;
  profile: Profile;
  notified_scholarship_ids: string[];
}

// FR20 (docs/PRD.md §4.3): weekly, opt-in-only digest. Re-runs the same
// deterministic matcher the anonymous /match flow uses (lib/matching/) --
// no separate "digest matching" logic to keep in sync with the real one.
// notified_scholarship_ids makes this idempotent: only ever reports NEW
// matches, and re-running the cron never re-sends an already-notified match.
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // Batched, longest-since-last-digest (or never-digested) first: a profile
  // past the batch cap simply sorts first on the next run, so a backlog
  // drains over successive weeks without ever re-sending an already-notified
  // match (notified_scholarship_ids stays the idempotency guard either way).
  const [{ data: profiles, error: profilesError }, { data: scholarshipRows, error: scholarshipsError }] =
    await Promise.all([
      supabase
        .from("saved_profiles")
        .select("id, user_id, profile, notified_scholarship_ids")
        .eq("digest_opt_in", true)
        .order("last_digest_sent_at", { ascending: true, nullsFirst: true })
        .limit(DIGEST_BATCH_SIZE),
      supabase
        .from("scholarships")
        .select(
          `id, slug, title, coverage_type, last_verified_at,
           providers ( name ),
           deadline_cycles ( closes_at, opens_at, status ),
           eligibility_rules ( id, field, operator, value, is_mandatory, human_label, guidance_text ),
           requirements ( id )`
        )
        .eq("is_published", true),
    ]);

  if (profilesError || scholarshipsError || !scholarshipRows) {
    return NextResponse.json({ error: "Failed to load digest inputs." }, { status: 500 });
  }

  const rows = scholarshipRows as unknown as ScholarshipRow[];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (profiles ?? []) as unknown as SavedProfileRow[]) {
    const results = buildScholarshipMatches(rows, row.profile);
    const newlyMatched = [...results.eligible, ...results.nearMiss].filter(
      (m) => !row.notified_scholarship_ids.includes(m.scholarshipId)
    );

    if (newlyMatched.length === 0) {
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
      await sendDigestEmail({
        to: email,
        items: newlyMatched.map((m) => ({ title: m.title, slug: m.slug })),
      });
    } catch {
      failed += 1;
      continue;
    }

    const updatedNotified = [...new Set([...row.notified_scholarship_ids, ...newlyMatched.map((m) => m.scholarshipId)])];

    const { error: updateError } = await supabase
      .from("saved_profiles")
      .update({ notified_scholarship_ids: updatedNotified, last_digest_sent_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateError) {
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({ profiles: profiles?.length ?? 0, sent, skipped, failed });
}
