import { test } from "node:test";
import assert from "node:assert/strict";

import { recommend } from "../lib/matching/engine";
import { readinessFor, STALE_AFTER_DAYS } from "../lib/matching/readiness";
import { peakWeeklyHours } from "../lib/volunteer-workspace";
import { context, now, profile, role, volunteer } from "./fixtures";

const NOW = Date.parse(now);

function keys(v = volunteer(), p = profile()) {
  return readinessFor(v, p, NOW).missing.map((m) => m.key);
}

test("a complete profile is ready, and nothing is listed", () => {
  const readiness = readinessFor(volunteer(), profile(), NOW);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.missing, []);
});

test("readiness agrees with the engine about who can be invited", () => {
  // The property that matters. A page telling someone they are ready while
  // the engine returns `unknown` for every role is worse than no page: they
  // wait for invitations that nobody can send.
  const complete = volunteer();
  const ready = readinessFor(complete, profile(), NOW);
  assert.equal(ready.ready, true);

  const result = recommend(role(), [complete], context());
  // "clarify" is precisely the engine's bucket for a volunteer with unknown
  // answers, so a person this page calls ready must not land in it.
  assert.equal(result.clarify.length, 0, "no unknown checks for a ready volunteer");
  assert.equal(result.ready.length, 1, "the engine should be able to invite them");
});

test("only what is missing is named, one item per gap", () => {
  assert.deepEqual(keys(volunteer(), profile("asha", { facts: { ...profile().facts, skills: null } })), [
    "skills",
  ]);
  assert.deepEqual(keys(volunteer(), profile("asha", { facts: { ...profile().facts, workMode: null } })), [
    "mode",
  ]);
  assert.deepEqual(
    keys(volunteer(), profile("asha", { facts: { ...profile().facts, hoursPerWeek: null } })),
    ["hours"]
  );
  assert.deepEqual(
    keys(volunteer(), profile("asha", { facts: { ...profile().facts, availableFrom: null } })),
    ["dates"]
  );
});

test("travel is only asked of someone who might be asked to travel", () => {
  const remote = profile("asha", { facts: { ...profile().facts, workMode: "remote", travel: null } });
  assert.equal(keys(volunteer(), remote).includes("travel"), false);

  const onsite = profile("asha", { facts: { ...profile().facts, workMode: "onsite", travel: null } });
  assert.ok(keys(volunteer(), onsite).includes("travel"));
});

test("no matching profile is one action, not a wall of items", () => {
  // Listing every unanswered fact separately would be eight bullet points for
  // a single form nobody has opened yet.
  const readiness = readinessFor(volunteer(), null, NOW);
  assert.deepEqual(readiness.missing.map((m) => m.key), ["profile"]);
  assert.equal(readiness.ready, false);
});

test("registration-level gaps are not blamed on the matching form", () => {
  const noEmail = volunteer("asha", { contact_email: null });
  const [missing] = readinessFor(noEmail, profile(), NOW).missing;
  assert.equal(missing.key, "email");
  // Telling someone to fix this in a form that does not contain the field
  // would send them in a circle.
  assert.equal(missing.fixes, "registration");

  const noConsent = volunteer("asha", { fields: {} });
  assert.equal(readinessFor(noConsent, profile(), NOW).missing[0].key, "consent");
});

test("waiting on a coordinator is reported, but not as the volunteer's task", () => {
  const pending = volunteer("asha", { status: "submitted" });
  const [item] = readinessFor(pending, profile(), NOW).missing;
  assert.equal(item.key, "review");
  assert.equal(item.fixes, "coordinator");
});

test("stale availability is a gap; a pause is a choice", () => {
  const old = new Date(NOW - (STALE_AFTER_DAYS + 1) * 86_400_000).toISOString();
  assert.ok(keys(volunteer(), profile("asha", { confirmed_at: old })).includes("freshness"));

  // Being paused must not appear in the missing list — it is the person's own
  // decision, and listing it reads as something they forgot to do.
  const paused = readinessFor(volunteer(), profile("asha", { paused: true }), NOW);
  assert.deepEqual(paused.missing, []);
  assert.equal(paused.ready, true);
  assert.equal(paused.paused, true);
});

test("commitments that do not overlap do not add up", () => {
  // The engine counts peak simultaneous hours. Summing disjoint work would
  // tell someone they are full when they are free, and stop invitations they
  // could have accepted.
  const disjoint = [
    { id: "a", roleTitle: "", needTitle: "", startDate: "2026-09-01", endDate: "2026-09-07", hoursPerWeek: 6 },
    { id: "b", roleTitle: "", needTitle: "", startDate: "2026-10-01", endDate: "2026-10-07", hoursPerWeek: 5 },
  ];
  assert.equal(peakWeeklyHours(disjoint), 6);

  const overlapping = [
    { id: "a", roleTitle: "", needTitle: "", startDate: "2026-09-01", endDate: "2026-09-30", hoursPerWeek: 6 },
    { id: "b", roleTitle: "", needTitle: "", startDate: "2026-09-10", endDate: "2026-09-20", hoursPerWeek: 5 },
  ];
  assert.equal(peakWeeklyHours(overlapping), 11);
  assert.equal(peakWeeklyHours([]), 0);
});
