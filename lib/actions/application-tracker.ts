"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applicationNotesSchema,
  applicationStatusSchema,
  requirementIdSchema,
  scholarshipIdSchema,
} from "@/lib/types/application-tracker";

// FR21 (docs/PRD.md §4.6): owner-scoped application-tracker writes. Same shape
// as lib/actions/saved.ts -- user_id always comes from the session, never a
// request param (docs/SECURITY.md §3.4); RLS enforces owner isolation
// independently. Authenticated-owner surface, not anon-write.
async function requireUserId(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be signed in.");
  }

  return { supabase, userId: user.id };
}

// Set the application status for a saved scholarship. Upsert on
// (user_id, scholarship_id) so the row is created on first edit and updated
// thereafter (unique constraint makes this idempotent).
export async function setApplicationStatus(scholarshipId: string, status: string): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const parsedId = scholarshipIdSchema.safeParse(scholarshipId);
  const parsedStatus = applicationStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    throw new Error("Invalid application status.");
  }

  const { error } = await supabase.from("application_progress").upsert(
    {
      user_id: userId,
      scholarship_id: parsedId.data,
      status: parsedStatus.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,scholarship_id" }
  );

  if (error) throw new Error("Failed to update application status.");

  revalidatePath("/saved");
}

// Save the free-text note for a saved scholarship. Empty string clears it.
export async function saveApplicationNotes(scholarshipId: string, notes: string): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const parsedId = scholarshipIdSchema.safeParse(scholarshipId);
  const parsedNotes = applicationNotesSchema.safeParse(notes);
  if (!parsedId.success || !parsedNotes.success) {
    throw new Error("Invalid note.");
  }

  const trimmed = parsedNotes.data;
  const { error } = await supabase.from("application_progress").upsert(
    {
      user_id: userId,
      scholarship_id: parsedId.data,
      notes: trimmed.length > 0 ? trimmed : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,scholarship_id" }
  );

  if (error) throw new Error("Failed to save note.");

  revalidatePath("/saved");
}

// Toggle a requirement checkoff. Presence = checked, exactly like
// saveScholarship/unsaveScholarship: insert (ignoring the unique-violation
// no-op) or delete.
export async function toggleRequirementCheckoff(requirementId: string, checked: boolean): Promise<void> {
  const { supabase, userId } = await requireUserId();

  const parsedId = requirementIdSchema.safeParse(requirementId);
  if (!parsedId.success) {
    throw new Error("Invalid requirement.");
  }

  if (checked) {
    const { error } = await supabase
      .from("requirement_checkoffs")
      .insert({ user_id: userId, requirement_id: parsedId.data });

    // 23505 = unique_violation -- already checked; treat as a no-op, not an error.
    if (error && error.code !== "23505") {
      throw new Error("Failed to update checklist.");
    }
  } else {
    const { error } = await supabase
      .from("requirement_checkoffs")
      .delete()
      .eq("user_id", userId)
      .eq("requirement_id", parsedId.data);

    if (error) throw new Error("Failed to update checklist.");
  }

  revalidatePath("/saved");
}

// Form-facing wrapper for the status <select>, used with
// `.bind(null, scholarshipId)` as a form action (mirrors setReminderFormAction).
export async function setApplicationStatusFormAction(scholarshipId: string, formData: FormData): Promise<void> {
  await setApplicationStatus(scholarshipId, String(formData.get("status") ?? ""));
}

// Form-facing wrapper for the notes <textarea>.
export async function saveApplicationNotesFormAction(scholarshipId: string, formData: FormData): Promise<void> {
  await saveApplicationNotes(scholarshipId, String(formData.get("notes") ?? ""));
}
