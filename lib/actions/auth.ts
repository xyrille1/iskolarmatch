"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

const emailSchema = z.object({ email: z.string().email() }).strict();

export interface AuthFormState {
  status: "idle" | "error" | "sent";
  error?: string;
}

// Only a relative, same-site path is ever honored -- prevents an open
// redirect via a crafted `next` value in the magic-link URL.
function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/saved";
  return next;
}

// FR6: auth is required only to save/set reminders, never to browse or match.
export async function requestMagicLink(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const forwardedFor = (await headers()).get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(`auth:${forwardedFor}`, 5, 60_000);
  if (!allowed) {
    return { status: "error", error: "Too many requests. Please wait a moment and try again." };
  }

  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", error: "Enter a valid email address." };
  }

  const next = sanitizeNext(formData.get("next")?.toString());
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: "error", error: "Could not send the magic link. Please try again." };
  }

  return { status: "sent" };
}
