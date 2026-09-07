import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

/**
 * The requester workspace, against the database that enforces it.
 *
 * All four guarantees here are database-level on purpose: a version check done
 * only in the application is a check two requests can both pass, and an audit
 * log the application promises not to edit is not an audit log.
 */

const db = new PGlite();
const migration = readFileSync("supabase/014-requester-workspace.sql", "utf8");

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

async function need(fields: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,contact_email,matching_contact_approved) " +
      "values($1,'need','verified','en',$2,'ward@example.org',true)",
    [id, JSON.stringify({ "n3-detail": "Check 14 cracked houses", "n3-district": "Sindhupalchok", ...fields })]
  );
  return id;
}

/** A volunteer with an outstanding invitation against `needId`. */
async function invite(needId: string): Promise<string> {
  const volunteer = randomUUID();
  const role = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,contact_email) " +
      "values($1,'volunteer','verified','en','{\"consent\":\"on\"}','v@example.org')",
    [volunteer]
  );
  await db.query("insert into matching_profiles(volunteer_id,facts) values($1,'{\"hoursPerWeek\":10}')", [volunteer]);
  await db.query(
    "insert into matching_roles(id,need_id,title,headcount,config) values($1,$2,'Assessor',1,$3)",
    [role, needId, JSON.stringify({ startDate: "2090-09-10", endDate: "2090-09-23", hoursPerWeek: 5 })]
  );
  return scalar(
    "select matching_queue_invitation($1,$2,1,1,$3,'{}','{\"to\":\"v@example.org\"}',null)",
    [role, volunteer, randomUUID()]
  );
}

test("the migration is safely re-runnable", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await scalar("select count(*) from migration_state where migration='014'"), 1);
});

test("every change bumps the version, so a stale edit matches no row", async () => {
  const id = await need();
  assert.equal(await scalar("select version from submissions where id=$1", [id]), 1);

  await db.query("update submissions set status='recruiting' where id=$1", [id]);
  const current = await scalar("select version from submissions where id=$1", [id]);
  assert.equal(current, 2);

  // What the requester's form does: apply only if the row has not moved. A
  // coordinator changing the status between page load and save makes this
  // match nothing, rather than the requester's copy overwriting a decision
  // they never saw.
  const stale = await db.query(
    "update submissions set fields=fields||'{\"n3-title\":\"edited\"}' where id=$1 and version=1 returning id",
    [id]
  );
  assert.equal(stale.rows.length, 0, "an edit against an old version must apply to nothing");

  const fresh = await db.query(
    "update submissions set fields=fields||'{\"n3-title\":\"edited\"}' where id=$1 and version=$2 returning id",
    [id, current]
  );
  assert.equal(fresh.rows.length, 1);
});

test("history cannot be rewritten or deleted", async () => {
  const id = await need();
  await db.query(
    "insert into request_events(submission_id,actor,event,detail) values($1,'requester','request_closed','Solved locally')",
    [id]
  );

  // An audit log that can be edited proves nothing — including by the service
  // role, which is the only role this app ever uses.
  await assert.rejects(
    db.query("update request_events set event='something_else' where submission_id=$1", [id]),
    /append-only/i
  );
  await assert.rejects(
    db.query("delete from request_events where submission_id=$1", [id]),
    /append-only/i
  );

  assert.equal(await scalar("select count(*) from request_events where submission_id=$1", [id]), 1);
});

test("a closed-then-reopened request is distinguishable from one never closed", async () => {
  const id = await need();
  for (const event of ["request_closed", "request_reopened"]) {
    await db.query("insert into request_events(submission_id,actor,event) values($1,'requester',$2)", [
      id,
      event,
    ]);
  }
  // The status column holds only the current state; the history is the only
  // thing that can answer "why did work stop for two days?".
  const { rows } = await db.query<{ event: string }>(
    "select event from request_events where submission_id=$1 order by created_at",
    [id]
  );
  assert.deepEqual(rows.map((r) => r.event), ["request_closed", "request_reopened"]);
});

test("rewriting what the work is cancels outstanding invitations", async () => {
  const id = await need();
  const invitation = await invite(id);
  assert.equal(await scalar("select status from matching_invitations where id=$1", [invitation]), "queued");

  // A volunteer who accepted an invitation describing one job must not be
  // confirmed into a different one.
  await db.query(
    "update submissions set fields=fields||'{\"n3-detail\":\"Actually rebuild a footbridge\"}' where id=$1",
    [id]
  );
  assert.equal(
    await scalar("select status from matching_invitations where id=$1", [invitation]),
    "cancelled"
  );
});

test("fixing a typo in the summary does not throw anyone's invitation away", async () => {
  const id = await need();
  const invitation = await invite(id);

  // "Material" is deliberately narrow. If correcting a title cancelled
  // invitations, requesters would be afraid to correct their own request.
  await db.query(
    "update submissions set fields=fields||'{\"n3-title\":\"Check 14 cracked houses (typo fixed)\"}' where id=$1",
    [id]
  );
  assert.equal(
    await scalar("select status from matching_invitations where id=$1", [invitation]),
    "queued"
  );
});

test("changing where or how soon also cancels", async () => {
  for (const change of ["district", "urgency"]) {
    const id = await need();
    const invitation = await invite(id);
    await db.query(`update submissions set ${change}='Changed' where id=$1`, [id]);
    assert.equal(
      await scalar("select status from matching_invitations where id=$1", [invitation]),
      "cancelled",
      change
    );
  }
});
