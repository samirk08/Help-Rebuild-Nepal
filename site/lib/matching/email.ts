import { validEmail } from "./catalog";
import type { Lang } from "../content";
import { invitationMail } from "../mail-copy";
import type { Role, Recommendation } from "./types";

export type EmailPayload = { to: string; subject: string; text: string };
export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return env.MATCHING_EMAIL_ENABLED === "1" && !!env.RESEND_API_KEY && !!env.MATCHING_FROM_EMAIL && !!env.MATCHING_SITE_URL && !!env.MATCHING_WORKER_SECRET;
}
/**
 * The invitation, in the language the volunteer registered in.
 *
 * The wording lives in lib/mail-copy.ts with every other message, so that the
 * whole of what this platform says to people is reviewable in one file by
 * someone who reads Nepali. This function keeps the guard that matters — an
 * invitation with an unusable address on either side is never composed — and
 * assembles the engine's own reasons into the body.
 */
export function invitationEmail(role: Role, recommendation: Recommendation, recipient: string, requesterEmail: string, responseUrl: string, lang: Lang = "en"): EmailPayload {
  if (!validEmail(recipient) || !validEmail(requesterEmail)) throw new Error("Valid contact emails are required.");
  const c = role.config;
  const payload = invitationMail(lang, {
    name: recommendation.name,
    roleTitle: role.title,
    startDate: c.startDate,
    endDate: c.endDate,
    hoursPerWeek: c.hoursPerWeek,
    workMode: c.workMode,
    district: c.district,
    // The passing checks explain the choice in the engine's own words; the
    // reasons are the tie-breakers on top of them.
    reasons: [
      ...recommendation.checks.filter(x => x.result === "pass").map(x => `• ${x.reason}`),
      ...recommendation.reasons,
    ],
    requesterEmail,
    responseUrl,
  });
  return { ...payload, to: recipient };
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
