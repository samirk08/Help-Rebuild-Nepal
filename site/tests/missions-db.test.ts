import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

/**
 * Mission teams, against the database that enforces them.
 *
 * These are the Phase 2 acceptance criteria, and almost all of them are
 * database guarantees rather than UI behaviour: a two-mission limit checked
 * only in the browser holds until someone opens two tabs.
 */

const db = new PGlite();
const missions = readFileSync("supabase/013-missions.sql", "utf8");

before(async () => {
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key, email text); " +
      "create role anon; create role authenticated; create role service_role bypassrls;"
  );
  await db.exec(
    readFileSync("supabase/schema.sql", "utf8").replace(
      "create extension if not exists pgcrypto;",
      ""
    )
  );
  for (const file of [
    "002-public-board.sql",
    "003-service-role-grants.sql",
    "004-accounts.sql",
    "009-network-members.sql",
    "010-matching-engine.sql",
  ]) {
    await db.exec(readFileSync(`supabase/${file}`, "utf8"));
  }
  await db.exec(missions);
});

after(async () => {
  await db.close();
});

async function scalar(sql: string, params: unknown[] = []): Promise<any> {
  const { rows } = await db.query(sql, params);
  return rows.length === 0 ? null : Object.values(rows[0] as object)[0];
}

/** A volunteer registration, optionally with a matching profile behind it. */
async function volunteer(withProfile = true): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,contact_email) " +
      "values($1,'volunteer','verified','en','{\"consent\":\"on\"}','v@example.org')",
    [id]
  );
  if (withProfile) {
    await db.query("insert into matching_profiles(volunteer_id,facts) values($1,'{}')", [id]);
  }
  return id;
}

async function join(volunteerId: string, missionId: string, source = "self_selected") {
  return db.query(
    "insert into mission_members(volunteer_id,mission_id,source) values($1,$2,$3)",
    [volunteerId, missionId, source]
  );
}

test("the migration is safely re-runnable and seeds nine missions", async () => {
  await db.exec(missions);
  await db.exec(missions);
  assert.equal(await scalar("select count(*) from missions"), 9);

  // Seeded blank on purpose. A mission page that shows an invented "current
  // task" sends someone to work that does not exist.
  assert.equal(
    await scalar("select count(*) from missions where purpose is null and current_task is null"),
    9
  );
});

test("a volunteer may choose at most two missions", async () => {
  const v = await volunteer();
  await join(v, "housing");
  await join(v, "wash");

  await assert.rejects(join(v, "story"), /at most two missions/i);
  assert.equal(await scalar("select count(*) from mission_members where volunteer_id=$1", [v]), 2);

  // Leaving one frees the place, so the limit is a cap and not a lifetime quota.
  await db.query("delete from mission_members where volunteer_id=$1 and mission_id='wash'", [v]);
  await join(v, "story");
  assert.equal(await scalar("select count(*) from mission_members where volunteer_id=$1", [v]), 2);
});

test("re-running the seed never overwrites content a coordinator has entered", async () => {
  await db.query("update missions set purpose='Draft safer roof details' where id='housing'");
  await db.exec(missions);
  assert.equal(
    await scalar("select purpose from missions where id='housing'"),
    "Draft safer roof details"
  );
  await db.query("update missions set purpose=null where id='housing'");
});

test("only a volunteer registration can hold a membership", async () => {
  const need = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields) values($1,'need','verified','en','{}')",
    [need]
  );
  await assert.rejects(join(need, "housing"), /requires a volunteer registration/i);
});

test("mission choices reach the matching engine, and bump the profile revision", async () => {
  const v = await volunteer();
  const before = await scalar("select revision from matching_profiles where volunteer_id=$1", [v]);

  await join(v, "housing");

  assert.deepEqual(
    await scalar("select mission_ids from matching_profiles where volunteer_id=$1", [v]),
    ["housing"]
  );
  // The engine guards invitations on the profile revision. A scope change that
  // did not bump it could let an invitation computed under the old scope be
  // confirmed afterwards.
  assert.ok(
    (await scalar("select revision from matching_profiles where volunteer_id=$1", [v])) > before
  );

  await join(v, "wash");
  assert.deepEqual(
    await scalar("select mission_ids from matching_profiles where volunteer_id=$1", [v]),
    ["housing", "wash"]
  );

  await db.query("delete from mission_members where volunteer_id=$1 and mission_id='housing'", [v]);
  assert.deepEqual(
    await scalar("select mission_ids from matching_profiles where volunteer_id=$1", [v]),
    ["wash"]
  );
});

test("choosing a mission does not narrow scope until the volunteer says so", async () => {
  const v = await volunteer();
  await join(v, "health");

  // The default. Someone who picks a mission is still considered for other
  // suitable work — the plan is explicit that interest is not a filter.
  assert.equal(await scalar("select mission_only from matching_profiles where volunteer_id=$1", [v]), false);
  assert.equal(
    await scalar("select preference_state from mission_members where volunteer_id=$1", [v]),
    "interested"
  );

  await db.query(
    "update mission_members set preference_state='mission_only' where volunteer_id=$1",
    [v]
  );
  assert.equal(await scalar("select mission_only from matching_profiles where volunteer_id=$1", [v]), true);

  // And it is reversible in one step, without leaving the missions.
  await db.query("update mission_members set preference_state='interested' where volunteer_id=$1", [v]);
  assert.equal(await scalar("select mission_only from matching_profiles where volunteer_id=$1", [v]), false);
  assert.equal(await scalar("select count(*) from mission_members where volunteer_id=$1", [v]), 1);
});

test("a skill network membership never becomes a mission membership", async () => {
  const v = await volunteer();
  const account = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,'a@example.org')", [account]);
  await db.query("update submissions set user_id=$1 where id=$2", [account, v]);
  await db.query("insert into network_members(user_id,network) values($1,'Engineering')", [account]);

  // Migration 009 membership is a professional community; a mission is an
  // explicit, capped, reversible statement of interest. Conflating them would
  // mean someone's profession silently enrolled them in a team.
  assert.equal(await scalar("select count(*) from mission_members where volunteer_id=$1", [v]), 0);
  assert.deepEqual(
    await scalar("select mission_ids from matching_profiles where volunteer_id=$1", [v]),
    []
  );
});

test("joining a mission grants no coordinator access", async () => {
  const v = await volunteer();
  const account = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,'b@example.org')", [account]);
  await db.query("update submissions set user_id=$1 where id=$2", [account, v]);
  await join(v, "operations");

  assert.equal(await scalar("select count(*) from admin_users where user_id=$1", [account]), 0);
});

test("how a membership was recorded is kept, so a reply is not mistaken for a click", async () => {
  const v = await volunteer();
  await join(v, "story", "email_reply");
  assert.equal(await scalar("select source from mission_members where volunteer_id=$1", [v]), "email_reply");

  await assert.rejects(join(v, "situation", "guessed"), /violates check constraint/i);
});

test("the migration reports itself in the ledger", async () => {
  // Each migration re-declares the ledger and adds its own row. One that
  // forgets is simply never reported — which is the exact failure this ledger
  // exists to catch, so it is worth a test of its own.
  const { rows } = await db.query<{ migration: string; applied: boolean }>(
    "select migration, applied from migration_state where migration='013'"
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].applied, true);
});

test("a volunteer with no matching profile can still choose missions", async () => {
  // Someone who has registered but never confirmed their availability has no
  // matching_profiles row. Recording their interest must not fail, and must
  // not invent a confirmed_at for answers they have not given.
  const v = await volunteer(false);
  await join(v, "resilience");

  assert.equal(await scalar("select count(*) from mission_members where volunteer_id=$1", [v]), 1);
  assert.equal(await scalar("select count(*) from matching_profiles where volunteer_id=$1", [v]), 0);
});
