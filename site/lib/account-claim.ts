/**
 * Claiming the account attached to a volunteer registration.
 *
 * What this replaces: the old route took a submission id and an email, and if
 * the two matched it created an Auth user with `email_confirm: true` — marking
 * a mailbox verified that nobody had ever proved control of. The submission id
 * was the only secret, and it is not a secret: it is in the thank-you URL, in
 * the browser history, and in any link the person forwards. Anyone holding one
 * could mint a confirmed account on that address and inherit the registration.
 *
 * What it does instead: nothing is linked until a one-time code sent to the
 * mailbox comes back. Mailbox control is the whole proof, which is why the
 * 24-hour window on the old flow is gone — it existed to limit the damage of a
 * leaked id, and a person returning to a six-month-old registration should be
 * able to claim it rather than register a second time.
 *
 * The logic lives here, apart from Supabase, behind a small port interface.
 * That is what lets the ownership rules — wrong mailbox, reused claim, race
 * between two claimants — be tested exhaustively against fakes, with no
 * project, no network and no real mail.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ClaimSubmission = {
  id: string;
  kind: string;
  user_id: string | null;
  contact_email: string | null;
  created_at: string;
  fields: Record<string, unknown>;
};

/**
 * Everything this module needs from the outside world.
 *
 * Each port is one operation with one obvious real implementation, so the fake
 * used in tests cannot drift far from what Supabase actually does.
 */
export type ClaimPorts = {
  loadSubmission(id: string): Promise<ClaimSubmission | null>;
  /** Sends a one-time code. Resolves false when the provider refused. */
  sendCode(email: string): Promise<boolean>;
  /** Consumes a code. Returns the Auth user id, or null when it does not match. */
  verifyCode(email: string, code: string): Promise<string | null>;
  setPassword(userId: string, password: string): Promise<boolean>;
  /**
   * Attaches the submission to the user, but only while it is still unclaimed.
   * Returns false when another claimant got there first, which is what makes
   * two simultaneous claims resolve to one winner rather than to whoever
   * happened to write last.
   */
  linkSubmission(submissionId: string, userId: string): Promise<boolean>;
  /** Best-effort enrolment in the primary-skill network. Never fatal. */
  enrolInNetwork?(userId: string, fields: Record<string, unknown>): Promise<void>;
};

export function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type StartInput = { submissionId: unknown; email: unknown };

export type StartResult =
  | { ok: true; sent: boolean }
  | { ok: false; error: "invalid_request" | "provider_failed" };

/**
 * Step one: send a code, and say as little as possible about why.
 *
 * A successful response means "if that address belongs to a claimable
 * registration, a code is on its way" — the same answer whether the submission
 * does not exist, belongs to someone else's mailbox, or has already been
 * claimed. An unauthenticated caller must not be able to use this to discover
 * which addresses have registered or which already have accounts.
 *
 * `sent` is returned for the caller's own logging and tests. It is never put in
 * the HTTP response body.
 */
export async function startClaim(ports: ClaimPorts, input: StartInput): Promise<StartResult> {
  if (
    typeof input.submissionId !== "string" ||
    !UUID_PATTERN.test(input.submissionId) ||
    typeof input.email !== "string"
  ) {
    return { ok: false, error: "invalid_request" };
  }

  const email = normalizedEmail(input.email);
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false, error: "invalid_request" };

  const submission = await ports.loadSubmission(input.submissionId);

  const claimable =
    submission !== null &&
    submission.kind === "volunteer" &&
    submission.user_id === null &&
    typeof submission.contact_email === "string" &&
    normalizedEmail(submission.contact_email) === email;

  if (!claimable) return { ok: true, sent: false };

  const sent = await ports.sendCode(email);
  if (!sent) return { ok: false, error: "provider_failed" };
  return { ok: true, sent: true };
}

export type CompleteInput = {
  submissionId: unknown;
  email: unknown;
  code: unknown;
  password: unknown;
};

export type CompleteError =
  | "invalid_request"
  | "weak_password"
  | "invalid_code"
  | "submission_unavailable"
  | "already_claimed"
  | "server_error";

export type CompleteResult = { ok: true; userId: string } | { ok: false; error: CompleteError };

/**
 * Step two: prove the mailbox, then link.
 *
 * The order is the security property. The code is verified before the
 * submission is even re-read, so every answer after that point is given only to
 * someone who has demonstrably received mail at that address. Before it, the
 * caller learns nothing but whether their own code was right.
 */
export async function completeClaim(
  ports: ClaimPorts,
  input: CompleteInput
): Promise<CompleteResult> {
  if (
    typeof input.submissionId !== "string" ||
    !UUID_PATTERN.test(input.submissionId) ||
    typeof input.email !== "string" ||
    typeof input.code !== "string" ||
    input.code.trim() === "" ||
    input.code.length > 12 ||
    typeof input.password !== "string"
  ) {
    return { ok: false, error: "invalid_request" };
  }

  const email = normalizedEmail(input.email);
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "invalid_request" };
  }
  if (
    input.password.length < MIN_PASSWORD_LENGTH ||
    input.password.length > MAX_PASSWORD_LENGTH
  ) {
    return { ok: false, error: "weak_password" };
  }

  const userId = await ports.verifyCode(email, input.code.trim());
  if (!userId) return { ok: false, error: "invalid_code" };

  const submission = await ports.loadSubmission(input.submissionId);
  if (!submission || submission.kind !== "volunteer") {
    return { ok: false, error: "submission_unavailable" };
  }
  if (
    typeof submission.contact_email !== "string" ||
    normalizedEmail(submission.contact_email) !== email
  ) {
    // The mailbox is proven, but it is not the mailbox on this registration.
    return { ok: false, error: "submission_unavailable" };
  }

  if (submission.user_id !== null) {
    // Re-running a claim you already completed is a success, not an error: it
    // is what a refreshed tab or a retried request looks like.
    if (submission.user_id === userId) {
      await setPasswordAndEnrol(ports, userId, input.password, submission);
      return { ok: true, userId };
    }
    return { ok: false, error: "already_claimed" };
  }

  const linked = await ports.linkSubmission(submission.id, userId);
  if (!linked) return { ok: false, error: "already_claimed" };

  const ready = await setPasswordAndEnrol(ports, userId, input.password, submission);
  if (!ready) return { ok: false, error: "server_error" };

  return { ok: true, userId };
}

async function setPasswordAndEnrol(
  ports: ClaimPorts,
  userId: string,
  password: string,
  submission: ClaimSubmission
): Promise<boolean> {
  const set = await ports.setPassword(userId, password);
  if (!set) return false;
  // Best effort: someone who lands unenrolled just sees the Join button, and
  // failing the whole claim over it would strand an account that already exists.
  if (ports.enrolInNetwork) {
    try {
      await ports.enrolInNetwork(userId, submission.fields ?? {});
    } catch {
      // Intentionally swallowed; the claim itself has succeeded.
    }
  }
  return true;
}
