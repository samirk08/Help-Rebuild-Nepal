import type { ClaimPorts, ClaimSubmission } from "../lib/account-claim";

/**
 * Fakes for the ports the account-claim rules depend on.
 *
 * Phase 0 asks for ownership rules to be testable without a production Supabase
 * project, and this is what makes that possible: every decision in
 * `lib/account-claim.ts` is expressed against these five operations, so the
 * tests drive the real logic and only the storage and the mail are pretend.
 *
 * The fake deliberately mimics the parts of Supabase's behaviour the rules rely
 * on — a code is single-use, a link only succeeds while the row is unclaimed —
 * because a fake that is more permissive than the real thing would let a test
 * pass on a rule that does not actually hold.
 */

export type FakeState = {
  submissions: Map<string, ClaimSubmission>;
  /** Codes handed out, by email. Deleted once used, like a real OTP. */
  codes: Map<string, string>;
  /** Auth users, by email. */
  users: Map<string, { id: string; password: string | null }>;
  sent: string[];
  networkEnrolments: string[];
  /** Set to fail the next send, to exercise the provider-failure path. */
  failSend: boolean;
};

export const SUBMISSION_ID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
export const OTHER_SUBMISSION_ID = "9e8d7c6b-5a49-4382-91f0-e1d2c3b4a596";

export function submission(overrides: Partial<ClaimSubmission> = {}): ClaimSubmission {
  return {
    id: SUBMISSION_ID,
    kind: "volunteer",
    user_id: null,
    contact_email: "asha@example.org",
    created_at: "2026-03-01T09:00:00.000Z",
    fields: { consent: "on" },
    ...overrides,
  };
}

export function fakeState(rows: ClaimSubmission[] = [submission()]): FakeState {
  return {
    submissions: new Map(rows.map((row) => [row.id, { ...row }])),
    codes: new Map(),
    users: new Map(),
    sent: [],
    networkEnrolments: [],
    failSend: false,
  };
}

let nextUserId = 1;

export function fakePorts(state: FakeState): ClaimPorts {
  return {
    async loadSubmission(id) {
      const row = state.submissions.get(id);
      return row ? { ...row } : null;
    },

    async sendCode(email) {
      if (state.failSend) return false;
      // Supabase creates the Auth user when the code is sent; nothing is
      // confirmed until the code comes back.
      if (!state.users.has(email)) {
        state.users.set(email, { id: `user-${nextUserId++}`, password: null });
      }
      state.codes.set(email, "424242");
      state.sent.push(email);
      return true;
    },

    async verifyCode(email, code) {
      const expected = state.codes.get(email);
      if (!expected || expected !== code) return null;
      // Single use, as a real one-time code is.
      state.codes.delete(email);
      return state.users.get(email)?.id ?? null;
    },

    async setPassword(userId, password) {
      for (const user of state.users.values()) {
        if (user.id === userId) {
          user.password = password;
          return true;
        }
      }
      return false;
    },

    async linkSubmission(submissionId, userId, kind) {
      const row = state.submissions.get(submissionId);
      // The `is("user_id", null)` guard the real UPDATE carries: a second
      // claimant matches no row rather than overwriting the first.
      if (!row || row.kind !== kind || row.user_id !== null) return false;
      row.user_id = userId;
      return true;
    },

    async enrolInNetwork(userId) {
      state.networkEnrolments.push(userId);
    },
  };
}

/** Puts a code in the caller's hands the way a mailbox would. */
export function codeFor(state: FakeState, email: string): string {
  const code = state.codes.get(email);
  if (!code) throw new Error(`No code was sent to ${email}`);
  return code;
}

/**
 * A Request the way a route handler sees one, with or without a session.
 *
 * The auth-dependent routes read identity from a cookie, so an unauthenticated
 * request is simply one without it. Kept here so a test never has to remember
 * which header carries what.
 */
export function jsonRequest(
  url: string,
  body: unknown,
  options: { cookie?: string; ip?: string } = {}
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.ip) headers["x-forwarded-for"] = options.ip;

  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

/** The bytes a real file of each accepted type starts with. */
export const FILE_HEADERS = {
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
  pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  webp: new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  ]),
  heic: new Uint8Array([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
  ]),
  /** An HTML document renamed to .png — the forged-type case. */
  html: new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45, 0x20]),
} as const;
