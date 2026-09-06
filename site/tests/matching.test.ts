import test from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../lib/matching/engine";
import { legacyFacts } from "../lib/matching/normalize";
import { isoDate } from "../lib/matching/catalog";
import { parseFacts, parseRole } from "../lib/matching/validation";
import { emailConfigured, sendMatchingEmail } from "../lib/matching/email";
import { context, now, profile, role, volunteer } from "./fixtures";

test("remote matching works without mission preferences or home district", () => {
  const result = recommend(role(),[volunteer()],context());
  assert.equal(result.ready.length,1);
  assert.equal(result.ready[0].checks.some(c => c.key === "travel"),false);
});
test("legacy engineering/travel defaults are unknown, not assumed facts", () => {
  const v = volunteer("legacy", {status:"submitted", fields:{consent:"on","s03-primary-skill":"Engineering (structural / civil)","s05-where-you-can-work":"On the ground","s05-travel":"Anywhere in Nepal","s02-how-you-can-contribute":"I can help remotely"}});
  const facts = legacyFacts(v);
  assert.equal(facts.skills,null); assert.equal(facts.workMode,null); assert.equal(facts.travel,null);
  const result = recommend(role(),[v],context([]));
  assert.equal(result.clarify.length,1); assert.equal(result.ready.length,0);
  assert.ok(result.clarify[0].checks.find(c => c.key === "skill:engineering")?.question);
});
test("new form version records explicit dropdown answers but cannot verify licences", () => {
  const facts = legacyFacts(volunteer("new",{fields:{__form_version:2,"s03-primary-skill":"Engineering (structural / civil)","s05-where-you-can-work":"On the ground","s05-travel":"Anywhere in Nepal"}}));
  assert.deepEqual(facts.skills,["engineering"]); assert.equal(facts.workMode,"onsite");
  const r = role(); r.config.qualifications=["professional registration"];
  assert.equal(recommend(r,[volunteer()],context()).clarify.length,1);
});
test("confirmed incompatible work preference fails even with matching mission", () => {
  const p = profile(); p.facts.workMode="onsite"; p.mission_ids=["housing"];
  const r = role(); r.config.missionIds=["housing"];
  assert.equal(recommend(r,[volunteer()],context([p])).excluded[0].checks.find(c=>c.key==="mode")?.result,"fail");
});
test("missing availability is unknown; known incompatible dates fail", () => {
  const p = profile(); p.facts.availableUntil=null;
  assert.equal(recommend(role(),[volunteer()],context([p])).clarify.length,1);
  p.facts.availableUntil="2026-09-12";
  assert.equal(recommend(role(),[volunteer()],context([p])).excluded.length,1);
});
test("stale availability requires confirmation; other recent facts do not fix it", () => {
  const p = profile(); p.confirmed_at="2026-07-01T00:00:00Z";
  assert.equal(recommend(role(),[volunteer()],context([p])).clarify[0].checks.find(c=>c.key==="freshness")?.result,"unknown");
});
test("all required skills must be met, but a lone legacy primary is not an exhaustive skill list", () => {
  const r = role(); r.config.skills=["engineering","logistics"];
  assert.equal(recommend(r,[volunteer()],context()).excluded.length,1);
  const v = volunteer("old",{fields:{consent:"on","s03-primary-skill":"Architecture"}});
  assert.equal(recommend(r,[v],context([])).clarify.length,1);
});
test("either mode permits remote without travel; hybrid requires both", () => {
  const r = role(); r.config.workMode="either"; r.config.district="Kathmandu";
  assert.equal(recommend(r,[volunteer()],context()).ready.length,1);
  r.config.workMode="hybrid";
  assert.equal(recommend(r,[volunteer()],context()).excluded.length,1);
});
test("on-site work checks travel limits and full deployment duration", () => {
  const p = profile(); p.facts.workMode="both"; p.facts.district="Lalitpur"; p.facts.travel="local"; p.facts.maxDeploymentDays=7;
  const r = role(); r.config.workMode="onsite"; r.config.district="Kathmandu";
  const checks=recommend(r,[volunteer()],context([p])).excluded[0].checks;
  assert.equal(checks.find(c=>c.key==="travel")?.result,"fail"); assert.equal(checks.find(c=>c.key==="deployment")?.result,"fail");
});
test("mission alignment breaks eligible ties without excluding other missions", () => {
  const a=profile("asha"), b=profile("ravi"); a.mission_ids=["housing"]; b.mission_ids=["wash"];
  const r=role(); r.config.missionIds=["housing"];
  assert.deepEqual(recommend(r,[volunteer("ravi"),volunteer("asha")],context([a,b])).ready.map(x=>x.volunteerId),["asha","ravi"]);
});
test("explicit interest outranks mission alignment among equally skilled people", () => {
  const a=profile("asha"), b=profile("ravi"); a.mission_ids=["housing"];
  const c=context([a,b]); c.interestedUserIds.add("user-ravi"); const r=role(); r.config.missionIds=["housing"];
  assert.equal(recommend(r,[volunteer("asha"),volunteer("ravi")],c).ready[0].volunteerId,"ravi");
});
test("pause and explicit mission-only scope are respected", () => {
  const p=profile(); p.paused=true;
  assert.equal(recommend(role(),[volunteer()],context([p])).excluded.length,1);
  p.paused=false;p.mission_only=true;p.mission_ids=["wash"];
  assert.equal(recommend(role(),[volunteer()],context([p])).excluded.length,1);
});
test("unknown required experience cannot be outweighed by specialties", () => {
  const r=role();r.config.minExperienceYears=5;r.config.preferredSpecialties=["housing"];
  const p=profile();p.facts.specialties=["housing"];
  assert.equal(recommend(r,[volunteer()],context([p])).clarify.length,1);
});
test("outstanding invitations prevent multiple requests to the same person", () => {
  const c=context();c.invitations=[{id:"i",role_id:"other",need_id:"other",volunteer_id:"asha",status:"sent",created_at:now,expires_at:"2026-09-08T12:00:00Z",role_revision:1}];
  assert.equal(recommend(role(),[volunteer()],c).excluded.length,1);
});
test("decline suppresses the same role, not unrelated work", () => {
  const c=context();c.invitations=[{id:"i",role_id:"other",need_id:"other",volunteer_id:"asha",status:"declined",created_at:now,expires_at:now,role_revision:1}];
  assert.equal(recommend(role(),[volunteer()],c).ready.length,1);
  c.invitations[0].role_id=role().id;
  assert.equal(recommend(role(),[volunteer()],c).excluded.length,1);
});
test("expired response holds free slots for another volunteer", () => {
  const c=context();c.invitations=[{id:"i",role_id:role().id,need_id:role().need_id,volunteer_id:"someone-else",status:"accepted",created_at:now,expires_at:"2026-09-05T00:00:00Z",role_revision:1}];
  assert.equal(recommend(role(),[volunteer()],c).ready.length,1);
});
test("commitments use peak simultaneous hours, not cumulative disjoint work", () => {
  const c=context();c.commitments=[
    {needId:"a",volunteerId:"asha",startDate:"2026-09-10",endDate:"2026-09-15",hoursPerWeek:5},
    {needId:"b",volunteerId:"asha",startDate:"2026-09-16",endDate:"2026-09-23",hoursPerWeek:5},
  ];
  assert.equal(recommend(role(),[volunteer()],c).ready.length,1);
  c.commitments[1].startDate="2026-09-14";
  assert.equal(recommend(role(),[volunteer()],c).excluded.length,1);
});
test("unscheduled commitments require coordinator review", () => {
  const c=context();c.commitments=[{needId:"other",volunteerId:"asha",startDate:null,endDate:null,hoursPerWeek:null}];
  assert.equal(recommend(role(),[volunteer()],c).clarify.length,1);
});
test("closed needs, missing consent and unreviewed volunteers cannot be invited", () => {
  const c=context();c.needStatus="completed";assert.equal(recommend(role(),[volunteer()],c).excluded.length,1);
  assert.equal(recommend(role(),[volunteer("asha",{fields:{}})],context()).clarify.length,1);
  assert.equal(recommend(role(),[volunteer("asha",{status:"submitted"})],context()).clarify.length,1);
});
test("repeated evaluations and reordered input preserve tie ordering", () => {
  const people=[volunteer("a"),volunteer("b"),volunteer("c")];const c=context(people.map(p=>profile(p.id)));
  assert.deepEqual(recommend(role(),people,c),recommend(role(),[...people].reverse(),c));
});
test("calendar validation rejects impossible and ambiguous dates", () => {
  assert.equal(isoDate("31/02/2026"),null);assert.equal(isoDate("2026-02-30"),null);
  assert.equal(isoDate("2026-09-05"),"2026-09-05");assert.equal(isoDate("05/09/2026"),"2026-09-05");assert.equal(isoDate("tomorrow"),null);
});
test("input validation preserves unknowns and refuses invalid requirements", () => {
  const f=new FormData();assert.equal(parseFacts(f).skills,null);assert.equal(parseFacts(f).hoursPerWeek,null);
  f.set("hoursPerWeek","200");assert.throws(()=>parseFacts(f));
  const r=new FormData();r.set("title","Engineer");r.append("skills","engineering");r.set("workMode","remote");r.set("startDate","2026-09-10");r.set("endDate","2026-09-23");r.set("hoursPerWeek","5");r.set("headcount","1");
  assert.deepEqual(parseRole(r).config.missionIds,[]);assert.deepEqual(parseRole(r,["future-mission"]).config.missionIds,["future-mission"]);
  r.set("endDate","2026-09-01");assert.throws(()=>parseRole(r));
});
test("email cannot send when disabled, even with a mocked provider", async () => {
  assert.equal(emailConfigured({}),false);
  const old=process.env.MATCHING_EMAIL_ENABLED;process.env.MATCHING_EMAIL_ENABLED="0";
  let called=false;
  try { await assert.rejects(sendMatchingEmail("id",{to:"test@example.org",subject:"Test",text:"Test"},async()=>{called=true;return new Response();}));assert.equal(called,false); }
  finally { if(old===undefined) delete process.env.MATCHING_EMAIL_ENABLED;else process.env.MATCHING_EMAIL_ENABLED=old; }
});
