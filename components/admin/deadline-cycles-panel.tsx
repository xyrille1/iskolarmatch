import { addDeadlineCycleFormAction, deleteDeadlineCycle } from "@/lib/actions/admin";
import type { AdminScholarshipDetail } from "@/lib/data/get-admin-scholarship-detail";

export function DeadlineCyclesPanel({
  scholarshipId,
  cycles,
}: {
  scholarshipId: string;
  cycles: AdminScholarshipDetail["deadlineCycles"];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Deadline cycles</h2>

      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {cycles.map((cycle) => (
          <li key={cycle.id} className="flex items-center justify-between border-b border-line py-2">
            <span>
              {cycle.academic_year && `${cycle.academic_year}: `}
              Opens {cycle.opens_at ?? "TBA"} · Closes {cycle.closes_at} · {cycle.status}
            </span>
            <form action={deleteDeadlineCycle.bind(null, cycle.id)}>
              <button type="submit" className="text-status-danger underline">
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form action={addDeadlineCycleFormAction.bind(null, scholarshipId)} className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <input name="academic_year" placeholder="2026-2027" className="rounded border border-line px-2 py-1.5" />
        <input name="opens_at" type="date" className="rounded border border-line px-2 py-1.5" />
        <input name="closes_at" type="date" required className="rounded border border-line px-2 py-1.5" />
        <button type="submit" className="col-span-3 w-fit rounded border border-ink px-3 py-1.5">
          Add cycle
        </button>
      </form>
    </section>
  );
}
