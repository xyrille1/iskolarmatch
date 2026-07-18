import { upsertScholarshipFormAction } from "@/lib/actions/admin";
import type { AdminProvider } from "@/lib/data/get-providers";
import type { AdminScholarshipDetail } from "@/lib/data/get-admin-scholarship-detail";

const COVERAGE_TYPES = ["full", "partial", "allowance", "other"] as const;

export function ScholarshipForm({
  providers,
  scholarship,
}: {
  providers: AdminProvider[];
  scholarship?: AdminScholarshipDetail;
}) {
  return (
    <form action={upsertScholarshipFormAction} className="flex flex-col gap-4">
      {scholarship && <input type="hidden" name="id" value={scholarship.id} />}

      <div>
        <label className="block text-sm font-medium">Provider</label>
        <select
          name="provider_id"
          required
          defaultValue={scholarship?.provider_id ?? ""}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        >
          <option value="" disabled>
            Select a provider
          </option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Title</label>
        <input
          name="title"
          required
          defaultValue={scholarship?.title}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Slug</label>
        <input
          name="slug"
          required
          pattern="[a-z0-9-]+"
          defaultValue={scholarship?.slug}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Summary</label>
        <input
          name="summary"
          defaultValue={scholarship?.summary ?? ""}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={4}
          defaultValue={scholarship?.description ?? ""}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Coverage type</label>
        <select
          name="coverage_type"
          required
          defaultValue={scholarship?.coverage_type ?? "full"}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        >
          {COVERAGE_TYPES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Benefit summary</label>
        <input
          name="benefit_summary"
          defaultValue={scholarship?.benefit_summary ?? ""}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Official URL (must be *.gov.ph, *.edu.ph, or allowlisted)</label>
        <input
          name="official_url"
          type="url"
          required
          defaultValue={scholarship?.official_url}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Application URL (optional)</label>
        <input
          name="application_url"
          type="url"
          defaultValue={scholarship?.application_url ?? ""}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Last verified at (required to publish)</label>
        <input
          name="last_verified_at"
          type="datetime-local"
          defaultValue={scholarship?.last_verified_at?.slice(0, 16) ?? ""}
          className="mt-1 w-full rounded border border-black/20 px-3 py-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked={scholarship?.is_published ?? false} />
        Published (visible to students)
      </label>

      <button type="submit" className="mt-2 w-fit rounded border border-black px-4 py-2 text-sm">
        {scholarship ? "Save changes" : "Create scholarship"}
      </button>
    </form>
  );
}
