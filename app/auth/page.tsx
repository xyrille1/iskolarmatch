import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { title: "Sign in — IskolarMatch" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AuthPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-[46ch] px-6 py-16">
          <AuthForm next={next ?? "/saved"} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
