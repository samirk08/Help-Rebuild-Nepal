import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

/**
 * Re-inviting after a request changes.
 *
 * Migration 014 cancels a need's outstanding invitations when the work it
 * describes is rewritten. Before 015, `unique (role_id, volunteer_id)` then
 * made those people permanently un-invitable to that role — so the better a
 * requester behaved, the more volunteers they locked out of their own request.
 *
 * The same constraint was also the only thing stopping a declined volunteer
 * being asked again, so these tests hold both ends: cancelled attempts may be
 * retried, answered ones may not.
 */

const db = new PGlite();
const attempts = readFileSync("supabase/015-invitation-attempts.sql", "utf8");

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
  ]) {
    await db.exec(readFileSync(`supabase/${file}`, "utf8"));
  }
  await db.exec(attempts);
});

after(async () => {
  await db.close();
});

async function scalar(sql: string, params: unknown[] = []): Promise<any> {
  const { rows } = await db.query(sql, params);
  return rows.length === 0 ? null : Object.values(rows[0] as object)[0];
}

async function fixture() {
  const need = randomUUID();
  const volunteer = randomUUID();
  const role = randomUUID();

  await db.query(
    "insert into submissions(id,kind,status,lang,fields,contact_email,matching_contact_approved) " +
      "values($1,'need','verified','en',$2,'ward@example.org',true)",
    [need, JSON.stringify({ "n3-detail": "Check 14 cracked houses" })]
  );
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,contact_email) " +
      "values($1,'volunteer','verified','en','{\"consent\":\"on\"}','v@example.org')",
    [volunteer]
  );
  await db.query("insert into matching_profiles(volunteer_id,facts) values($1,'{\"hoursPerWeek\":10}')", [volunteer]);
  await db.query(
    "insert into matching_roles(id,need_id,title,headcount,config) values($1,$2,'Assessor',1,$3)",
    [role, need, JSON.stringify({ startDate: "2090-09-10", endDate: "2090-09-23", hoursPerWeek: 5 })]
  );
  return { need, volunteer, role };
}

async function queue(f: Awaited<ReturnType<typeof fixture>>) {
  return scalar(
    "select matching_queue_invitation($1,$2,1,1,$3,'{}','{\"to\":\"v@example.org\"}',null)",
    [f.role, f.volunteer, randomUUID()]
  );
}

test("the migration is safely re-runnable", async () => {
  await db.exec(attempts);
  await db.exec(attempts);
  assert.equal(await scalar("select count(*) from migration_state where migration='015'"), 1);
});

test("a volunteer cancelled by a request edit can be invited again", async () => {
  const f = await fixture();
  const first = await queue(f);
  assert.equal(await scalar("select attempt from matching_invitations where id=$1", [first]), 1);

  // The requester rewrites what the work is. Migration 014 cancels the
  // outstanding invitation so nobody is confirmed into work they did not
  // agree to — which is correct, and used to be a dead end.
  await db.query(
    "update submissions set fields=fields||'{\"n3-detail\":\"Rebuild a footbridge instead\"}' where id=$1",
    [f.need]
  );
  assert.equal(await scalar("select status from matching_invitations where id=$1", [first]), "cancelled");

  const second = await queue(f);
  assert.notEqual(second, first);
  assert.equal(await scalar("select attempt from matching_invitations where id=$1", [second]), 2);

  // Both rows survive, so "we asked, the request changed, we asked again" is
  // still readable. An upsert would have destroyed that.
  assert.equal(
    await scalar("select count(*) from matching_invitations where role_id=$1 and volunteer_id=$2", [
      f.role,
      f.volunteer,
    ]),
    2
  );
});

test("declining is still an answer, not an invitation to ask again", async () => {
  const f = await fixture();
  const id = await queue(f);
  const token = await scalar("select token_hash from matching_invitations where id=$1", [id]);
  await db.query("select matching_respond($1,'declined',false)", [token]);

  // Before 015 this was enforced only as a side effect of a unique index.
  // Loosening that index without writing the rule down would have turned
  // "no thank you" into "ask me every week".
  await assert.rejects(queue(f), /already answered for this role/i);
});

test("an expired attempt can be retried; an outstanding one cannot", async () => {
  const f = await fixture();
  const first = await queue(f);

  // While it is live, a second offer is refused — the volunteer is already
  // holding one and would get two emails about the same role.
  await assert.rejects(queue(f), /outstanding invitation/i);

  await db.query("update matching_invitations set expires_at=now()-interval '1 minute' where id=$1", [first]);
  const second = await queue(f);
  assert.equal(await scalar("select attempt from matching_invitations where id=$1", [second]), 2);
});

test("a confirmed connection is never re-offered", async () => {
  const f = await fixture();
  const id = await queue(f);
  await db.query("update matching_invitations set status='confirmed' where id=$1", [id]);
  await assert.rejects(queue(f), /already answered for this role/i);
});

test("each retry gets its own outbox message, and none is duplicated", async () => {
  const f = await fixture();
  const first = await queue(f);
  await db.query("update matching_invitations set expires_at=now()-interval '1 minute' where id=$1", [first]);
  const second = await queue(f);

  for (const id of [first, second]) {
    assert.equal(
      await scalar("select count(*) from matching_email_outbox where invitation_id=$1", [id]),
      1
    );
  }
});
