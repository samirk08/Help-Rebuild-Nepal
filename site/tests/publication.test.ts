import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PUBLISHED_STATUSES,
  canAcceptInterest,
  dataOr,
  isPublicNeed,
  isPublicProject,
  ok,
  unavailable,
} from "../lib/publication";
import { PUBLISHED_STATUSES as NEEDS_STATUSES } from "../lib/public-needs";
import { OPEN_NEED_STATUSES } from "../lib/matching/types";

const EVERY_STATUS = [
  "submitted",
  "under_review",
  "verified",
  "recruiting",
  "filled",
  "completed",
  "rejected",
];

test("only reviewed needs are public, and unreviewed or rejected ones never are", () => {
  for (const status of EVERY_STATUS) {
    const expected = (PUBLISHED_STATUSES as readonly string[]).includes(status);
    assert.equal(isPublicNeed({ kind: "need", status }), expected, status);
  }

  assert.equal(isPublicNeed({ kind: "need", status: "rejected" }), false);
  assert.equal(isPublicNeed({ kind: "need", status: "submitted" }), false);
  assert.equal(isPublicNeed({ kind: "need", status: null }), false);

  // A volunteer registration is never a public need, whatever its status.
  assert.equal(isPublicNeed({ kind: "volunteer", status: "verified" }), false);
});

test("published and open are different questions", () => {
  // Filled and completed are readable — they are the record of what happened —
  // but they cannot take new offers of help.
  assert.equal(isPublicNeed({ kind: "need", status: "filled" }), true);
  assert.equal(canAcceptInterest("filled"), false);
  assert.equal(canAcceptInterest("completed"), false);

  assert.equal(canAcceptInterest("verified"), true);
  assert.equal(canAcceptInterest("recruiting"), true);
  assert.equal(canAcceptInterest("rejected"), false);
  assert.equal(canAcceptInterest(undefined), false);
});

test("every surface uses the same publication rule", () => {
  // The board's list and the shared rule are one list, not two that drift.
  assert.deepEqual([...NEEDS_STATUSES], [...PUBLISHED_STATUSES]);
  // And the interest route's open-statuses match what canAcceptInterest allows.
  for (const status of EVERY_STATUS) {
    assert.equal(canAcceptInterest(status), OPEN_NEED_STATUSES.includes(status), status);
  }
});

test("a project is never more public than the need behind it", () => {
  const published = { kind: "need", status: "verified" };
  const withdrawn = { kind: "need", status: "rejected" };

  assert.equal(isPublicProject({ stage: "active", need: published }), true);
  // A need rejected after promotion used to keep its project on the public
  // projects page.
  assert.equal(isPublicProject({ stage: "active", need: withdrawn }), false);
  assert.equal(isPublicProject({ stage: "active", need: null }), true);
  assert.equal(isPublicProject({ stage: "draft", need: published }), false);
});

test("a failed read is distinguishable from a successful empty one", () => {
  const empty = ok<string[]>([], "2026-09-06T12:00:00.000Z");
  const broken = unavailable<string[]>("42P01");

  assert.equal(empty.state, "ok");
  assert.equal(broken.state, "unavailable");

  // The distinction the old `return []` collapsed: both render as no rows, but
  // only one of them means "nothing has been posted yet".
  assert.notEqual(empty.state, broken.state);
  assert.deepEqual(dataOr(empty, ["fallback"]), []);
  assert.deepEqual(dataOr(broken, ["fallback"]), ["fallback"]);

  assert.equal(empty.state === "ok" && empty.lastUpdated, "2026-09-06T12:00:00.000Z");
});
