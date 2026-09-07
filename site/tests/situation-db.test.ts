import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

import { applyAssignments, deriveQueueItems } from "../lib/situation/derive";
import { itemKey } from "../lib/situation/keys";
import type {
  EventRow,
  InvitationRow,
  ItemNeedRow,
  NeedRow,
  OutboxRow,
  ProfileRow,
  QueueAssignment,
  QueueSources,
  RoleRow,
  VolunteerRow,
} from "../lib/situation/types";

/**
 * Situation Room against the database that enforces it.
 *
 * Derivation is a function of rows; the overlay and the audit log are
 * database objects. These tests seed a real Postgres, run the same derive
 * function the page uses, and check the guarantees SQL actually holds.
 */

const db = new PGlite();
const migration = readFileSync("supabase/016-situation-room.sql", "utf8");

before(async () => {
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key, email text); " +
      "create role anon; create role authenticated; create role service_role bypassrls;"
  );
  await db.exec(
    readFileSync("supabase/schema.sql", "utf8").replace("create extension if not exists pgcrypto;", "")
  );
  for (const file of [
    "002-public-board.sql",
    "003-service-role-grants.sql",
    "004-accounts.sql",
    "010-matching-engine.sql",
    "014-requester-workspace.sql",
    "015-invitation-attempts.sql",
  ]) {
    await db.exec(readFileSync(`supabase/${file}`, "utf8"));
  }
  await db.exec(migration);
});

after(async () => {
  await db.close();
});

async function scalar(sql: string, params: unknown[] = []): Promise<any> {
  const { rows } = await db.query(sql, params);
  return rows.length === 0 ? null : Object.values(rows[0] as object)[0];
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

async function nowIso(): Promise<string> {
  return iso(await scalar("select now()"));
}

async function seedNeed(status = "submitted"): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,org_or_name,district,urgency,skills) " +
      "values($1,'need',$2,'en',$3,'Ward 7','Sindhupalchok','Urgent',$4)",
    [id, status, JSON.stringify({ "n3-title": "Check 14 cracked houses" }), ["engineering"]]
  );
  return id;
}

async function seedVolunteer(): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,org_or_name,contact_email) " +
      "values($1,'volunteer','verified','en','{\"consent\":\"on\"}','Asha','v@example.org')",
    [id]
  );
  return id;
}

async function sourcesFromDb(now: string): Promise<QueueSources> {
  const needs = (await db.query("select id, status, org_or_name, district, urgency, skills, fields, created_at from submissions where kind='need'"))
    .rows as Array<NeedRow>;
  const invitations = (await db.query("select id, status, need_id, volunteer_id, role_id, created_at, expires_at, responded_at from matching_invitations"))
    .rows as Array<InvitationRow>;
  const roles = (await db.query("select id, need_id, title, config from matching_roles")).rows as Array<RoleRow>;
  const volunteers = (await db.query("select id, org_or_name from submissions where kind='volunteer'")).rows as Array<VolunteerRow>;
  const profiles = (await db.query("select volunteer_id, paused, confirmed_at, facts, mission_ids from matching_profiles"))
    .rows as Array<ProfileRow>;
  const events = (await db.query("select id, submission_id, actor, event, detail, created_at from request_events")).rows as Array<EventRow>;
  const outbox = (await db.query("select id, invitation_id, kind, status, last_error, created_at from matching_email_outbox"))
    .rows as Array<OutboxRow>;
  const itemNeeds = (await db.query(
    "select n.id, n.category, n.quantity, n.district, n.needed_by, n.requester, n.detail, n.created_at, coalesce(p.pledged,0) as pledged " +
      "from item_needs n left join item_need_pledged p on p.item_need_id = n.id"
  )).rows as Array<ItemNeedRow>;

  const stringify = <T extends { created_at?: unknown }>(rows: T[]) =>
    rows.map((row) => ({
      ...row,
      ...( "created_at" in row ? { created_at: iso(row.created_at) } : {}),
    }));

  return {
    now,
    needs: stringify(needs.filter((row) => row.status === "submitted" || row.status === "under_review")).map((row) => ({
      ...row,
      fields: typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields,
    })),
    relatedNeeds: stringify(needs).map((row) => ({
      ...row,
      fields: typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields,
    })),
    invitations: stringify(invitations).map((row) => ({
      ...row,
      expires_at: iso(row.expires_at),
      responded_at: row.responded_at ? iso(row.responded_at) : null,
    })),
    roles: roles.map((row) => ({
      ...row,
      config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
    })),
    volunteers,
    profiles: profiles.map((row) => ({
      ...row,
      confirmed_at: iso(row.confirmed_at),
      facts: typeof row.facts === "string" ? JSON.parse(row.facts) : row.facts,
    })),
    events: stringify(events),
    outbox: stringify(outbox),
    questions: [],
    itemNeeds: stringify(itemNeeds).map((row) => ({
      ...row,
      needed_by: iso(row.needed_by).slice(0, 10),
      pledged: Number(row.pledged) || 0,
    })),
  };
}

test("the migration is safely re-runnable and appears in the ledger", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await scalar("select count(*) from migration_state where migration='016'"), 1);
  assert.equal(await scalar("select applied from migration_state where migration='016'"), true);
});

test("a seeded database produces the derived items the page would show", async () => {
  const need = await seedNeed("submitted");
  const verified = await seedNeed("verified");
  const volunteer = await seedVolunteer();
  const volunteer2 = await seedVolunteer();
  const role = randomUUID();
  const inviteAccepted = randomUUID();
  const inviteExpiring = randomUUID();
  const mail = randomUUID();
  const item = randomUUID();
  const event = randomUUID();

  await db.query("insert into matching_profiles(volunteer_id,facts,confirmed_at) values($1,'{\"skills\":[\"engineering\"]}', now() - interval '40 days')", [
    volunteer,
  ]);
  await db.query(
    "insert into matching_roles(id,need_id,title,headcount,config) values($1,$2,'Assessor',1,$3)",
    [role, verified, JSON.stringify({ skills: ["engineering"], startDate: "2090-09-10", endDate: "2090-09-23", hoursPerWeek: 5 })]
  );
  await db.query(
    "insert into matching_invitations(id,role_id,need_id,volunteer_id,status,token_hash,snapshot,role_revision,profile_revision,expires_at,responded_at) " +
      "values($1,$2,$3,$4,'accepted',$5,'{}',1,1,now() + interval '2 days', now())",
    [inviteAccepted, role, verified, volunteer, randomUUID()]
  );
  await db.query(
    "insert into matching_invitations(id,role_id,need_id,volunteer_id,status,token_hash,snapshot,role_revision,profile_revision,expires_at) " +
      "values($1,$2,$3,$4,'sent',$5,'{}',1,1,now() + interval '12 hours')",
    [inviteExpiring, role, verified, volunteer2, randomUUID()]
  );
  await db.query(
    "insert into matching_email_outbox(id,invitation_id,kind,payload,status) values($1,$2,'invitation','{\"to\":\"v@example.org\"}','failed')",
    [mail, inviteAccepted]
  );
  await db.query(
    "insert into request_events(id,submission_id,actor,event,detail) values($1,$2,'requester','outcome_no','Still outside')",
    [event, verified]
  );
  await db.query(
    "insert into item_needs(id,category,quantity,district,municipality,needed_by,requester,detail,detail_np) " +
      "values($1,'tarpaulin',10,'Sindhupalchok','Melamchi',current_date,'Ward office','Sheets','Sheets')",
    [item]
  );

  const derived = deriveQueueItems(await sourcesFromDb(await nowIso()));
  const keys = new Set(derived.map((row) => row.key));

  assert.ok(keys.has(itemKey("need_verify", need)), "submitted need should be queued");
  assert.ok(!keys.has(itemKey("need_verify", verified)), "verified need must not be queued for verification");
  assert.ok(keys.has(itemKey("invite_accepted", inviteAccepted)));
  assert.ok(keys.has(itemKey("invite_expiring", inviteExpiring)));
  assert.ok(keys.has(itemKey("profile_stale", volunteer)));
  assert.ok(keys.has(itemKey("feedback_outcome", event)));
  assert.ok(keys.has(itemKey("email_stuck", mail)));
  assert.ok(keys.has(itemKey("item_unpledged", item)));
});

test("an assignment survives the item being recomputed", async () => {
  const need = await seedNeed("under_review");
  const owner = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,'mina@example.org')", [owner]);
  const key = itemKey("need_verify", need);
  await db.query(
    "insert into queue_assignments(item_key,owner_id,priority,state) values($1,$2,'high','open')",
    [key, owner]
  );

  const first = applyAssignments(
    deriveQueueItems(await sourcesFromDb(await nowIso())),
    ((await db.query("select * from queue_assignments where item_key=$1", [key])).rows as QueueAssignment[]).map((row) => ({
      ...row,
      due_at: row.due_at ? iso(row.due_at) : null,
      snoozed_until: row.snoozed_until ? iso(row.snoozed_until) : null,
      updated_at: iso(row.updated_at),
    })),
    [{ id: owner, email: "mina@example.org" }],
    await nowIso()
  );

  const again = applyAssignments(
    deriveQueueItems(await sourcesFromDb(await nowIso())),
    ((await db.query("select * from queue_assignments where item_key=$1", [key])).rows as QueueAssignment[]).map((row) => ({
      ...row,
      due_at: row.due_at ? iso(row.due_at) : null,
      snoozed_until: row.snoozed_until ? iso(row.snoozed_until) : null,
      updated_at: iso(row.updated_at),
    })),
    [{ id: owner, email: "mina@example.org" }],
    await nowIso()
  );

  const item = again.find((row) => row.key === key);
  assert.ok(item);
  assert.equal(item.ownerId, owner);
  assert.equal(item.priority, "high");
  assert.equal(first.find((row) => row.key === key)?.ownerId, owner);
});

test("queue_events cannot be updated or deleted", async () => {
  const key = itemKey("need_verify", randomUUID());
  await db.query("insert into queue_events(item_key,event,detail) values($1,'assigned','test')", [key]);

  await assert.rejects(db.query("update queue_events set event='rewritten' where item_key=$1", [key]), /append-only/i);
  await assert.rejects(db.query("delete from queue_events where item_key=$1", [key]), /append-only/i);
  assert.equal(await scalar("select count(*) from queue_events where item_key=$1", [key]), 1);
});

test("resolving a queue item does not change the underlying record", async () => {
  const need = await seedNeed("submitted");
  const key = itemKey("need_verify", need);
  await db.query(
    "insert into queue_assignments(item_key,priority,state) values($1,'normal','resolved')",
    [key]
  );
  await db.query(
    "insert into queue_events(item_key,event,detail) values($1,'resolved','Queue entry marked dealt with. Underlying record unchanged.')",
    [key]
  );

  assert.equal(await scalar("select status from submissions where id=$1", [need]), "submitted");
});

test("a malformed item_key is rejected by the database", async () => {
  await assert.rejects(
    db.query("insert into queue_assignments(item_key) values('not-a-key')"),
    /item_key|check/i
  );
});
