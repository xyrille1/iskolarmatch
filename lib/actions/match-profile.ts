"use server";

import { headers } from "next/headers";
import { profileSchema, type Profile } from "@/lib/types/profile";
import { buildScholarshipMatches, type MatchProfileResult, type ScholarshipRow } from "@/lib/matching";
import { createSupabaseClient } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type { MatchProfileResult, ScholarshipMatch } from "@/lib/matching";

export interface MatchFormState {
  status: "idle" | "error" | "success";
  formError?: string;
  fieldErrors?: Record<string, string>;
  results?: MatchProfileResult;
}

// The DB-reading entry point deferred out of P0 (see lib/matching/index.ts).
// Validates nothing here beyond what the caller already validated -- this
// function assumes `profile` is a trusted, already-parsed Profile. Row ->
// bucket transformation lives in the pure, unit-tested buildScholarshipMatches.
export async function matchProfile(profile: Profile): Promise<MatchProfileResult> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("scholarships")
    .select(
      `id, slug, title, coverage_type, last_verified_at,
       providers ( name ),
       deadline_cycles ( closes_at, opens_at, status ),
       eligibility_rules ( id, field, operator, value, is_mandatory, human_label ),
       requirements ( id )`
    )
    .eq("is_published", true);

  if (error) {
    throw new Error("Failed to load scholarships for matching.");
  }

  const rows = (data ?? []) as unknown as ScholarshipRow[];
  return buildScholarshipMatches(rows, profile);
}

function coerceProfileField(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

// Form-facing wrapper: parses FormData, validates, rate-limits, then calls
// matchProfile(). Profile data never touches the URL or gets persisted --
// session-only per docs/SECURITY.md PR1.
export async function submitProfileForm(
  _prevState: MatchFormState,
  formData: FormData
): Promise<MatchFormState> {
  const forwardedFor = (await headers()).get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(`match:${forwardedFor}`, 20, 60_000);
  if (!allowed) {
    return { status: "error", formError: "Too many requests. Please wait a moment and try again." };
  }

  const gwaRaw = coerceProfileField(formData.get("gwa"));
  const gwa = gwaRaw !== undefined ? Number(gwaRaw) : undefined;

  if (gwa !== undefined && (Number.isNaN(gwa) || gwa < 0 || gwa > 100)) {
    return { status: "error", fieldErrors: { gwa: "Enter a GWA between 0 and 100." } };
  }

  const raw = {
    education_level: coerceProfileField(formData.get("education_level")),
    gwa,
    course_field: coerceProfileField(formData.get("course_field")),
    region: coerceProfileField(formData.get("region")),
    income_bracket: coerceProfileField(formData.get("income_bracket")),
    is_pwd: formData.get("is_pwd") === "on",
    is_solo_parent_dependent: formData.get("is_solo_parent_dependent") === "on",
    is_indigenous: formData.get("is_indigenous") === "on",
    is_top_graduate: formData.get("is_top_graduate") === "on",
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors };
  }

  const results = await matchProfile(parsed.data);
  return { status: "success", results };
}
