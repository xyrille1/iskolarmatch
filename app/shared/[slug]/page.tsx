import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { StatusDot } from "@/components/ui/status-dot";
import { getSharedSavedList } from "@/lib/data/get-shared-saved-list";

export const metadata: Metadata = { title: "Shared shortlist — IskolarMatch" };
// Reads a live RPC keyed off the URL slug -- never statically prerenderable.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// FR19 (docs/PRD.md §4.3): read-only, no account needed to view -- e.g. a
// parent or guidance counselor following a shared link.
export default async function SharedSavedListPage({ params }: PageProps) {
  const { slug } = await params;
  const items = await getSharedSavedList(slug);

  if (items === null) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[62ch] px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Shared shortlist</p>
          <h1 className="reveal mt-2 font-serif text-4xl font-light leading-tight sm:text-5xl">
            A saved scholarship shortlist.
          </h1>
          <p className="mt-2 text-muted">Shared read-only -- no account needed to view.</p>

          <ul className="mt-8 flex flex-col divide-y divide-line">
            {items.map((item) => (
              <li key={item.slug} className="py-6">
                <p className="text-sm text-muted">{item.providerName}</p>
                <Link
                  href={`/s/${item.slug}`}
                  className="link-trace mt-1 block w-fit font-serif text-2xl font-light leading-tight"
                >
                  {item.title}
                </Link>
                <div className="mt-2">
                  <StatusDot status={item.status} closesAt={item.closesAt} opensAt={item.opensAt} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
