// Dev-only helper: grants admin access to an existing auth user by email.
// Usage: npx tsx scripts/grant-admin.ts <email>
//
// Mirrors the manual, service-role-only grant path required by
// lib/auth/require-admin.ts and docs/SECURITY.md §3.4 -- there is no
// self-service admin signup, so this script is the local-dev stand-in for
// whatever the team's real grant procedure ends up being in production.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

// No dotenv dependency in this project -- tsx doesn't auto-load .env files,
// so parse .env.local the same minimal way `supabase` CLI / Next.js expect
// it to be shaped (KEY=VALUE, no export/quoting support needed here).
function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, value] = match;
    process.env[key] ??= value;
  }
}

async function main() {
  loadEnvLocal();

  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/grant-admin.ts <email>");
    process.exitCode = 1;
    return;
  }

  const supabase = createSupabaseAdminClient();

  // admin.listUsers has no filter-by-email param; page through results
  // instead of guessing an index (fine at local-dev user counts).
  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    console.error(`No auth user found for ${email}. Sign up via /auth first, then re-run this script.`);
    process.exitCode = 1;
    return;
  }

  const { error: insertError } = await supabase
    .from("admin_users")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (insertError) throw insertError;

  console.log(`Granted admin access to ${email} (user_id: ${userId}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
