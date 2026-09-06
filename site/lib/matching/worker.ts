import { supabaseAdmin } from "../supabase";
import { getNeed, loadMatching } from "./data";
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
  for (const job of (data ?? []) as Outbox[]) {
    try {
      const {data:i,error:readError} = await db.from("matching_invitations").select("*").eq("id",job.invitation_id).single();
      if (readError) throw new Error("Invitation could not be read.");
      const need = await getNeed(i.need_id);
      let allowed = need.matching_contact_approved && !!need.contact_email;
      if (job.kind === "invitation") {
        const data = await loadMatching(need);
        const role = data.roles.find(r => r.id === i.role_id);
        const context = {...data.context,invitations:data.context.invitations.filter(x => x.id !== i.id)};
        allowed = allowed && ["verified","recruiting"].includes(need.status) && ["queued","sent"].includes(i.status) && Date.parse(i.expires_at)>Date.now()
          && !!role && role.revision === i.role_revision && recommend(role,data.volunteers,context).ready.some(c => c.volunteerId === i.volunteer_id)
          && data.volunteers.find(v => v.id === i.volunteer_id)?.contact_email === job.payload.to;
      } else {
        const {data:v,error:vError} = await db.from("submissions").select("contact_email,fields,status").eq("id",i.volunteer_id).single();
        if (vError) throw new Error("Volunteer contact could not be checked.");
        const {data:connection,error:cError}=await db.from("matches").select("status").eq("need_id",i.need_id).eq("volunteer_id",i.volunteer_id).maybeSingle();
        if (cError) throw new Error("Connection could not be checked.");
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
