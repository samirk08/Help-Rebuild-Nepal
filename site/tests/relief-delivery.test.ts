import test from "node:test";
import assert from "node:assert/strict";

import {
  canAcceptPledge,
  committedPercent,
  nextStages,
  receivedPercent,
  remainingDemand,
} from "../lib/relief-delivery";

/**
 * The arithmetic behind the relief progress bar.
 *
 * Kept separate from the database tests because these are the cases a reader
 * of the public page hits — an over-offered request, a partial delivery, a
 * request for zero — and none of them need Postgres to be wrong.
 */

const need = (over: Partial<Parameters<typeof remainingDemand>[0]> = {}) => ({
  quantity: 200,
  pledged: 0,
  committed: 0,
  received: 0,
  ...over,
});

test("offers do not reduce what is still needed", () => {
  // The correction this whole phase exists to make. 200 offered and nothing
  // arranged leaves 200 to find.
  assert.equal(remainingDemand(need({ pledged: 200 })), 200);
  assert.equal(remainingDemand(need({ pledged: 200, committed: 200 })), 0);
  assert.equal(remainingDemand(need({ received: 140, committed: 0 })), 60);
});

test("remaining never goes negative", () => {
  // Over-delivery is real: three donors each send the full amount because
  // nobody told them the others had. The board must read "nothing still
  // needed", not "-400 needed".
  assert.equal(remainingDemand(need({ received: 200, committed: 400 })), 0);
});

test("the bar shows what arrived, with what is merely arranged behind it", () => {
  const partly = need({ received: 50, committed: 100 });
  assert.equal(receivedPercent(partly), 25);
  assert.equal(committedPercent(partly), 50);

  // The two segments are drawn end to end, so together they can never claim
  // more than a full bar even when commitments overshoot the request.
  const overshoot = need({ received: 100, committed: 400 });
  assert.equal(receivedPercent(overshoot) + committedPercent(overshoot), 100);
});

test("a request for nothing does not divide by zero", () => {
  assert.equal(receivedPercent(need({ quantity: 0 })), 0);
  assert.equal(committedPercent(need({ quantity: 0 })), 0);
});

test("a closed or fully allocated request refuses an offer, and says which", () => {
  assert.equal(canAcceptPledge({ ...need(), status: "requested" }).ok, true);

  const code = (n: Parameters<typeof canAcceptPledge>[0]) => {
    const verdict = canAcceptPledge(n);
    return verdict.ok ? null : verdict.code;
  };

  assert.equal(code({ ...need(), status: "closed" }), "need_closed");
  assert.equal(code({ ...need({ committed: 200 }), status: "requested" }), "need_allocated");

  // Fully offered but nothing arranged is a different refusal: the request may
  // well come back to this donor if the arranged deliveries fall through, and
  // the message they get has to say so.
  assert.equal(code({ ...need({ pledged: 200 }), status: "requested" }), "need_fully_offered");
});

test("an unverified offer can only be cancelled", () => {
  // Reserving means arranging a collection from a donor nobody has checked.
  assert.deepEqual(nextStages("offered", "submitted"), ["cancelled"]);
  assert.deepEqual(nextStages("offered", "verified"), ["reserved", "cancelled"]);
});

test("received and cancelled are terminal", () => {
  assert.deepEqual(nextStages("received", "verified"), []);
  assert.deepEqual(nextStages("cancelled", "verified"), []);
});
