"use client";

import { useActionState } from "react";
import { PillButton } from "@/components/ui/pill";
import { requestMagicLink, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { status: "idle" };

export function AuthForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(requestMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div>
        <h1 className="font-serif text-4xl font-light leading-tight sm:text-5xl">Check your email.</h1>
        <p className="mt-4 text-muted">
          We sent a sign-in link. Open it on this device to continue -- no password needed.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl font-light leading-tight sm:text-5xl">Sign in.</h1>
        <p className="mt-2 text-sm text-muted">
          Only needed to save scholarships or set deadline reminders. We&apos;ll email you a one-time link --
          no password.
        </p>
      </div>

      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-[44px] rounded-md border border-line px-4 py-2"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-status-soon">
          {state.error}
        </p>
      )}

      <PillButton type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Sending…" : "Send me a link"}
      </PillButton>
    </form>
  );
}
