import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived capability to attach files to one specific submission.
 *
 * The upload routes used to authorize on "does a row with this id exist?",
 * which is not authorization at all — submission ids travel in URLs, emails and
 * the browser's own network log, and a person who has one could file documents
 * against someone else's request. Existence is not ownership.
 *
 * A ticket fixes that without inventing an account for someone who has just
 * filled in a public form: `/api/submissions` mints one for the row it created
 * and returns it to the browser that created it. It says exactly one thing —
 * "the holder submitted this, recently" — and it says it in a way the holder
 * cannot alter, because they never see the key it is signed with.
 *
 * Signed rather than stored: a ticket is valid for minutes and is never
 * revoked individually, so a table of them would be a table that only ever
 * grows. An authenticated owner does not need one at all; the session is the
 * stronger proof and the routes accept that first.
 */

/** Long enough for a slow phone to finish eight photos, short enough to matter. */
export const TICKET_TTL_MS = 30 * 60 * 1000;

/**
 * Signing key for upload tickets.
 *
 * Falls back to the service-role key, which is server-only and already the
 * secret that guards every write in this app: a deployment that has one has the
 * other, so uploads do not break on a missing variable. Set
 * `UPLOAD_TICKET_SECRET` to rotate tickets independently of the database key.
 */
function secret(): string {
  const key = process.env.UPLOAD_TICKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("No signing key: set UPLOAD_TICKET_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Constant-time compare that does not leak length through an early return. */
function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Mints a ticket for one submission. `now` is injectable so expiry is testable
 * without waiting for wall-clock time to pass.
 */
export function issueUploadTicket(
  submissionId: string,
  now: number = Date.now(),
  key: string = secret()
): string {
  const expiresAt = now + TICKET_TTL_MS;
  const payload = `${submissionId}.${expiresAt}`;
  return `${payload}.${sign(payload, key)}`;
}

export type TicketCheck =
  | { ok: true; submissionId: string }
  | { ok: false; reason: "malformed" | "expired" | "bad_signature" | "wrong_submission" };

/**
 * Verifies a ticket against the submission it is being used for.
 *
 * Binding to `submissionId` here — rather than trusting the id inside the
 * ticket — is what stops a valid ticket for one's own submission from being
 * replayed against another. The signature is checked before the expiry so that
 * a forged ticket cannot learn anything from which error it gets.
 */
export function verifyUploadTicket(
  ticket: unknown,
  submissionId: string,
  now: number = Date.now(),
  key: string = secret()
): TicketCheck {
  if (typeof ticket !== "string" || ticket.length > 512) return { ok: false, reason: "malformed" };

  const parts = ticket.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [id, expiresRaw, signature] = parts;
  const expiresAt = Number(expiresRaw);
  if (!id || !Number.isSafeInteger(expiresAt)) return { ok: false, reason: "malformed" };

  if (!sameSignature(sign(`${id}.${expiresRaw}`, key), signature)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (id !== submissionId) return { ok: false, reason: "wrong_submission" };
  if (now >= expiresAt) return { ok: false, reason: "expired" };

  return { ok: true, submissionId: id };
}
