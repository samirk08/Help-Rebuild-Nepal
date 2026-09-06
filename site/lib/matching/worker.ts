import { supabaseAdmin } from "../supabase";
import { getNeeds, loadMatching } from "./data";
import { recommend } from "./engine";
import { emailConfigured, sendMatchingEmail } from "./email";
import type { EmailPayload } from "./email";

type Outbox = { id:string; invitation_id:string; kind:string; payload:EmailPayload; attempts:number; status:string };
export async function processMatchingEmails() {
  if (!emailConfigured()) return { enabled:false, sent:0, failed:0, cancelled:0 };
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("matching_claim_emails",{p_limit:3});
  if (error) throw new Error("Could not claim pending email work.");
  const counts = { enabled:true, sent:0, failed:0, cancelled:0 };
  const jobs = (data ?? []) as Outbox[];
  if (jobs.length === 0) return counts;

  const invitationIds = jobs.map(j => j.invitation_id);
  const { data: invitations, error: invError } = await db.from("matching_invitations").select("*").in("id", invitationIds);
  if (invError) throw new Error("Invitations could not be read.");
  const invitationsById = new Map(invitations.map(i => [i.id, i]));

  const needIds = [...new Set(invitations.map(i => i.need_id))];
  const needsData = await getNeeds(needIds);
  const needsById = new Map(needsData.map(n => [n.id, n]));

  const volunteerIds = [...new Set(jobs.filter(j => j.kind !== "invitation").map(j => invitationsById.get(j.invitation_id)?.volunteer_id).filter(Boolean))];
  let volunteersById = new Map();
  if (volunteerIds.length > 0) {
    const { data: vData, error: vError } = await db.from("submissions").select("id,contact_email,fields,status").in("id", volunteerIds);
    if (vError) throw new Error("Volunteer contacts could not be read.");
    volunteersById = new Map(vData.map(v => [v.id, v]));
  }

  const matchQueries = jobs.filter(j => j.kind !== "invitation").map(j => {
    const i = invitationsById.get(j.invitation_id);
    return i ? `and(need_id.eq.${i.need_id},volunteer_id.eq.${i.volunteer_id})` : null;
  }).filter(Boolean);

  let matchesByNeedAndVol = new Map();
  if (matchQueries.length > 0) {
    const { data: mData, error: mError } = await db.from("matches").select("need_id,volunteer_id,status").or(matchQueries.join(","));
    if (mError) throw new Error("Connections could not be checked.");
    matchesByNeedAndVol = new Map(mData.map(m => [`${m.need_id}:${m.volunteer_id}`, m]));
  }

  const loadMatchingMemo = new Map();

  for (const job of jobs) {
    try {
      const i = invitationsById.get(job.invitation_id);
      if (!i) throw new Error("Invitation could not be read.");

      const need = needsById.get(i.need_id);
      if (!need) throw new Error("Need unavailable.");

      let allowed = need.matching_contact_approved && !!need.contact_email;
      if (job.kind === "invitation") {
        if (!loadMatchingMemo.has(need.id)) {
          loadMatchingMemo.set(need.id, await loadMatching(need));
        }
        const data = loadMatchingMemo.get(need.id)!;
        const role = data.roles.find(r => r.id === i.role_id);
        const context = {...data.context,invitations:data.context.invitations.filter(x => x.id !== i.id)};
        allowed = allowed && ["verified","recruiting"].includes(need.status) && ["queued","sent"].includes(i.status) && Date.parse(i.expires_at)>Date.now()
          && !!role && role.revision === i.role_revision && recommend(role,data.volunteers,context).ready.some(c => c.volunteerId === i.volunteer_id)
          && data.volunteers.find(v => v.id === i.volunteer_id)?.contact_email === job.payload.to;
      } else {
        const v = volunteersById.get(i.volunteer_id);
        if (!v) throw new Error("Volunteer contact could not be checked.");
        const connection = matchesByNeedAndVol.get(`${i.need_id}:${i.volunteer_id}`);
        allowed = allowed && ["verified","recruiting","filled"].includes(need.status) && !!connection && ["verified","recruiting","filled"].includes(connection.status) && i.status === "confirmed" && v.status !== "rejected" && (v.fields.consent === "on" || v.fields.consent === true)
          && job.payload.to === (job.kind === "requester-introduction" ? need.contact_email : v.contact_email);
      }
      if (!allowed) {
        const updated = await db.from("matching_email_outbox").update({status:"cancelled",last_error:"Current eligibility, permission, contact or need status changed."}).eq("id",job.id);
        if (updated.error) throw new Error("Could not cancel stale email.");
        if (job.kind === "invitation") await db.from("matching_invitations").update({status:"cancelled"}).eq("id",i.id).in("status",["queued","sent"]);
        counts.cancelled++; continue;
      }
      const providerId = await sendMatchingEmail(job.id,job.payload);
      const saved = await db.rpc("matching_record_sent",{p_job:job.id,p_provider:providerId});
      if (saved.error) throw new Error("Provider accepted the message; recording the result failed.");
      counts.sent++;
    } catch(e) {
      const message = e instanceof Error ? e.message : "Email processing failed.";
      const terminal = job.attempts >= 5;
      await db.from("matching_email_outbox").update({status:terminal ? "failed" : "pending",last_error:message,locked_until:null,available_at:new Date(Date.now()+Math.min(60,2**job.attempts)*60000).toISOString()}).eq("id",job.id).neq("status","sent");
      counts.failed++;
    }
  }
  return counts;
}
