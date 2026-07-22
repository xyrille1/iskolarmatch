import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getProviders } from "@/lib/data/get-providers";
import { upsertProviderFormAction } from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Providers — Admin" };
export const dynamic = "force-dynamic";

const PROVIDER_TYPES = ["government", "lgu", "private", "university"] as const;

export default async function AdminProvidersPage() {
  const admin = await requireAdmin();
  const providers = await getProviders(admin);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Providers</h1>

      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {providers.map((p) => (
          <li key={p.id} className="border-b border-line py-2">
            {p.name} <span className="text-muted">({p.type})</span>
          </li>
        ))}
      </ul>

      <form action={upsertProviderFormAction} className="mt-8 flex flex-col gap-3 text-sm">
        <h2 className="text-lg font-semibold">Add provider</h2>
        <input name="name" placeholder="Name" required className="rounded border border-line px-2 py-1.5" />
        <select name="type" required className="rounded border border-line px-2 py-1.5">
          {PROVIDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input name="website" type="url" placeholder="https://..." className="rounded border border-line px-2 py-1.5" />
        <button type="submit" className="w-fit rounded border border-ink px-3 py-1.5">
          Add provider
        </button>
      </form>
    </div>
  );
}
