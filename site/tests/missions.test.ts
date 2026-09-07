import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_MISSIONS, sortedMemberships, type Mission, type MissionMembership } from "../lib/missions";

function mission(id: string, order: number): Mission {
  return {
    id,
    title: id,
    summary: "",
    purpose: null,
    currentTask: null,
    leadName: null,
    meetingLink: null,
    nextCheckIn: null,
    status: "active",
    members: order,
  };
}

function membership(missionId: string, createdAt: string): MissionMembership {
  return { missionId, preferenceState: "interested", source: "self_selected", createdAt };
}

const MISSIONS = ["housing", "health", "wash"].map((id, i) => mission(id, i));

test("the order missions were chosen in carries no meaning", () => {
  // The design shows two slots side by side, which invites reading the first
  // as a first choice. Nothing downstream ranks them — the engine treats any
  // matching mission identically — so the pages sort by the mission's own
  // order rather than by when someone joined.
  const chosenLate = membership("housing", "2026-09-06T12:00:00.000Z");
  const chosenEarly = membership("wash", "2026-09-01T12:00:00.000Z");

  const sorted = sortedMemberships([chosenEarly, chosenLate], MISSIONS);

  assert.deepEqual(
    sorted.map((m) => m.missionId),
    ["housing", "wash"],
    "display order follows the mission list, not the join timestamps"
  );

  // Reversing the input does not change the output, which is the property
  // that matters: two people who picked the same pair see the same page.
  assert.deepEqual(
    sortedMemberships([chosenLate, chosenEarly], MISSIONS).map((m) => m.missionId),
    sorted.map((m) => m.missionId)
  );
});

test("a mission the catalog no longer lists is still shown rather than dropped", () => {
  // A retired mission must not make someone's own membership vanish from
  // their profile without explanation.
  const orphan = membership("retired", "2026-09-01T12:00:00.000Z");
  const kept = membership("health", "2026-09-02T12:00:00.000Z");

  const sorted = sortedMemberships([kept, orphan], MISSIONS);
  assert.equal(sorted.length, 2);
  assert.ok(sorted.some((m) => m.missionId === "retired"));
});

test("the cap the UI quotes is the cap the database enforces", () => {
  // tests/missions-db.test.ts proves the trigger refuses a third. This pins
  // the number the interface promises to the same constant, so the two cannot
  // drift into telling a volunteer different things.
  assert.equal(MAX_MISSIONS, 2);
});
