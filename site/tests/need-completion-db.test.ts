import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

import { CLOSED_STATUSES, isClosedNeed } from "../lib/publication";

/**
 * Completing a need closes the work behind it.
 *
 * Marking a need `completed` used to write one column. The project it was
 * promoted to stayed at `recruiting`, so the public board counted finished work
 * under "Team roster still open"; and its matching roles stayed active, so the
 * dashboard kept recommending volunteers for a request nobody could join.
 *
 * These tests hold the cascade and, just as importantly, its limits: what
 * `completed` must not touch, and what `filled` and `rejected` must not trigger.
 */

const db = new PGlite();
const migration = readFileSync("supabase/020-completing-a-need-closes-it.sql", "utf8");

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
    "019-project-outcomes.sql",
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

async function need(status = "verified"): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,org_or_name,district,contact_email," +
      "matching_contact_approved) values($1,'need',$2,'en','{}','Melamchi Ward 4'," +
      "'Sindhupalchok','requester@example.org',true)",
    [id, status]
  );
  return id;
}

async function project(needId: string, stage = "recruiting"): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into projects(id,need_id,stage,coordinator,title) " +
      "values($1,$2,$3,'A coordinator','Roof repair, Ward 4')",
    [id, needId, stage]
  );
  return id;
}

async function role(needId: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into matching_roles(id,need_id,title,headcount,config) " +
      "values($1,$2,'Roofing volunteer',3,'{\"hoursPerWeek\":10}')",
    [id, needId]
  );
  return id;
}

const setStatus = (needId: string, status: string) =>
  db.query("update submissions set status=$2 where id=$1", [needId, status]);

const stageOf = (projectId: string) =>
  scalar("select stage from projects where id=$1", [projectId]);

test("the migration is safely re-runnable and appears in the ledger", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await scalar("select count(*) from migration_state where migration='020'"), 1);

  // The ledger reports a trigger, not a table: 020 adds behaviour, not storage,
  // and reporting it applied because 019's table exists would be the ledger's
  // one job done wrong.
  assert.equal(await scalar("select applied from migration_state where migration='020'"), true);
});

test("completing a need completes the project behind it", async () => {
  const n = await need();
  const p = await project(n);

  await setStatus(n, "completed");

  assert.equal(await stageOf(p), "completed");
  // 019's trigger stamps the date, and it still runs underneath the cascade.
  assert.ok(await scalar("select completed_at from projects where id=$1", [p]));
});

test("a project no longer needs an outcome to be completed", async () => {
  const p = await project(await need());

  // 019 refused this. 020 removed the rule, because the cascade above would
  // otherwise raise on every need whose outcome had not been written yet — and
  // the failure would land on the admin's status update, leaving them unable to
  // close the need at all.
  await db.query("update projects set stage='completed' where id=$1", [p]);
  assert.equal(await stageOf(p), "completed");
  assert.equal(await scalar("select count(*) from project_outcomes where project_id=$1", [p]), 0);

  // And the mirror of that rule goes with it, so a correction is never refused.
  await db.query(
    "insert into project_outcomes(project_id,summary) values($1,'96 households re-roofed.')",
    [p]
  );
  await db.query("delete from project_outcomes where project_id=$1", [p]);
  assert.equal(await scalar("select count(*) from project_outcomes where project_id=$1", [p]), 0);
});

test("completing a need deactivates its matching roles", async () => {
  const n = await need();
  const r = await role(n);
  assert.equal(await scalar("select active from matching_roles where id=$1", [r]), true);

  await setStatus(n, "completed");
  assert.equal(await scalar("select active from matching_roles where id=$1", [r]), false);
});

test("a rejected need stops recruiting but is never recorded as completed work", async () => {
  const n = await need();
  const p = await project(n);
  const r = await role(n);

  await setStatus(n, "rejected");

  assert.equal(await scalar("select active from matching_roles where id=$1", [r]), false);
  // The project is already off every public surface through the need it hangs
  // from. Writing it down as completed would be a plain falsehood.
  assert.equal(await stageOf(p), "recruiting");
});

test("a filled need keeps its roles, because a full roster can empty again", async () => {
  const n = await need();
  const r = await role(n);
  const p = await project(n);

  await setStatus(n, "filled");

  assert.equal(
    await scalar("select active from matching_roles where id=$1", [r]),
    true,
    "deactivating here would discard the requirements an admin wrote"
  );
  assert.equal(await stageOf(p), "recruiting");
});

test("the dashboard and the migration agree on which needs are closed", async () => {
  // MatchingPanel hides the role forms and the invite action for a closed need.
  // If it disagreed with the migration, it would either offer an action the
  // database has already taken away, or hide one that still works.
  for (const status of ["submitted", "under_review", "verified", "recruiting", "filled"]) {
    const n = await need();
    const r = await role(n);
    await setStatus(n, status);
    assert.equal(
      await scalar("select active from matching_roles where id=$1", [r]),
      true,
      `${status} must not deactivate roles`
    );
    assert.equal(isClosedNeed(status), false, `${status} is not the end of the line`);
  }

  for (const status of CLOSED_STATUSES) {
    const n = await need();
    const r = await role(n);
    await setStatus(n, status);
    assert.equal(
      await scalar("select active from matching_roles where id=$1", [r]),
      false,
      `${status} must deactivate roles`
    );
    assert.equal(isClosedNeed(status), true);
  }
});

test("a draft project is not published by completing its need", async () => {
  const n = await need();
  const p = await project(n, "draft");

  await setStatus(n, "completed");

  // Draft is the one stage the public view excludes outright. Completing it
  // would publish something deliberately held back.
  assert.equal(await stageOf(p), "draft");
  assert.equal(await scalar("select count(*) from project_public_progress where id=$1", [p]), 0);
});

test("completing a need twice does not restamp the completion date", async () => {
  const n = await need();
  const p = await project(n);

  await setStatus(n, "completed");
  const first = await scalar("select completed_at from projects where id=$1", [p]);

  await db.query("update submissions set notes='Closed out.' where id=$1", [n]);
  await setStatus(n, "completed");

  assert.deepEqual(await scalar("select completed_at from projects where id=$1", [p]), first);
});

test("the migration repairs needs that were completed before it existed", async () => {
  // Simulate the pre-020 world: drop the trigger, close a need, and check that
  // the file repairs rather than only fixing what happens next. Without this,
  // every need already marked completed keeps its project on the public board
  // under "Recruiting" — the state that prompted the change.
  const n = await need();
  const p = await project(n);
  const r = await role(n);
  await db.exec("drop trigger submissions_close_project on submissions");
  await setStatus(n, "completed");
  assert.equal(await stageOf(p), "recruiting", "the pre-020 state is what is being repaired");

  await db.exec(migration);

  assert.equal(await stageOf(p), "completed");
  assert.equal(await scalar("select active from matching_roles where id=$1", [r]), false);
});

test("a completed project still carries its progress to the public view", async () => {
  const n = await need();
  const p = await project(n);
  await db.query(
    "insert into project_tasks(project_id,title,is_milestone,status) " +
      "values($1,'Re-roof the ward',true,'done')",
    [p]
  );
  await db.query(
    "insert into project_outcomes(project_id,summary,households_reached) " +
      "values($1,'96 households re-roofed before the rains.',96)",
    [p]
  );

  await setStatus(n, "completed");

  const row = (await db.query("select * from project_public_progress where id=$1", [p]))
    .rows[0] as Record<string, unknown>;
  assert.equal(row.stage, "completed");
  assert.equal(row.outcome_households, 96);
  assert.equal(Number(row.milestones_done), 1);
});
