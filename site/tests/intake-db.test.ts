import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

/**
 * The guarantees migration 011 moves into the database.
 *
 * Deduplication used to be "fetch the last 25 rows and compare them in
 * JavaScript", which is not a concurrency control at all — two requests that
 * arrive together both read a state without the other and both insert. These
 * tests exercise the constraint itself, because the constraint is the thing
 * that actually decides.
 */

const db = new PGlite();
const migration = readFileSync("supabase/011-intake-integrity.sql", "utf8");

before(async () => {
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key, email text); " +
      "create role anon; create role authenticated; create role service_role bypassrls;"
  );
  // PGlite has core gen_random_uuid; the extension itself is Supabase-specific.
  await db.exec(
    readFileSync("supabase/schema.sql", "utf8").replace(
      "create extension if not exists pgcrypto;",
      ""
    )
  );
  await db.exec(readFileSync("supabase/002-public-board.sql", "utf8"));
  await db.exec(readFileSync("supabase/003-service-role-grants.sql", "utf8"));
  await db.exec(migration);
});

after(async () => {
  await db.close();
});

async function scalar(sql: string, params: unknown[] = []): Promise<any> {
  const { rows } = await db.query(sql, params);
  return rows.length === 0 ? null : Object.values(rows[0] as object)[0];
}

async function insertVolunteer(key: string | null, name = "Asha Rai"): Promise<string> {
  return scalar(
    "insert into submissions(kind, lang, fields, org_or_name, idempotency_key) " +
      "values('volunteer','en','{\"consent\":\"on\"}',$1,$2) returning id",
    [name, key]
  );
}

test("the migration is safely re-runnable", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(
    await scalar(
      "select count(*) from information_schema.columns " +
        "where table_name='submissions' and column_name='idempotency_key'"
    ),
    1
  );
});

test("two submissions with the same key produce exactly one row", async () => {
  const key = `client:volunteer:${randomUUID()}`;
  const first = await insertVolunteer(key);

  // The second insert is refused by the database, not by a prior read. This is
  // what makes the outcome the same whether the requests arrive a second apart
  // or at the same instant on two different function instances.
  await assert.rejects(
    insertVolunteer(key, "Asha Rai (retry)"),
    /duplicate key value|unique constraint/i
  );

  assert.equal(
    await scalar("select count(*) from submissions where idempotency_key=$1", [key]),
    1
  );
  // And the row that survived is the original, so the retry resolves to it.
  assert.equal(await scalar("select id from submissions where idempotency_key=$1", [key]), first);
});

test("a corrected resubmission under a new key is accepted", async () => {
  const original = `client:volunteer:${randomUUID()}`;
  const corrected = `client:volunteer:${randomUUID()}`;

  await insertVolunteer(original, "Asha Rai");
  const fixed = await insertVolunteer(corrected, "Asha Rai (corrected email)");

  assert.ok(fixed);
  assert.equal(
    await scalar("select count(*) from submissions where idempotency_key in ($1,$2)", [
      original,
      corrected,
    ]),
    2
  );
});

test("rows without a key never collide with each other", async () => {
  // Every submission written before this migration has a null key, and NULLs
  // are distinct in a unique index — otherwise applying it would fail outright.
  for (let i = 0; i < 3; i++) await insertVolunteer(null, `Legacy ${i}`);
  assert.ok((await scalar("select count(*) from submissions where idempotency_key is null")) >= 3);
});

test("pledges carry the same guarantee, so supply is not double-counted", async () => {
  const key = `client:relief-offer:${randomUUID()}`;
  await db.query(
    "insert into pledges(category, quantity, contact, idempotency_key) values('shelter',20,'x@example.org',$1)",
    [key]
  );
  await assert.rejects(
    db.query(
      "insert into pledges(category, quantity, contact, idempotency_key) values('shelter',20,'x@example.org',$1)",
      [key]
    ),
    /duplicate key value|unique constraint/i
  );
  assert.equal(await scalar("select sum(quantity) from pledges where idempotency_key=$1", [key]), 20);
});

test("confirming the same stored object twice records one document", async () => {
  const submissionId = await insertVolunteer(`client:volunteer:${randomUUID()}`);
  const path = `${submissionId}/1757160000000-photo.png`;

  await db.query(
    "insert into documents(submission_id, storage_path, original_name, mime_type, size_bytes) " +
      "values($1,$2,'photo.png','image/png',2048)",
    [submissionId, path]
  );

  // A retried confirm — a flaky connection, a double tap, the per-file retry
  // this release adds — must not report more attachments than exist.
  await assert.rejects(
    db.query(
      "insert into documents(submission_id, storage_path, original_name, mime_type, size_bytes) " +
        "values($1,$2,'photo.png','image/png',2048)",
      [submissionId, path]
    ),
    /duplicate key value|unique constraint/i
  );

  assert.equal(
    await scalar("select count(*) from documents where submission_id=$1", [submissionId]),
    1
  );
});

test("the migration ledger reports applied migrations without writing anything", async () => {
  const before = await scalar("select count(*) from submissions");

  const { rows } = await db.query<{ migration: string; applied: boolean }>(
    "select migration, applied from migration_state order by migration"
  );

  const applied = new Map(rows.map((row) => [row.migration, row.applied]));
  assert.equal(applied.get("schema"), true);
  assert.equal(applied.get("002"), true);
  assert.equal(applied.get("011"), true);
  // Migrations this fixture deliberately does not run are reported as missing
  // rather than assumed present because their file exists in the repository.
  assert.equal(applied.get("010"), false);
  assert.equal(applied.get("008"), false);

  // The check that the deleted diagnostic probe could not make: reading the
  // ledger leaves the submissions table exactly as it found it.
  assert.equal(await scalar("select count(*) from submissions"), before);
});

test("write privilege is reported from the grant layer, not by writing", async () => {
  const before = await scalar("select count(*) from submissions");
  assert.equal(await scalar("select has_submissions_insert()"), true);
  assert.equal(await scalar("select count(*) from submissions"), before);

  await db.exec("revoke insert on submissions from service_role");
  assert.equal(await scalar("select has_submissions_insert()"), false);
  await db.exec("grant insert on submissions to service_role");
});
