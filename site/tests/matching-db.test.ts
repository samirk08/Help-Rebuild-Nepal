import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migration = readFileSync("supabase/010-matching-engine.sql", "utf8");
before(async () => {
  await db.exec("create schema auth; create table auth.users(id uuid primary key,email text); create role anon; create role authenticated; create role service_role bypassrls;");
  // PGlite has core gen_random_uuid; the extension itself is Supabase-specific.
  await db.exec(readFileSync("supabase/schema.sql","utf8").replace("create extension if not exists pgcrypto;",""));
  await db.exec(readFileSync("supabase/002-public-board.sql","utf8"));
  await db.exec(migration);
});
after(async () => { await db.close(); });
async function scalar(sql:string,params:unknown[]=[]):Promise<any> { return Object.values((await db.query(sql,params)).rows[0] as object)[0]; }
async function fixture(headcount=1, hours=5, volunteer?:string) {
  const need=randomUUID(), v=volunteer??randomUUID(), role=randomUUID();
  await db.query("insert into submissions(id,kind,status,lang,fields,contact_email,matching_contact_approved) values($1,'need','verified','en','{}','requester@example.org',true)",[need]);
  if (!volunteer) {
    await db.query("insert into submissions(id,kind,status,lang,fields,contact_email) values($1,'volunteer','verified','en','{\"consent\":\"on\"}','volunteer@example.org')",[v]);
    await db.query("insert into matching_profiles(volunteer_id,facts) values($1,'{\"hoursPerWeek\":10}')",[v]);
  }
  const config={startDate:'2090-09-10',endDate:'2090-09-23',hoursPerWeek:hours};
  await db.query("insert into matching_roles(id,need_id,title,headcount,config) values($1,$2,'Test role',$3,$4)",[role,need,headcount,JSON.stringify(config)]);
  return {need,v,role};
}
async function queue(f:Awaited<ReturnType<typeof fixture>>, rev=1) {
  const token=randomUUID();
  const id=await scalar("select matching_queue_invitation($1,$2,$3,1,$4,'{}','{\"to\":\"volunteer@example.org\"}',null)",[f.role,f.v,rev,token]);
  return {id,token};
}
async function accept(token:string) { return scalar("select matching_respond($1,'accepted',false)",[token]); }
async function confirm(id:string,rev=1) { return scalar("select matching_confirm($1,$2,null,'{\"to\":\"volunteer@example.org\"}','{\"to\":\"requester@example.org\"}')",[id,rev]); }

test("actual migration runs twice and kind guards reject wrong record types",async()=>{
  await db.exec(migration);
  const f=await fixture();
  await assert.rejects(db.query("insert into matching_profiles(volunteer_id) values($1)",[f.need]),/requires a volunteer/);
  await assert.rejects(db.query("insert into matching_roles(need_id,title,headcount,config) values($1,'Bad',1,'{}')",[f.v]),/requires a need/);
});
test("anon and authenticated roles cannot read private profiles or call mutations",async()=>{
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select * from matching_profiles"),/permission denied/);
      await assert.rejects(db.query("select matching_claim_emails(1)"),/permission denied/);
      await assert.rejects(db.query("select matching_respond('x','accepted',false)"),/permission denied/);
    } finally { await db.exec("reset role"); }
  }
});
test("queue is atomic, reserves a place and prevents repeat or cross-role invitations",async()=>{
  const f=await fixture(), i=await queue(f);
  assert.equal(await scalar("select count(*) from matching_email_outbox where invitation_id=$1",[i.id]),1);
  await assert.rejects(queue(f),/outstanding invitation/);
  const second=await fixture(1,5,f.v);
  await assert.rejects(queue(second),/outstanding invitation/);
  const other=await fixture();
  await assert.rejects(queue({...f,v:other.v}),/No open slots/);
  assert.equal(await scalar("select count(*) from matching_invitations where role_id=$1",[f.role]),1);
});
test("stale revisions, paused availability and role edits block invitations",async()=>{
  const f=await fixture();
  await assert.rejects(queue(f,2),/Role changed/);
  const i=await queue(f);
  await db.query("update matching_roles set title='Changed' where id=$1",[f.role]);
  assert.equal(await scalar("select status from matching_invitations where id=$1",[i.id]),'cancelled');
  await assert.rejects(accept(i.token),/no longer active/);
  const p=await fixture();
  await db.query("update matching_profiles set paused=true where volunteer_id=$1",[p.v]);
  await assert.rejects(queue(p),/Profile changed/);
});
test("response retries are idempotent; confirmation makes one commitment and two introductions",async()=>{
  const f=await fixture(), i=await queue(f);
  assert.equal(await accept(i.token),'accepted');
  assert.equal(await accept(i.token),'accepted');
  const mid=await confirm(i.id);
  assert.equal(await confirm(i.id),mid);
  assert.equal(await scalar("select status from matches where id=$1",[mid]),'verified');
  assert.equal(await scalar("select count(*) from matching_email_outbox where invitation_id=$1",[i.id]),3);
  assert.equal(await scalar("select count(*) from matching_commitments where invitation_id=$1",[i.id]),1);
});
test("expiry, closed needs and revoked contact permission block old tokens",async()=>{
  for (const change of ['expire','close','contact']) {
    const f=await fixture(),i=await queue(f);
    if (change==='expire') await db.query("update matching_invitations set expires_at=now()-interval '1 minute' where id=$1",[i.id]);
    if (change==='close') await db.query("update submissions set status='completed' where id=$1",[f.need]);
    if (change==='contact') await db.query("update submissions set matching_contact_approved=false where id=$1",[f.need]);
    await assert.rejects(accept(i.token),/no longer active/);
  }
});
test("confirmation prevents weekly overbooking and completion releases availability",async()=>{
  const f=await fixture(1,6),i=await queue(f); await accept(i.token); const mid=await confirm(i.id);
  const second=await fixture(1,5,f.v),j=await queue(second); await accept(j.token);
  await assert.rejects(confirm(j.id),/Insufficient weekly capacity/);
  await scalar("select matching_finish($1,'completed')",[i.id]);
  assert.equal(await scalar("select status from matches where id=$1",[mid]),'completed');
  assert.ok(await confirm(j.id));
});
test("withdrawal releases the place without removing history",async()=>{
  const f=await fixture(),i=await queue(f); await accept(i.token); const mid=await confirm(i.id);
  await scalar("select matching_finish($1,'withdrawn')",[i.id]);
  assert.equal(await scalar("select status from matches where id=$1",[mid]),'rejected');
  assert.equal(await scalar("select status from matching_invitations where id=$1",[i.id]),'cancelled');
  const other=await fixture(); assert.ok((await queue({...f,v:other.v})).id);
});
test("outbox lease prevents duplicate claims and ambiguous old sends fail closed",async()=>{
  await db.exec("update matching_email_outbox set status='cancelled' where status='pending'");
  const f=await fixture(),i=await queue(f);
  const first=await db.query("select * from matching_claim_emails(1)");
  assert.equal(first.rows.length,1);
  assert.equal((await db.query("select * from matching_claim_emails(1)")).rows.length,0);
  await db.query("update matching_email_outbox set locked_until=now()-interval '1 minute',created_at=now()-interval '25 hours' where invitation_id=$1",[i.id]);
  assert.equal((await db.query("select * from matching_claim_emails(1)")).rows.length,0);
  assert.equal(await scalar("select status from matching_email_outbox where invitation_id=$1",[i.id]),'failed');
});
test("out-of-order duplicate delivery events pause bounced recipients without refreshing availability",async()=>{
  const f=await fixture(),i=await queue(f),provider=randomUUID();
  const before=await scalar("select confirmed_at from matching_profiles where volunteer_id=$1",[f.v]);
  const job=await scalar("select id from matching_email_outbox where invitation_id=$1",[i.id]);
  const event=randomUUID();
  for(let n=0;n<2;n++) await db.query("select matching_record_delivery($1,$2,'email.bounced',now())",[event,provider]);
  await db.query("select matching_record_sent($1,$2)",[job,provider]);
  await db.query("select matching_record_delivery($1,$2,'email.delivered',now())",[randomUUID(),provider]);
  assert.equal(await scalar("select delivery_status from matching_email_outbox where id=$1",[job]),'email.bounced');
  assert.equal(await scalar("select paused from matching_profiles where volunteer_id=$1",[f.v]),true);
  assert.deepEqual(await scalar("select confirmed_at from matching_profiles where volunteer_id=$1",[f.v]),before);
  assert.equal(await scalar("select count(*) from matching_email_events where id=$1",[event]),1);
});
