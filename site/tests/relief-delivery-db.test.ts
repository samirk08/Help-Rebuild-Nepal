import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

import { DELIVERY_STAGES, nextStages } from "../lib/relief-delivery";

/**
 * Relief delivery stages, against the database that enforces them.
 *
 * The acceptance criteria for this phase are all about one confusion: an offer
 * is not a delivery. These tests hold the four separations that follow from it
 * — pledged is not received, a partial receipt still leaves demand, a closed or
 * allocated request refuses new offers, and the recipient's phone number never
 * reaches a public read.
 */

const db = new PGlite();
const migration = readFileSync("supabase/018-relief-delivery.sql", "utf8");

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

async function itemNeed(quantity = 200): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into item_needs(id,category,quantity,district,municipality,needed_by,requester," +
      "verified,detail,detail_np,contact_name,contact_phone,contact_email) " +
      "values($1,'tarpaulin',$2,'Sindhupalchok','Melamchi','2026-10-01','Ward 7 office'," +
      "true,'Roofing before the rains.','','Ward Secretary','+977-9800000000','ward7@example.np')",
    [id, quantity]
  );
  return id;
}

/** A verified offer, which is the only kind that can be reserved. */
async function pledge(needId: string | null, quantity: number, status = "verified"): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into pledges(id,item_need_id,category,quantity,status) values($1,$2,'tarpaulin',$3,$4)",
    [id, needId, quantity, status]
  );
  return id;
}

const progress = async (needId: string) =>
  (await db.query("select * from item_need_progress where item_need_id=$1", [needId]))
    .rows[0] as Record<string, number | string>;

test("the migration is safely re-runnable and appears in the ledger", async () => {
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await scalar("select count(*) from migration_state where migration='018'"), 1);
});

test("pledged and received are different numbers", async () => {
  const need = await itemNeed(200);
  const p = await pledge(need, 200);

  // An offer on its own moves `pledged` and nothing else. This is the whole
  // point: a board reading "200 of 200" against goods that have not moved
  // tells a coordinator to stop looking, and the tarpaulins never arrive.
  let g = await progress(need);
  assert.equal(g.pledged, 200);
  assert.equal(g.received, 0);
  assert.equal(g.committed, 0);
  assert.equal(g.remaining, 200);

  await db.query("select relief_advance_pledge($1,'reserved')", [p]);
  g = await progress(need);
  assert.equal(g.reserved, 200);
  assert.equal(g.received, 0);
  assert.equal(g.remaining, 0, "a reserved delivery is committed supply");

  await db.query("select relief_advance_pledge($1,'dispatched')", [p]);
  await db.query("select relief_advance_pledge($1,'received',200,null,null,'Ward Secretary')", [p]);

  g = await progress(need);
  assert.equal(g.received, 200);
  assert.equal(g.committed, 0);
  assert.equal(await scalar("select received_by from pledges where id=$1", [p]), "Ward Secretary");
});

test("a partial receipt puts the shortfall back into remaining demand", async () => {
  const need = await itemNeed(200);
  const p = await pledge(need, 200);

  await db.query("select relief_advance_pledge($1,'reserved')", [p]);
  await db.query("select relief_advance_pledge($1,'dispatched')", [p]);
  // 200 were promised; 140 arrived. The 60 are demand again, not a rounding
  // error to be absorbed by whoever notices.
  await db.query("select relief_advance_pledge($1,'received',140)", [p]);

  const g = await progress(need);
  assert.equal(g.received, 140);
  assert.equal(g.remaining, 60);
  // Reserving all 200 closed the request; 60 short reopens it, because those
  // 60 are needed by someone who cannot currently offer them.
  assert.equal(g.status, "requested");
});

test("a partial receipt does not reopen a request someone closed by hand", async () => {
  const need = await itemNeed(200);
  const p = await pledge(need, 200);
  await db.query("select relief_advance_pledge($1,'reserved')", [p]);
  await db.query("select relief_set_item_need_status($1,'closed','The district sent a truck')", [need]);

  await db.query("select relief_advance_pledge($1,'received',140)", [p]);

  assert.equal(await scalar("select status from item_needs where id=$1", [need]), "closed");
  assert.equal(
    await scalar("select closed_reason from item_needs where id=$1", [need]),
    "The district sent a truck"
  );
});

test("receiving requires a quantity, and one that could have arrived", async () => {
  const need = await itemNeed(100);
  const p = await pledge(need, 50);
  await db.query("select relief_advance_pledge($1,'reserved')", [p]);

  await assert.rejects(
    db.query("select relief_advance_pledge($1,'received')", [p]),
    /record how much actually arrived/i
  );
  await assert.rejects(
    db.query("select relief_advance_pledge($1,'received',80)", [p]),
    /between 1 and 50/i
  );
});

test("stages move one step at a time", async () => {
  const need = await itemNeed(100);
  const p = await pledge(need, 10);

  // Straight from an untouched offer to "it arrived" would record goods
  // nobody ever agreed to collect.
  await assert.rejects(
    db.query("select relief_advance_pledge($1,'received',10)", [p]),
    /only an arranged delivery/i
  );
  await assert.rejects(
    db.query("select relief_advance_pledge($1,'dispatched')", [p]),
    /only a reserved delivery/i
  );

  const unchecked = await pledge(need, 10, "submitted");
  await assert.rejects(
    db.query("select relief_advance_pledge($1,'reserved')", [unchecked]),
    /verify this offer/i
  );

  await db.query("select relief_advance_pledge($1,'reserved')", [p]);
  await db.query("select relief_advance_pledge($1,'received',10)", [p]);
  await assert.rejects(
    db.query("select relief_advance_pledge($1,'cancelled')", [p]),
    /cannot be cancelled/i
  );

  // Idempotent, like every other state change here: a double-tapped button
  // returns the stage already recorded.
  assert.equal(await scalar("select relief_advance_pledge($1,'received',10)", [p]), "received");
});

test("a fully allocated request refuses new offers and closes itself", async () => {
  const need = await itemNeed(100);
  const p = await pledge(need, 100);
  await db.query("select relief_advance_pledge($1,'reserved')", [p]);

  assert.equal(await scalar("select status from item_needs where id=$1", [need]), "closed");
  await assert.rejects(pledge(need, 10), /closed and is not taking new offers/i);
});

test("a closed request refuses offers, and reopening lets them back in", async () => {
  const need = await itemNeed(100);
  await db.query("select relief_set_item_need_status($1,'closed','The district sent a truck')", [need]);

  await assert.rejects(pledge(need, 10), /closed and is not taking new offers/i);

  await db.query("select relief_set_item_need_status($1,'requested')", [need]);
  assert.equal(await scalar("select closed_at from item_needs where id=$1", [need]), null);
  await pledge(need, 10);
  assert.equal(await scalar("select count(*) from pledges where item_need_id=$1", [need]), 1);
});

test("allocation is measured in commitments, not in offers", async () => {
  const need = await itemNeed(100);
  await pledge(need, 100);

  // 100 offered, nothing arranged. Another offer is a legitimate backup and is
  // admitted; if bare offers counted as supply, one optimistic pledge could
  // lock everyone else out of a request that never gets filled.
  await pledge(need, 40);
  const g = await progress(need);
  assert.equal(g.pledged, 140);
  assert.equal(g.remaining, 100);
});

test("a cancelled offer stops counting", async () => {
  const need = await itemNeed(100);
  const p = await pledge(need, 60);
  assert.equal((await progress(need)).pledged, 60);

  await db.query("select relief_advance_pledge($1,'cancelled')", [p]);
  assert.equal((await progress(need)).pledged, 0);
  // `item_need_pledged` sums to bigint, which arrives as a string — the shape
  // lib/relief-data.ts already coerces with Number().
  assert.equal(await scalar("select count(*) from item_need_pledged where item_need_id=$1", [need]), 0);
});

test("the public view never carries the recipient's contact details", async () => {
  const need = await itemNeed(100);
  const columns = (
    await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name='item_needs_public'"
    )
  ).rows.map((r) => r.column_name);

  // A named person and a phone number, published next to a location and a
  // shortage, is a safety problem before it is a privacy one.
  for (const secret of ["contact_name", "contact_phone", "contact_email"]) {
    assert.ok(!columns.includes(secret), `${secret} must not be publicly readable`);
  }
  assert.ok(columns.includes("delivery_window"), "public delivery arrangements are publishable");

  const row = (await db.query("select * from item_needs_public where id=$1", [need])).rows[0] as object;
  assert.ok(!JSON.stringify(row).includes("9800000000"));
});

test("unverified item needs stay off the public view", async () => {
  const id = randomUUID();
  await db.query(
    "insert into item_needs(id,category,quantity,district,municipality,needed_by,requester,verified,detail,detail_np) " +
      "values($1,'blanket',10,'Dolakha','Jiri','2026-10-01','A neighbour',false,'x','')",
    [id]
  );
  assert.equal(await scalar("select count(*) from item_needs_public where id=$1", [id]), 0);
});

test("an unrequested offer has no demand to overrun", async () => {
  const id = await pledge(null, 500);
  assert.equal(await scalar("select item_need_id from pledges where id=$1", [id]), null);
});

test("the transition table in lib/relief-delivery.ts is the one the database enforces", async () => {
  // The dashboard renders buttons from `nextStages`. If that table and the SQL
  // ever disagree, a coordinator gets a button that raises an exception — or,
  // worse, no button for something the system will happily accept from
  // somewhere else.
  const walk: Record<string, Array<[string, number | null]>> = {
    offered: [],
    reserved: [["reserved", null]],
    dispatched: [["reserved", null], ["dispatched", null]],
    received: [["reserved", null], ["received", 10]],
    cancelled: [["cancelled", null]],
  };

  for (const from of DELIVERY_STAGES) {
    for (const to of DELIVERY_STAGES) {
      if (from === to) continue;  // Same-stage calls are idempotent, not transitions.

      // A fresh, generously sized need each time, so the auto-close on a met
      // request never interferes with the transition under test.
      const need = await itemNeed(10_000);
      const p = await pledge(need, 10);
      for (const [stage, qty] of walk[from]) {
        await db.query("select relief_advance_pledge($1,$2,$3)", [p, stage, qty]);
      }
      assert.equal(await scalar("select stage from pledges where id=$1", [p]), from);

      const allowed = nextStages(from, "verified").includes(to);
      const attempt = db.query("select relief_advance_pledge($1,$2,$3)", [p, to, to === "received" ? 10 : null]);

      if (allowed) {
        await attempt;
        assert.equal(await scalar("select stage from pledges where id=$1", [p]), to, `${from} -> ${to}`);
      } else {
        await assert.rejects(attempt, /.*/, `${from} -> ${to} should be refused`);
      }
    }
  }
});

test("delivery history is append-only", async () => {
  const need = await itemNeed(100);
  const p = await pledge(need, 20);
  await db.query("select relief_advance_pledge($1,'reserved')", [p]);

  assert.equal(
    await scalar("select event from item_need_events where pledge_id=$1", [p]),
    "pledge_reserved"
  );
  await assert.rejects(
    db.query("update item_need_events set event='nothing happened' where pledge_id=$1", [p]),
    /append-only/i
  );
  await assert.rejects(
    db.query("delete from item_need_events where pledge_id=$1", [p]),
    /append-only/i
  );
});
