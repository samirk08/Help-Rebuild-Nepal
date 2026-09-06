import { validEmail } from "./catalog";
import type { Role, Recommendation } from "./types";

export type EmailPayload = { to: string; subject: string; text: string };
export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return env.MATCHING_EMAIL_ENABLED === "1" && !!env.RESEND_API_KEY && !!env.MATCHING_FROM_EMAIL && !!env.MATCHING_SITE_URL && !!env.MATCHING_WORKER_SECRET;
}
export function invitationEmail(role: Role, recommendation: Recommendation, recipient: string, requesterEmail: string, responseUrl: string): EmailPayload {
  if (!validEmail(recipient) || !validEmail(requesterEmail)) throw new Error("Valid contact emails are required.");
  const c = role.config;
  return {
    to:recipient,
    subject:`Help Rebuild Nepal: ${role.title}`,
    text:`Hello ${recommendation.name},\n\nWe would like to invite you to consider: ${role.title}.\n\n${c.startDate} to ${c.endDate}\n${c.hoursPerWeek} hours per week · ${c.workMode}${c.district ? ` · ${c.district}` : ""}\n\nWhy we contacted you:\n${recommendation.checks.filter(x => x.result === "pass").map(x => `• ${x.reason}`).join("\n")}\n${recommendation.reasons.join("\n")}\n\nRequester contact: ${requesterEmail}\n\nReview the full need, support arrangements, and choose Proceed or Decline:\n${responseUrl}\n\nProceed confirms your interest and availability; the coordination team confirms the place with both parties. For on-site work, confirm that you can reach the location by the start date. You can also pause future invitations on this page.\n\nHelp Rebuild Nepal`,
  };
}

/** The caller persists results. A stable outbox UUID is the idempotency key. */
export async function sendMatchingEmail(id: string, payload: EmailPayload, request: typeof fetch = fetch): Promise<string> {
  if (!emailConfigured()) throw new Error("Matching email is not enabled.");
  if (!validEmail(payload.to)) throw new Error("Invalid recipient.");
  const response = await request("https://api.resend.com/emails", {
    method:"POST", headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}`, "Content-Type":"application/json", "Idempotency-Key":`hrn-matching/${id}` },
    body:JSON.stringify({ from:process.env.MATCHING_FROM_EMAIL, reply_to:process.env.MATCHING_REPLY_TO || process.env.MATCHING_FROM_EMAIL, ...payload }),
    signal:AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
  const data = await response.json() as { id?: string };
  if (!data.id) throw new Error("Email provider returned an uncertain send result.");
  return data.id;
}
