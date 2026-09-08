import { test } from "node:test";
import assert from "node:assert/strict";

import { NOT_SPECIFIED } from "../lib/publication";
import { ok, unavailable } from "../lib/publication";
import { applyAssignments, deriveQueueItems, filterQueueItems, paginateQueue } from "../lib/situation/derive";
import { itemKey, parseItemKey } from "../lib/situation/keys";
import { metricsView } from "../lib/situation/metrics";
import { parseQueueQuery } from "../lib/situation/query";
import type {
  Coordinator,
  NeedRow,
  QueueAssignment,
  QueueQuery,
  QueueSources,
} from "../lib/situation/types";

/**
 * Situation Room derivation, without a database.
 *
 * The queue is a view over other tables. If the key format, the merge with
 * assignments, or the unavailable-vs-empty distinction is wrong, a seeded
 * Postgres test cannot see it — those are functions of this module.
 */

const NOW = "2026-09-07T13:36:00.000Z";
const NEED = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const VOLUNTEER = "9e8d7c6b-5a49-4382-91f0-e1d2c3b4a596";
const INVITE = "a1b2c3d4-e5f6-4789-8abc-def012345678";
const ROLE = "b2c3d4e5-f6a7-4890-9bcd-ef0123456789";
const EVENT = "c3d4e5f6-a7b8-4901-acde-f01234567890";
const MAIL = "d4e5f6a7-b8c9-4012-bdef-012345678901";
const ITEM = "e5f6a7b8-c9d0-4123-8ef0-123456789012";
const NEED_B = "aa000000-0000-4000-8000-000000000005";
const COORD = "f6a7b8c9-d0e1-4234-8f01-234567890123";

function sources(overrides: Partial<QueueSources> = {}): QueueSources {
  return {
    now: NOW,
    needs: [],
    relatedNeeds: [],
    invitations: [],
    roles: [],
    volunteers: [],
    profiles: [],
    events: [],
    outbox: [],
    questions: [],
    itemNeeds: [],
    ...overrides,
  };
}

function need(overrides: Partial<NeedRow> = {}): NeedRow {
  return {
    id: NEED,
    status: "submitted",
    org_or_name: "Ward 7",
    district: "Sindhupalchok",
    urgency: "Urgent",
    skills: ["engineering"],
    fields: { "n3-title": "Check 14 cracked houses" },
    created_at: "2026-09-05T09:00:00.000Z",
    ...overrides,
  };
}

function query(overrides: Partial<QueueQuery> = {}): QueueQuery {
  return { ...parseQueueQuery({}), ...overrides };
}

test("item keys are kind plus uuid, and reject anything else", () => {
  const key = itemKey("need_verify", NEED);
  assert.equal(key, `need_verify:${NEED}`);
  assert.deepEqual(parseItemKey(key), { kind: "need_verify", id: NEED });

  assert.equal(parseItemKey("need_verify:not-a-uuid"), null);
  assert.equal(parseItemKey("unknown:3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607"), null);
  assert.equal(parseItemKey(NEED), null);
  assert.throws(() => itemKey("need_verify", "nope"));
});

test("a submitted need becomes a verification item; a verified one does not", () => {
  const waiting = deriveQueueItems(sources({ needs: [need()] }));
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].key, itemKey("need_verify", NEED));
  assert.equal(waiting[0].nextAction.includes("verify"), true);
  assert.equal(waiting[0].href, `/admin/needs/${NEED}`);

  const done = deriveQueueItems(sources({ needs: [need({ status: "verified" })] }));
  assert.equal(done.length, 0);
});

test("accepted and expiring invitations are different items, and quiet ones are not queued", () => {
  const invitations = [
    {
      id: INVITE,
      status: "accepted",
      need_id: NEED,
      volunteer_id: VOLUNTEER,
      role_id: ROLE,
      created_at: "2026-09-06T09:00:00.000Z",
      expires_at: "2026-09-10T09:00:00.000Z",
      responded_at: "2026-09-06T12:00:00.000Z",
    },
    {
      id: "aa000000-0000-4000-8000-000000000001",
      status: "sent",
      need_id: NEED,
      volunteer_id: VOLUNTEER,
      role_id: ROLE,
      created_at: "2026-09-06T09:00:00.000Z",
      expires_at: "2026-09-07T20:00:00.000Z",
      responded_at: null,
    },
    {
      id: "aa000000-0000-4000-8000-000000000002",
      status: "sent",
      need_id: NEED,
      volunteer_id: VOLUNTEER,
      role_id: ROLE,
      created_at: "2026-09-06T09:00:00.000Z",
      expires_at: "2026-09-09T13:36:00.000Z",
      responded_at: null,
    },
  ];
  const items = deriveQueueItems(
    sources({
      relatedNeeds: [need({ status: "recruiting" })],
      invitations,
      roles: [{ id: ROLE, need_id: NEED, title: "Assessor", config: { skills: ["engineering"], missionIds: ["housing"] } }],
      volunteers: [{ id: VOLUNTEER, org_or_name: "Asha" }],
    })
  );
  const kinds = items.map((item) => item.kind).sort();
  assert.deepEqual(kinds, ["invite_accepted", "invite_expiring"]);
});

test("paused profiles are not stale, and unpaused old ones are", () => {
  const profile = {
    volunteer_id: VOLUNTEER,
    paused: false,
    confirmed_at: "2026-07-01T09:00:00.000Z",
    facts: { skills: ["medical"] },
    mission_ids: ["health"],
  };
  const stale = deriveQueueItems(
    sources({ profiles: [profile], volunteers: [{ id: VOLUNTEER, org_or_name: "Asha" }] })
  );
  assert.equal(stale.length, 1);
  assert.equal(stale[0].key, itemKey("profile_stale", VOLUNTEER));

  const paused = deriveQueueItems(sources({ profiles: [{ ...profile, paused: true }] }));
  assert.equal(paused.length, 0);
});

test("requester events stay queued until a later coordinator event, not because a human resolved the queue row", () => {
  const outcome = {
    id: EVENT,
    submission_id: NEED,
    actor: "requester",
    event: "outcome_no",
    detail: "Still sleeping outside",
    created_at: "2026-09-06T10:00:00.000Z",
  };
  const open = deriveQueueItems(sources({ relatedNeeds: [need({ status: "completed" })], events: [outcome] }));
  assert.equal(open.length, 1);
  assert.equal(open[0].kind, "feedback_outcome");

  const acknowledged = deriveQueueItems(
    sources({
      relatedNeeds: [need({ status: "completed" })],
      events: [
        outcome,
        {
          id: "aa000000-0000-4000-8000-000000000003",
          submission_id: NEED,
          actor: "coordinator",
          event: "feedback_seen",
          detail: null,
          created_at: "2026-09-06T18:00:00.000Z",
        },
      ],
    })
  );
  assert.equal(acknowledged.length, 0);
});

test("failed emails and underpledged near item needs appear; fully pledged ones do not", () => {
  const items = deriveQueueItems(
    sources({
      outbox: [
        {
          id: MAIL,
          invitation_id: INVITE,
          kind: "invitation",
          status: "failed",
          last_error: "bounce",
          created_at: "2026-09-07T10:00:00.000Z",
        },
      ],
      invitations: [
        {
          id: INVITE,
          status: "sent",
          need_id: NEED,
          volunteer_id: VOLUNTEER,
          role_id: ROLE,
          created_at: "2026-09-06T09:00:00.000Z",
          expires_at: "2026-09-10T09:00:00.000Z",
          responded_at: null,
        },
      ],
      itemNeeds: [
        {
          id: ITEM,
          category: "tarpaulin",
          quantity: 10,
          district: "Sindhupalchok",
          needed_by: "2026-09-10",
          requester: "Ward office",
          detail: "Sheets for 14 houses",
          created_at: "2026-09-01T09:00:00.000Z",
          pledged: 2,
          received: 0,
          remaining: 8,
          status: "requested",
        },
        {
          id: "aa000000-0000-4000-8000-000000000004",
          category: "rice",
          quantity: 50,
          district: "Kathmandu",
          needed_by: "2026-09-10",
          requester: "Ward office",
          detail: "Rice",
          created_at: "2026-09-01T09:00:00.000Z",
          // Fully arranged, so nothing is outstanding and it leaves the queue.
          pledged: 50,
          received: 50,
          remaining: 0,
          status: "closed",
        },
      ],
    })
  );
  assert.deepEqual(
    items.map((item) => item.kind).sort(),
    ["email_stuck", "item_unpledged"]
  );
});

test("an assignment survives the item being derived again", () => {
  const derived = deriveQueueItems(sources({ needs: [need()] }));
  const assignment: QueueAssignment = {
    item_key: derived[0].key,
    owner_id: COORD,
    due_at: "2026-09-08T00:00:00.000Z",
    priority: "low",
    state: "open",
    snoozed_until: null,
    updated_at: NOW,
  };
  const coordinators: Coordinator[] = [{ id: COORD, email: "mina@example.org" }];

  const first = applyAssignments(derived, [assignment], coordinators, NOW);
  const again = applyAssignments(deriveQueueItems(sources({ needs: [need()] })), [assignment], coordinators, NOW);

  assert.equal(first[0].ownerId, COORD);
  assert.equal(first[0].ownerLabel, "mina@example.org");
  assert.equal(again[0].key, first[0].key);
  assert.equal(again[0].ownerId, COORD);
  assert.equal(again[0].priority, "low");
});

test("a resolved assignment hides from the default open view without changing derived subject", () => {
  const derived = deriveQueueItems(sources({ needs: [need()] }));
  const items = applyAssignments(
    derived,
    [
      {
        item_key: derived[0].key,
        owner_id: COORD,
        due_at: null,
        priority: "normal",
        state: "resolved",
        snoozed_until: null,
        updated_at: NOW,
      },
    ],
    [{ id: COORD, email: "mina@example.org" }],
    NOW
  );
  assert.equal(items[0].state, "resolved");
  assert.equal(items[0].subject.includes("Check 14 cracked houses"), true);
  assert.equal(filterQueueItems(items, query({ state: "open" }), NOW).length, 0);
  assert.equal(filterQueueItems(items, query({ state: "resolved" }), NOW).length, 1);
});

test("a missing owner name is not invented", () => {
  const derived = deriveQueueItems(sources({ needs: [need()] }));
  const items = applyAssignments(
    derived,
    [
      {
        item_key: derived[0].key,
        owner_id: COORD,
        due_at: null,
        priority: "normal",
        state: "open",
        snoozed_until: null,
        updated_at: NOW,
      },
    ],
    [],
    NOW
  );
  assert.equal(items[0].ownerLabel, NOT_SPECIFIED);
});

test("search, type filter and pagination operate on the merged list", () => {
  const derived = deriveQueueItems(
    sources({
      needs: [need(), need({ id: NEED_B, org_or_name: "Health post", fields: { "n3-title": "Clinic roof" }, skills: ["medical"] })],
    })
  );
  const items = applyAssignments(derived, [], [], NOW);
  const found = filterQueueItems(items, query({ q: "clinic" }), NOW);
  assert.equal(found.length, 1);
  assert.equal(found[0].recordId, NEED_B);

  const paged = paginateQueue(items, 1, 1);
  assert.equal(paged.rows.length, 1);
  assert.equal(paged.pages, 2);
  assert.equal(paged.total, 2);
});

test("a failed read renders unavailable, not zero", () => {
  const broken = metricsView(unavailable("connection refused"), NOW);
  assert.equal(broken.open, "Unavailable");
  assert.equal(broken.overdue, "Unavailable");
  assert.equal(broken.oldest, "Unavailable");
  assert.equal(Object.values(broken).includes("0"), false);

  const empty = metricsView(ok({ items: [], assignmentsAvailable: true, matchingAvailable: true, requesterEventsAvailable: true }), NOW);
  assert.equal(empty.open, "0");
  assert.equal(empty.overdue, "0");
  assert.equal(empty.oldest, "—");
});

test("a snooze that has passed wakes the item back to open", () => {
  const derived = deriveQueueItems(sources({ needs: [need()] }));
  const items = applyAssignments(
    derived,
    [
      {
        item_key: derived[0].key,
        owner_id: COORD,
        due_at: "2026-09-01T00:00:00.000Z",
        priority: "high",
        state: "snoozed",
        snoozed_until: "2026-09-07T12:00:00.000Z",
        updated_at: NOW,
      },
    ],
    [{ id: COORD, email: "mina@example.org" }],
    NOW
  );
  assert.equal(items[0].state, "open");
});
