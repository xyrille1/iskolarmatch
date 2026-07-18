import "server-only";
import { timingSafeEqual } from "node:crypto";

// Bearer-token check for cron/Route Handler endpoints (Context/iskolar-security.md
// SR-S: "CRON_SECRET -- bearer token authenticating cron/Edge Function HTTP
// endpoints"). Constant-time comparison to avoid a timing side-channel.
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
