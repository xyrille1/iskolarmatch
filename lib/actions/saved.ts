"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scholarshipIdSchema } from "@/lib/types/application-tracker";

// Reuse the shared .uuid() schema so save/unsave/reminder reject non-UUID input
// before the DB call, matching application-tracker.ts (docs/QA-CHECKLIST.md
// P2-05). RLS/FK constraints still enforce this independently.
function assertScholarshipId(scholarshipId: string): string {
  const parsed = scholarshipIdSchema.safeParse(scholarshipId);
  if (!parsed.success) {
    throw new Error("Invalid scholarship id.");
  }
  return parsed.data;
}

async function requireUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be signed in.");
  }

  return { supabase, userId: user.id };
}

// FR7: save scholarship. user_id always comes from the session, never a
// request param (docs/SECURITY.md §3.4) -- RLS also enforces this independently.
export async function saveScholarship(scholarshipId: string): Promise<void> {
  const id = assertScholarshipId(scholarshipId);
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("saved_scholarships")
    .insert({ user_id: userId, scholarship_id: id });

  // 23505 = unique_violation -- already saved; treat as a no-op, not an error.
  if (error && error.code !== "23505") {
    throw new Error("Failed to save scholarship.");
  }

  revalidatePath("/saved");
}

export async function unsaveScholarship(scholarshipId: string): Promise<void> {
  const id = assertScholarshipId(scholarshipId);
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("saved_scholarships")
    .delete()
    .eq("user_id", userId)
    .eq("scholarship_id", id);

  if (error) throw new Error("Failed to remove saved scholarship.");

  revalidatePath("/saved");
}

// FR8: set/receive an email reminder N days before a saved scholarship's
// deadline. Computes remind_on from the soonest deadline cycle and upserts
// (unique(user_id, scholarship_id) makes this idempotent).
export async function setReminder(scholarshipId: string, leadDays: number): Promise<void> {
  const id = assertScholarshipId(scholarshipId);
  const { supabase, userId } = await requireUserId();

  const { data: cycles, error: cyclesError } = await supabase
    .from("deadline_cycles")
    .select("closes_at")
    .eq("scholarship_id", id)
    .order("closes_at", { ascending: true })
    .limit(1);

  if (cyclesError) throw new Error("Failed to load deadline for reminder.");

  const closesAt = cycles?.[0]?.closes_at;
  if (!closesAt) throw new Error("No deadline cycle found for this scholarship.");

  const remindOn = new Date(closesAt);
  remindOn.setUTCDate(remindOn.getUTCDate() - leadDays);

  const { error } = await supabase.from("reminders").upsert(
    {
      user_id: userId,
      scholarship_id: id,
      lead_days: leadDays,
      remind_on: remindOn.toISOString().slice(0, 10),
      sent_at: null,
    },
    { onConflict: "user_id,scholarship_id" }
  );

  if (error) throw new Error("Failed to set reminder.");

  revalidatePath("/saved");
}

export async function cancelReminder(scholarshipId: string): Promise<void> {
  const id = assertScholarshipId(scholarshipId);
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("scholarship_id", id);

  if (error) throw new Error("Failed to cancel reminder.");

  revalidatePath("/saved");
}

// Form-facing wrapper for the reminder lead-days <select>, used with
// `.bind(null, scholarshipId)` as a form action (Next.js reconstructs the
// bound arg alongside the submitted FormData).
export async function setReminderFormAction(scholarshipId: string, formData: FormData): Promise<void> {
  const leadDays = Number(formData.get("lead_days"));
  await setReminder(scholarshipId, Number.isFinite(leadDays) && leadDays > 0 ? leadDays : 7);
}
