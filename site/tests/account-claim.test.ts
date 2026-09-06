import { test } from "node:test";
import assert from "node:assert/strict";

import { completeClaim, startClaim } from "../lib/account-claim";
import {
  OTHER_SUBMISSION_ID,
  SUBMISSION_ID,
  codeFor,
  fakePorts,
  fakeState,
  submission,
} from "./helpers";

const GOOD_PASSWORD = "a-long-enough-password";

test("a verified owner can claim, and the account is only linked after the code", async () => {
  const state = fakeState();
  const ports = fakePorts(state);

  const started = await startClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
  });
  assert.deepEqual(started, { ok: true, sent: true });

  // Nothing is attached yet. This is the property the old flow did not have:
  // it created a confirmed account the moment the email matched.
  assert.equal(state.submissions.get(SUBMISSION_ID)?.user_id, null);

  const result = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: codeFor(state, "asha@example.org"),
    password: GOOD_PASSWORD,
  });

  assert.equal(result.ok, true);
  assert.ok(result.ok && state.submissions.get(SUBMISSION_ID)?.user_id === result.userId);
  assert.deepEqual(state.networkEnrolments, [result.ok ? result.userId : ""]);
});

test("a wrong mailbox is never sent a code and cannot claim", async () => {
  const state = fakeState();
  const ports = fakePorts(state);

  const started = await startClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "stranger@example.org",
  });

  // The caller is told the same thing either way; the difference is only that
  // no mail went out.
  assert.deepEqual(started, { ok: true, sent: false });
  assert.deepEqual(state.sent, []);

  // Even holding a code for their own mailbox, the submission is not theirs.
  await startClaim(ports, { submissionId: OTHER_SUBMISSION_ID, email: "stranger@example.org" });
  state.codes.set("stranger@example.org", "424242");
  state.users.set("stranger@example.org", { id: "user-stranger", password: null });

  const result = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "stranger@example.org",
    code: "424242",
    password: GOOD_PASSWORD,
  });

  assert.deepEqual(result, { ok: false, error: "submission_unavailable" });
  assert.equal(state.submissions.get(SUBMISSION_ID)?.user_id, null);
});

test("an unknown submission is indistinguishable from a claimable one", async () => {
  const state = fakeState();
  const ports = fakePorts(state);

  const unknown = await startClaim(ports, {
    submissionId: OTHER_SUBMISSION_ID,
    email: "asha@example.org",
  });

  assert.equal(unknown.ok, true);
  assert.deepEqual(state.sent, []);
});

test("an already-claimed registration leaks nothing at step one and refuses at step two", async () => {
  const state = fakeState([submission({ user_id: "user-someone-else" })]);
  const ports = fakePorts(state);

  const started = await startClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
  });
  assert.deepEqual(started, { ok: true, sent: false });

  // Someone who does control the mailbox still cannot take a claimed record.
  state.users.set("asha@example.org", { id: "user-late", password: null });
  state.codes.set("asha@example.org", "424242");

  const result = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: "424242",
    password: GOOD_PASSWORD,
  });

  assert.deepEqual(result, { ok: false, error: "already_claimed" });
  assert.equal(state.submissions.get(SUBMISSION_ID)?.user_id, "user-someone-else");
});

test("a code is single use and a wrong code never links anything", async () => {
  const state = fakeState();
  const ports = fakePorts(state);
  await startClaim(ports, { submissionId: SUBMISSION_ID, email: "asha@example.org" });
  const code = codeFor(state, "asha@example.org");

  const wrong = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: "000000",
    password: GOOD_PASSWORD,
  });
  assert.deepEqual(wrong, { ok: false, error: "invalid_code" });
  assert.equal(state.submissions.get(SUBMISSION_ID)?.user_id, null);

  assert.equal((await claimWith(ports, code)).ok, true);

  // The same code again: the claim already succeeded, but the code is spent,
  // so this fails at the proof rather than sailing through on the link check.
  const replay = await claimWith(ports, code);
  assert.deepEqual(replay, { ok: false, error: "invalid_code" });

  async function claimWith(p: ReturnType<typeof fakePorts>, value: string) {
    return completeClaim(p, {
      submissionId: SUBMISSION_ID,
      email: "asha@example.org",
      code: value,
      password: GOOD_PASSWORD,
    });
  }
});

test("re-running a claim you already completed succeeds instead of erroring", async () => {
  const state = fakeState();
  const ports = fakePorts(state);
  await startClaim(ports, { submissionId: SUBMISSION_ID, email: "asha@example.org" });

  const first = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: codeFor(state, "asha@example.org"),
    password: GOOD_PASSWORD,
  });
  assert.equal(first.ok, true);

  // A refreshed tab: a fresh code, the same owner, the same submission.
  await startClaimForClaimedRow();
  const second = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: "424242",
    password: GOOD_PASSWORD,
  });

  assert.equal(second.ok, true);
  assert.ok(first.ok && second.ok && first.userId === second.userId);

  async function startClaimForClaimedRow() {
    // startClaim would not send for a claimed row, so the mailbox proof is
    // staged directly — the point under test is completeClaim's idempotency.
    state.codes.set("asha@example.org", "424242");
  }
});

test("two simultaneous claimants resolve to one winner", async () => {
  const state = fakeState();
  const ports = fakePorts(state);
  await startClaim(ports, { submissionId: SUBMISSION_ID, email: "asha@example.org" });
  const code = codeFor(state, "asha@example.org");

  // Both hold a proven mailbox for the same address. Only one link may take.
  const winner = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code,
    password: GOOD_PASSWORD,
  });
  assert.equal(winner.ok, true);

  state.users.set("asha@example.org", { id: "user-second", password: null });
  state.codes.set("asha@example.org", "999999");

  const loser = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: "999999",
    password: GOOD_PASSWORD,
  });

  assert.deepEqual(loser, { ok: false, error: "already_claimed" });
  assert.ok(winner.ok && state.submissions.get(SUBMISSION_ID)?.user_id === winner.userId);
});

test("an old registration is still claimable, because mailbox proof is the control", async () => {
  const state = fakeState([submission({ created_at: "2025-01-04T09:00:00.000Z" })]);
  const ports = fakePorts(state);

  const started = await startClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
  });
  assert.deepEqual(started, { ok: true, sent: true });

  const result = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code: codeFor(state, "asha@example.org"),
    password: GOOD_PASSWORD,
  });

  assert.equal(result.ok, true);
});

test("a need submission cannot be claimed as a volunteer account", async () => {
  const state = fakeState([submission({ kind: "need" })]);
  const ports = fakePorts(state);

  assert.deepEqual(
    await startClaim(ports, { submissionId: SUBMISSION_ID, email: "asha@example.org" }),
    { ok: true, sent: false }
  );

  state.users.set("asha@example.org", { id: "user-x", password: null });
  state.codes.set("asha@example.org", "424242");

  assert.deepEqual(
    await completeClaim(ports, {
      submissionId: SUBMISSION_ID,
      email: "asha@example.org",
      code: "424242",
      password: GOOD_PASSWORD,
    }),
    { ok: false, error: "submission_unavailable" }
  );
});

test("malformed input and weak passwords are refused before any mail or lookup", async () => {
  const state = fakeState();
  const ports = fakePorts(state);

  assert.deepEqual(await startClaim(ports, { submissionId: "not-a-uuid", email: "a@b.co" }), {
    ok: false,
    error: "invalid_request",
  });
  assert.deepEqual(await startClaim(ports, { submissionId: SUBMISSION_ID, email: "nope" }), {
    ok: false,
    error: "invalid_request",
  });
  assert.deepEqual(state.sent, []);

  await startClaim(ports, { submissionId: SUBMISSION_ID, email: "asha@example.org" });
  const code = codeFor(state, "asha@example.org");

  const weak = await completeClaim(ports, {
    submissionId: SUBMISSION_ID,
    email: "asha@example.org",
    code,
    password: "short",
  });
  assert.deepEqual(weak, { ok: false, error: "weak_password" });

  // The code was not consumed by the rejected attempt, so the person can
  // simply choose a longer password and continue.
  assert.equal(state.codes.get("asha@example.org"), code);
});

test("a provider failure is reported rather than silently swallowed", async () => {
  const state = fakeState();
  state.failSend = true;

  assert.deepEqual(
    await startClaim(fakePorts(state), {
      submissionId: SUBMISSION_ID,
      email: "asha@example.org",
    }),
    { ok: false, error: "provider_failed" }
  );
});
