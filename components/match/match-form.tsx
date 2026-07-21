"use client";

import { useActionState } from "react";
import { PillButton } from "@/components/ui/pill";
import { submitProfileForm, type MatchFormState } from "@/lib/actions/match-profile";

const initialState: MatchFormState = { status: "idle" };

const COURSE_FIELDS = [
  { value: "stem", label: "STEM" },
  { value: "business", label: "Business" },
  { value: "education", label: "Education" },
  { value: "arts_humanities", label: "Arts & Humanities" },
  { value: "health_sciences", label: "Health Sciences" },
  { value: "other", label: "Other" },
];

const REGIONS = [
  { value: "region_1", label: "Region I (Ilocos)" },
  { value: "ncr", label: "National Capital Region" },
  { value: "other", label: "Other region" },
];

const INCOME_BRACKETS = [
  { value: "low", label: "Low income" },
  { value: "mid", label: "Middle income" },
  { value: "high", label: "High income" },
];

export function MatchForm({ onSuccess }: { onSuccess: (state: MatchFormState) => void }) {
  const [state, formAction, isPending] = useActionState(async (prev: MatchFormState, formData: FormData) => {
    const next = await submitProfileForm(prev, formData);
    if (next.status === "success") onSuccess(next);
    return next;
  }, initialState);

  return (
    <form action={formAction} className="mx-auto flex max-w-[62ch] flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="font-serif text-4xl font-light leading-tight sm:text-5xl">
          A few quick questions.
        </h1>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Nothing is saved
        </p>
      </div>

      {state.status === "error" && state.formError && (
        <p role="alert" className="text-sm text-status-soon">
          {state.formError}
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Education level
        </legend>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="radio" name="education_level" value="shs" className="h-5 w-5" />
          Senior high graduate
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="radio" name="education_level" value="college" className="h-5 w-5" />
          College student
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="gwa" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          GWA / average
        </label>
        <input
          id="gwa"
          name="gwa"
          type="number"
          step="0.01"
          inputMode="decimal"
          className="min-h-[44px] rounded-md border border-line px-4 py-2"
          aria-describedby="gwa-help"
        />
        <p id="gwa-help" className="text-sm text-muted">
          Used only to check GWA-based requirements.
        </p>
        {state.status === "error" && state.fieldErrors?.gwa && (
          <p role="alert" className="text-sm text-status-soon">
            {state.fieldErrors.gwa}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="course_field" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Course field
        </label>
        <select
          id="course_field"
          name="course_field"
          defaultValue=""
          className="min-h-[44px] rounded-md border border-line px-4 py-2"
        >
          <option value="">Prefer not to say</option>
          {COURSE_FIELDS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="region" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Region
        </label>
        <select
          id="region"
          name="region"
          defaultValue=""
          className="min-h-[44px] rounded-md border border-line px-4 py-2"
        >
          <option value="">Prefer not to say</option>
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="income_bracket" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Income bracket
        </label>
        <select
          id="income_bracket"
          name="income_bracket"
          defaultValue=""
          className="min-h-[44px] rounded-md border border-line px-4 py-2"
          aria-describedby="income-help"
        >
          <option value="">Prefer not to say</option>
          {INCOME_BRACKETS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
        <p id="income-help" className="text-sm text-muted">
          A bracket only -- never your exact household income.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Special status (optional)
        </legend>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" name="is_pwd" className="h-5 w-5" />
          PWD
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" name="is_solo_parent_dependent" className="h-5 w-5" />
          Solo-parent dependent
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" name="is_indigenous" className="h-5 w-5" />
          Indigenous
        </label>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" name="is_top_graduate" className="h-5 w-5" />
          Top graduate
        </label>
        <p className="text-sm text-muted">Used only to match -- not stored.</p>
      </fieldset>

      <PillButton type="submit" disabled={isPending} className="w-full">
        {isPending ? "Finding your matches…" : "Show my matches →"}
      </PillButton>
    </form>
  );
}
