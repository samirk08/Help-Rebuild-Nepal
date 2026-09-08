import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

import { isPublicProject } from "../lib/publication";

/**
 * Projects that say what they did, against the database that enforces it.
 *
 * `stage = 'completed'` used to be a value in a dropdown with nothing behind
 * it. These tests hold the three rules that give it meaning: completion needs
 * an outcome, one need makes one project, and the public view carries progress
 * without carrying the roster.
 */

const db = new PGlite();
const migration = readFileSync("supabase/019-project-outcomes.sql", "utf8");

before(async () => {
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key, email text); " +
      "create role anon; create role authenticated; create role service_role bypassrls;"
  );
  await db.exec(
    readFileSync("supabase/schema.sql", "utf8").replace("create extension if not exists pgcrypto;", "")
  );
  for (const file of ["002-public-board.sql", "003-service-role-grants.sql", "004-accounts.sql"]) {
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
    "insert into submissions(id,kind,status,lang,fields,org_or_name,district) " +
      "values($1,'need',$2,'en','{}','Melamchi Ward 4','Sindhupalchok')",
    [id, status]
  );
  return id;
}

async function project(needId?: string, stage = "recruiting"): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into projects(id,need_id,stage,coordinator,lead,title) " +
      "values($1,$2,$3,'A coordinator','A lead','Roof repair, Ward 4')",
    [id, needId ?? (await need()), stage]
  );
  return id;
}

const outcome = (projectId: string, confirmed = false) =>
  db.query(
    "insert into project_outcomes(project_id,summary,households_reached,requester_confirmed) " +
      "values($1,'96 households re-roofed before the rains.',96,$2)",
    [projectId, confirmed]
  );

test("the migration is safely re-runnable and appears in the ledger", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await scalar("select count(*) from migration_state where migration='019'"), 1);
});

test("a project cannot be completed without an outcome", async () => {
  const p = await project();

  // The acceptance criterion. Asking people for their time and then recording
  // the result as a word in a select box does not close the loop.
  await assert.rejects(
    db.query("update projects set stage='completed' where id=$1", [p]),
    /record what this project achieved/i
  );

  await db.query("update projects set stage='in_progress' where id=$1", [p]);
  assert.ok(await scalar("select started_at from projects where id=$1", [p]));

  await outcome(p);
  await db.query("update projects set stage='completed' where id=$1", [p]);
  assert.ok(await scalar("select completed_at from projects where id=$1", [p]));
});

test("the outcome cannot be removed from a completed project", async () => {
  const p = await project();
  await outcome(p);
  await db.query("update projects set stage='completed' where id=$1", [p]);

  // Otherwise the project ends up completed with nothing behind it — exactly
  // the state the rule above exists to prevent, reached from the other side.
  await assert.rejects(
    db.query("delete from project_outcomes where project_id=$1", [p]),
    /correct the outcome rather than removing it/i
  );

  await db.query("update projects set stage='paused' where id=$1", [p]);
  await db.query("delete from project_outcomes where project_id=$1", [p]);
  assert.equal(await scalar("select count(*) from project_outcomes where project_id=$1", [p]), 0);
});

test("requester confirmation is dated, and undated when withdrawn", async () => {
  const p = await project();
  await outcome(p, true);
  assert.ok(
    await scalar("select requester_confirmed_at from project_outcomes where project_id=$1", [p]),
    "a confirmation recorded at insert still gets a date behind it"
  );

  await db.query("update project_outcomes set requester_confirmed=false where project_id=$1", [p]);
  assert.equal(
    await scalar("select requester_confirmed_at from project_outcomes where project_id=$1", [p]),
    null
  );
});

test("one need makes one project", async () => {
  const n = await need();
  await project(n);
  // A double-submitted promotion used to produce two cards on the public page
  // describing the same work, diverging from then on.
  await assert.rejects(project(n), /duplicate key value|unique constraint/i);
});

test("re-running the migration collapses projects that were already duplicated", async () => {
  // Simulate the pre-019 world: drop the index, create the duplicate, and
  // check that the file repairs rather than refuses.
  const n = await need();
  await db.exec("drop index projects_need_id_uidx");
  const first = await project(n);
  const second = await project(n);

  await db.exec(migration);

  assert.equal(await scalar("select count(*) from projects where need_id=$1", [n]), 1);
  const survivor = await scalar("select id from projects where need_id=$1", [n]);
  assert.ok(survivor === first || survivor === second);
});

test("a milestone is a task, and public progress counts only the public ones", async () => {
  const p = await project();
  await db.query(
    "insert into project_tasks(project_id,title,is_milestone,status) values" +
      "($1,'Survey the ward',true,'done'),($1,'Order sheeting',true,'todo')," +
      "($1,'Safeguarding follow-up',false,'todo')",
    [p]
  );
  await db.query(
    "insert into project_tasks(project_id,title,assignee,public) values($1,'Visit household 12','Ram',false)",
    [p]
  );

  const row = (await db.query("select * from project_public_progress where id=$1", [p]))
    .rows[0] as Record<string, unknown>;
  assert.equal(Number(row.tasks_total), 3, "the private task is not counted");
  assert.equal(Number(row.tasks_done), 1);
  assert.equal(Number(row.milestones_total), 2);
  assert.equal(Number(row.milestones_done), 1);
});

test("the public view carries the latest public update and never the roster", async () => {
  const p = await project();
  await db.query(
    "insert into project_updates(project_id,body,author,internal,created_at) values" +
      "($1,'Sheeting ordered.','Coordinator',false,now()-interval '2 days')," +
      "($1,'Household 12 needs a safeguarding referral.','Coordinator',true,now())",
    [p]
  );
  await db.query(
    "insert into project_tasks(project_id,title,assignee) values($1,'Survey','Ram Bahadur')",
    [p]
  );

  const row = (await db.query("select * from project_public_progress where id=$1", [p]))
    .rows[0] as Record<string, unknown>;

  // The most recent update is internal, so the public latest is the one before
  // it — not a blank, and certainly not the referral note.
  assert.equal(row.latest_update, "Sheeting ordered.");

  const serialised = JSON.stringify(row);
  assert.ok(!serialised.includes("safeguarding"), "internal updates stay internal");
  assert.ok(!serialised.includes("Ram Bahadur"), "the task roster stays private");
  assert.ok(!("assignee" in row) && !("author" in row));
});

test("a project is exactly as public as the need behind it", async () => {
  const rejected = await project(await need("rejected"));
  const draft = await project(await need(), "draft");
  const live = await project();

  const visible = (
    await db.query<{ id: string }>("select id from project_public_progress")
  ).rows.map((r) => r.id);

  assert.ok(visible.includes(live));
  assert.ok(!visible.includes(rejected), "a need rejected after promotion takes its project with it");
  assert.ok(!visible.includes(draft));

  // The view and lib/publication.ts state the same rule; a drift between them
  // is how a rejected need kept a live project page last time.
  assert.equal(isPublicProject({ stage: "recruiting", need: { kind: "need", status: "rejected" } }), false);
  assert.equal(isPublicProject({ stage: "draft", need: { kind: "need", status: "verified" } }), false);
  assert.equal(isPublicProject({ stage: "recruiting", need: { kind: "need", status: "verified" } }), true);
});

test("draft and paused are reachable stages", async () => {
  const p = await project();
  for (const stage of ["draft", "paused", "recruiting", "in_progress"]) {
    await db.query("update projects set stage=$2 where id=$1", [p, stage]);
  }
  await assert.rejects(
    db.query("update projects set stage='finished' where id=$1", [p]),
    /projects_stage_check|violates check constraint/i
  );
});

test("an output link must be a web address", async () => {
  const p = await project();
  await db.query("insert into project_outputs(project_id,label,url) values($1,'Photos','https://example.org/a')", [p]);
  // A javascript: URL rendered as a link on a public page is stored XSS.
  await assert.rejects(
    db.query("insert into project_outputs(project_id,label,url) values($1,'x','javascript:alert(1)')", [p]),
    /project_outputs_url_check|violates check constraint/i
  );
});
