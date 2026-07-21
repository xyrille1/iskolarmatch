import { addEligibilityRuleFormAction, deleteEligibilityRule } from "@/lib/actions/admin";
import { OPERATORS, PROFILE_FIELDS } from "@/lib/types/profile";
import type { AdminScholarshipDetail } from "@/lib/data/get-admin-scholarship-detail";

export function EligibilityRulesPanel({
  scholarshipId,
  rules,
}: {
  scholarshipId: string;
  rules: AdminScholarshipDetail["eligibilityRules"];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Eligibility rules</h2>

      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between border-b border-black/10 py-2">
            <span>
              {rule.field} {rule.operator} {JSON.stringify(rule.value)}
              {rule.is_mandatory ? "" : " (bonus)"} -- &quot;{rule.human_label}&quot;
              {rule.guidance_text && (
                <span className="block text-black/60">Guidance: {rule.guidance_text}</span>
              )}
            </span>
            <form action={deleteEligibilityRule.bind(null, rule.id)}>
              <button type="submit" className="text-red-700 underline">
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form action={addEligibilityRuleFormAction.bind(null, scholarshipId)} className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <select name="field" required className="rounded border border-black/20 px-2 py-1.5">
          {PROFILE_FIELDS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select name="operator" required className="rounded border border-black/20 px-2 py-1.5">
          {OPERATORS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          name="value"
          placeholder='Value, e.g. 85 or ["college"]'
          required
          className="col-span-2 rounded border border-black/20 px-2 py-1.5"
        />
        <input
          name="human_label"
          placeholder="Human label, e.g. GWA at least 85"
          required
          className="col-span-2 rounded border border-black/20 px-2 py-1.5"
        />
        <textarea
          name="guidance_text"
          placeholder="Optional near-miss guidance, e.g. Retake units to raise your GWA above 85 before the next cycle opens."
          rows={2}
          className="col-span-2 rounded border border-black/20 px-2 py-1.5"
        />
        <label className="col-span-2 flex items-center gap-2">
          <input type="checkbox" name="is_mandatory" defaultChecked />
          Mandatory
        </label>
        <button type="submit" className="col-span-2 w-fit rounded border border-black px-3 py-1.5">
          Add rule
        </button>
      </form>
    </section>
  );
}
