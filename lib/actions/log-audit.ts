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
  const { error } = await supabase
    .from("audit_log")
    .insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, detail });

  // The audit trail is a compliance record (docs/SECURITY.md §3.7). A silent
  // failure here means a privileged mutation succeeded with NO record that it
  // happened -- an audit log that lies is worse than none. Fail loudly:
  // surface to server logs (route to an error-tracking sink in prod) AND throw
  // so the caller cannot report success on top of a missing audit entry.
  if (error) {
    console.error(
      `[audit] Failed to record ${action} on ${entityType}(${entityId ?? "null"}) by ${actorId}: ${error.message}`
    );
    throw new Error("Failed to write the audit-log entry for this action.");
  }
}
