import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in — IskolarMatch" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AuthPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-[46ch] px-6 py-16">
      <AuthForm next={next ?? "/saved"} />
    </div>
  );
}
