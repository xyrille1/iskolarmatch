import "server-only";
import { Resend } from "resend";
import { siteUrl } from "@/lib/site-url";

export interface DigestEmailItem {
  title: string;
  slug: string;
}

export interface DigestEmailPayload {
  to: string;
  items: DigestEmailItem[];
}

// FR20 (docs/PRD.md §4.3): opt-in weekly "new matches for you" digest.
export async function sendDigestEmail(payload: DigestEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be set.");
  }

  const resend = new Resend(apiKey);
  const url = siteUrl();

  const lines = payload.items.map((item) => `- ${item.title}: ${url}/s/${item.slug}`).join("\n");

  const { error } = await resend.emails.send({
    from: "IskolarMatch <digest@iskolarmatch.app>",
    to: payload.to,
    subject: `${payload.items.length} new scholarship match${payload.items.length === 1 ? "" : "es"} for you`,
    text: `New scholarships matching your saved profile:\n\n${lines}\n\nManage your saved profile and this digest anytime at ${url}/saved.\n\nAlways confirm details on each scholarship's official site before applying.`,
  });

  if (error) {
    throw new Error(`Failed to send digest email: ${error.message}`);
  }
}
