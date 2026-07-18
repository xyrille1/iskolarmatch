import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getProviders } from "@/lib/data/get-providers";
import { ScholarshipForm } from "@/components/admin/scholarship-form";

export const metadata: Metadata = { title: "New scholarship — Admin" };
export const dynamic = "force-dynamic";

export default async function NewScholarshipPage() {
  await requireAdmin();
  const providers = await getProviders();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">New scholarship</h1>
      <div className="mt-6">
        <ScholarshipForm providers={providers} />
      </div>
    </div>
  );
}
