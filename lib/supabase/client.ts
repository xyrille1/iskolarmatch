import { createClient } from '@supabase/supabase-js';
import { requireSupabasePublicEnv } from '@/lib/env';

// Anon-key client. Safe to use in either client or server context: RLS is
// what actually enforces access control, not secrecy of this key.
export function createSupabaseClient() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = requireSupabasePublicEnv();

  return createClient(url, anonKey);
}
