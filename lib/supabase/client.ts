import { createClient } from '@supabase/supabase-js';

// Anon-key client. Safe to use in either client or server context: RLS is
// what actually enforces access control, not secrecy of this key.
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.');
  }

  return createClient(url, anonKey);
}
