import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role client. `import 'server-only'` above makes an accidental
// client-bundle import a build-time failure, not just a runtime footgun.
// Never read a NEXT_PUBLIC_-prefixed env var here.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
