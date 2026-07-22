import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Append-only audit trail (audit_log). Extracted from lib/actions/admin.ts so
// both admin.ts and lib/actions/suggestions.ts share one implementation instead
// of duplicating the insert. Every privileged mutation logs through here.
export async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("audit_log")
    .insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, detail });
}
