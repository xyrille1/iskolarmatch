import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/env';

// Service-role client. `import 'server-only'` above makes an accidental
// client-bundle import a build-time failure, not just a runtime footgun.
// Never read a NEXT_PUBLIC_-prefixed env var here.
export function createSupabaseAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = requireSupabaseAdminEnv();

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
