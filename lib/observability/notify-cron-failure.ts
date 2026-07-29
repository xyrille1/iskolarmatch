import "server-only";
import { Resend } from "resend";

// P0-03 (docs/INFRA-AUDIT-REPORT.md): every cron handler used to swallow a
// hard failure into a bare 500 with zero signal outside the Vercel dashboard.
// This is the single on-failure notification path all 5 cron handlers call
// from their error branches -- one place to change if the alerting channel
// ever moves off email. Best-effort by design: a failure to *send* the alert
// must never mask the cron's original failure or throw into the caller, so
// this always resolves and falls back to console.error (the pre-existing,
// still-present signal) when it can't reach an operator any other way.
export interface CronFailureContext {
  cron: string;
  reason: string;
}

export async function notifyCronFailure({ cron, reason }: CronFailureContext): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.CRON_ALERT_EMAIL;

  if (!apiKey || !alertEmail) {
    console.error(`[cron:${cron}] failed, no alert channel configured (set CRON_ALERT_EMAIL): ${reason}`);
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "IskolarMatch Alerts <alerts@iskolarmatch.app>",
      to: alertEmail,
      subject: `[IskolarMatch] Cron failed: ${cron}`,
      text: `The "${cron}" cron failed at ${new Date().toISOString()}.\n\nReason: ${reason}\n\nCheck the Vercel dashboard for full logs.`,
    });
    if (error) {
      console.error(`[cron:${cron}] alert email failed to send: ${error.message}. Original failure: ${reason}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron:${cron}] alert email threw: ${message}. Original failure: ${reason}`);
  }
}
