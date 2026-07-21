import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// User-scoped client for Server Components/Actions/Route Handlers: uses the
// anon key + the caller's session cookie, so RLS applies as that user (never
// the service role). Must be created fresh per request per @supabase/ssr's
// own guidance -- never shared/cached across requests.
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render, where cookies can't be
          // set -- middleware.ts handles session refresh in that case.
        }
      },
    },
  });
}
