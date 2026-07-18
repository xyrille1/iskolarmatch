import "server-only";
import { Resend } from "resend";

export interface ReminderEmailPayload {
  to: string;
  scholarshipTitle: string;
  scholarshipSlug: string;
  closesAt: string;
}

// FR8: email reminder N days before a saved scholarship's deadline.
export async function sendReminderEmail(payload: ReminderEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be set.");
  }

  const resend = new Resend(apiKey);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const detailUrl = `${siteUrl}/s/${payload.scholarshipSlug}`;

  const { error } = await resend.emails.send({
    from: "IskolarMatch <reminders@iskolarmatch.app>",
    to: payload.to,
    subject: `Deadline coming up: ${payload.scholarshipTitle}`,
    text: `${payload.scholarshipTitle} closes on ${payload.closesAt}.\n\nView details and apply on the official site: ${detailUrl}\n\nAlways confirm details on the official site before applying.`,
  });

  if (error) {
    throw new Error(`Failed to send reminder email: ${error.message}`);
  }
}
