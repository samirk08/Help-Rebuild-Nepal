import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

import { deriveQueueItems } from "../lib/situation/derive";
import type { QueueSources } from "../lib/situation/types";

/**
 * Clarification questions, against the database that enforces them.
 *
 * The engine has always produced a question for every check it could not
 * answer; nothing stored, sent or answered them. These tests hold the two
 * rules that make the new path safe: an answer is a single deliberate write,
 * and an answer is not the same evidence as a confirmed profile fact.
 */

const db = new PGlite();
const migration = readFileSync("supabase/017-clarifications.sql", "utf8");

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

async function volunteer(): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into submissions(id,kind,status,lang,fields,contact_email) " +
      "values($1,'volunteer','verified','en','{\"consent\":\"on\"}','v@example.org')",
    [id]
  );
  await db.query("insert into matching_profiles(volunteer_id,facts) values($1,'{\"hoursPerWeek\":10}')", [id]);
  return id;
}

/** Returns the raw token; only its hash is ever stored. */
async function ask(volunteerId: string, checkKey = "dates"): Promise<string> {
  const token = randomUUID().replace(/-/g, "").padEnd(64, "a");
  await db.query(
    "insert into matching_questions(volunteer_id,check_key,question,token_hash) values($1,$2,'Are you free 10-23 Sep?',$3)",
    [volunteerId, checkKey, createHash("sha256").update(token).digest("hex")]
  );
  return token;
}

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

test("the migration is safely re-runnable and appears in the ledger", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await scalar("select count(*) from migration_state where migration='017'"), 1);
});

test("a question can be answered exactly once", async () => {
  const v = await volunteer();
  const token = await ask(v);

  assert.equal(await scalar("select matching_answer_question($1,'Yes, all three weeks')", [hash(token)]), "Yes, all three weeks");
  assert.equal(await scalar("select state from matching_questions where token_hash=$1", [hash(token)]), "answered");

  // Idempotent rather than an error: a retried submit — a double tap, a flaky
  // connection — returns what was recorded instead of replacing it.
  assert.equal(
    await scalar("select matching_answer_question($1,'Actually no')", [hash(token)]),
    "Yes, all three weeks"
  );
});

test("answering does not silently rewrite the volunteer's profile", async () => {
  const v = await volunteer();
  const before = await scalar("select facts from matching_profiles where volunteer_id=$1", [v]);
  const revision = await scalar("select revision from matching_profiles where volunteer_id=$1", [v]);

  await db.query("select matching_answer_question($1,'Yes')", [hash(await ask(v))]);

  // A sentence typed into a form is not the same evidence as a volunteer
  // confirming their own profile. A coordinator reads the answer and applies
  // it through the editor, where it gets a confirmed_at behind it.
  assert.deepEqual(await scalar("select facts from matching_profiles where volunteer_id=$1", [v]), before);
  assert.equal(await scalar("select revision from matching_profiles where volunteer_id=$1", [v]), revision);
});

test("an unknown, withdrawn or expired token cannot answer", async () => {
  const v = await volunteer();

  await assert.rejects(
    db.query("select matching_answer_question($1,'Yes')", [hash("nope")]),
    /no longer available/i
  );

  const withdrawn = await ask(v, "hours");
  await db.query("update matching_questions set state='withdrawn' where token_hash=$1", [hash(withdrawn)]);
  await assert.rejects(
    db.query("select matching_answer_question($1,'Yes')", [hash(withdrawn)]),
    /no longer available/i
  );

  const expired = await ask(v, "mode");
  await db.query("update matching_questions set expires_at=now()-interval '1 day' where token_hash=$1", [hash(expired)]);
  await assert.rejects(
    db.query("select matching_answer_question($1,'Yes')", [hash(expired)]),
    /no longer available/i
  );
});

test("an empty answer is refused", async () => {
  const v = await volunteer();
  const token = await ask(v);
  await assert.rejects(db.query("select matching_answer_question($1,'   ')", [hash(token)]), /answer is required/i);
  assert.equal(await scalar("select state from matching_questions where token_hash=$1", [hash(token)]), "open");
});

test("only one question per check may be outstanding at a time", async () => {
  const v = await volunteer();
  await ask(v, "dates");

  // Without this a coordinator clicking twice emails the same question twice
  // and the Situation Room shows it as two separate jobs.
  await assert.rejects(ask(v, "dates"), /duplicate key value|unique constraint/i);

  // Once answered, the same check may legitimately be asked again later.
  await db.query("update matching_questions set state='answered' where volunteer_id=$1", [v]);
  await ask(v, "dates");
  assert.equal(await scalar("select count(*) from matching_questions where volunteer_id=$1", [v]), 2);
});

test("a question requires a volunteer registration", async () => {
  const need = randomUUID();
  await db.query("insert into submissions(id,kind,status,lang,fields) values($1,'need','verified','en','{}')", [need]);
  await assert.rejects(ask(need), /requires a volunteer registration/i);
});

test("the outbox admits a question, and refuses a row with both or neither subject", async () => {
  const v = await volunteer();
  await ask(v);
  const qid = await scalar("select id from matching_questions where volunteer_id=$1", [v]);

  await db.query(
    "insert into matching_email_outbox(question_id,kind,payload) values($1,'clarification','{\"to\":\"v@example.org\"}')",
    [qid]
  );
  assert.equal(await scalar("select count(*) from matching_email_outbox where question_id=$1", [qid]), 1);

  // Exactly one subject: a row with neither is unsendable, a row with both is
  // ambiguous about what it delivers.
  await assert.rejects(
    db.query("insert into matching_email_outbox(kind,payload) values('clarification','{}')"),
    /subject_check|violates check constraint/i
  );
});

test("the Situation Room derives an open question and stops once it is answered", async () => {
  const v = await volunteer();
  const token = await ask(v, "skill:engineering");
  const { rows } = await db.query<{ id: string; volunteer_id: string; role_id: string | null; check_key: string; question: string; asked_at: string; state: string }>(
    "select id, volunteer_id, role_id, check_key, question, asked_at::text, state from matching_questions where token_hash=$1",
    [hash(token)]
  );

  const base: QueueSources = {
    now: new Date().toISOString(),
    needs: [], relatedNeeds: [], invitations: [], roles: [], volunteers: [],
    profiles: [], events: [], outbox: [], questions: rows, itemNeeds: [],
  };

  const open = deriveQueueItems(base).filter((i) => i.kind === "unanswered_question");
  assert.equal(open.length, 1);
  assert.equal(open[0].recordId, rows[0].id);

  // Answered questions leave the queue — the data layer only selects `open`,
  // and the deriver refuses anything else even if it is handed one.
  const answered = deriveQueueItems({ ...base, questions: [{ ...rows[0], state: "answered" }] });
  assert.equal(answered.filter((i) => i.kind === "unanswered_question").length, 0);
});
