import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfigOrWarn } from "@/lib/env";

// Refreshes the Supabase auth session cookie on every request. Required
// per @supabase/ssr's Next.js guidance -- without this, sessions expire
// unpredictably because Server Components can't write cookies themselves.
// Next.js 16 renamed the "middleware" file convention to "proxy".
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Missing config degrades to a no-op (session refresh skipped) rather than
  // failing the request -- Edge Middleware runs on every route, so throwing
  // here would take down the whole site instead of just auth. The no-op is
  // now logged (once) instead of silent (docs/QA-CHECKLIST.md P1-03).
  const config = getSupabasePublicConfigOrWarn();
  if (!config) {
    return supabaseResponse;
  }
  const { url, anonKey } = config;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
