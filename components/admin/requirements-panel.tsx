import { addRequirementFormAction, deleteRequirement } from "@/lib/actions/admin";
import type { AdminScholarshipDetail } from "@/lib/data/get-admin-scholarship-detail";

export function RequirementsPanel({
  scholarshipId,
  requirements,
}: {
  scholarshipId: string;
  requirements: AdminScholarshipDetail["requirements"];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Requirements</h2>

      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {requirements.map((req) => (
          <li key={req.id} className="flex items-center justify-between border-b border-line py-2">
            <span>
              {req.sort_order}. {req.label}
              {req.is_mandatory ? "" : " (optional)"}
            </span>
            <form action={deleteRequirement.bind(null, req.id)}>
              <button type="submit" className="text-status-danger underline">
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form action={addRequirementFormAction.bind(null, scholarshipId)} className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <input name="label" placeholder="Requirement label" required className="col-span-2 rounded border border-line px-2 py-1.5" />
        <input name="sort_order" type="number" defaultValue={requirements.length} className="rounded border border-line px-2 py-1.5" />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_mandatory" defaultChecked />
          Mandatory
        </label>
        <button type="submit" className="col-span-2 w-fit rounded border border-ink px-3 py-1.5">
          Add requirement
        </button>
      </form>
    </section>
  );
}
