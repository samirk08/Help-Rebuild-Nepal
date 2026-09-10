import Link from "next/link";
import MatchingActionForm from "./MatchingActionForm";
import MatchingRoleEditor from "./MatchingRoleEditor";
import { cancelMatchingInvitation, confirmMatchingConnection, finishMatchingConnection, queueMatchingInvitation } from "@/lib/matching/actions";
import { loadMatching, missingMigration } from "@/lib/matching/data";
import { emailConfigured } from "@/lib/matching/email";
import type { Recommendation, Submission } from "@/lib/matching/types";
import { isClosedNeed } from "@/lib/publication";
import { supabaseAdmin } from "@/lib/supabase";

export default async function MatchingPanel({ need }: {need:Submission & {matching_contact_approved?:boolean}}) {
  let data;
  try { data = await loadMatching(need); }
  catch(e) { return <section className="matching-panel"><h2>Matching recommendations</h2><p role="status">{missingMigration(e) ? "Matching is ready to set up. Apply supabase/010-matching-engine.sql to enable role requirements, recommendations and invitations." : "Recommendations could not be loaded. Refresh and try again."}</p></section>; }
  const invitations = data.context.invitations.filter(i => i.need_id === need.id);
  const { data: emails } = invitations.length ? await supabaseAdmin().from("matching_email_outbox").select("invitation_id,kind,status,delivery_status,last_error").in("invitation_id",invitations.map(i => i.id)) : {data:[]};
  const { data: connections } = await supabaseAdmin().from("matches").select("volunteer_id,status").eq("need_id",need.id);
  // A completed or rejected need recruits nobody. The database already refuses
  // an invitation for one (matching_queue_invitation), and 020 deactivates its
  // roles — but a refusal arrives as a raw error after the click, which is not
  // the same thing as not asking. Candidate lists, the invite action and both
  // role forms come off the page; the invitation history below stays, because
  // that is the record of who actually did the work.
  //
  // Narrower than "not open" on purpose: a need still under review is not open
  // either, and preparing its roles ahead of verification is the intended way to
  // use this panel.
  const closed = isClosedNeed(need.status);
  return <section className="matching-panel" id="matching">
    <h2>Matching recommendations</h2>
    <p>Rules check each role against the volunteer&apos;s skills, availability and preferences. Unknown answers stay visible. Mission preferences are optional and can be added later.</p>
    {closed ? <p className="matching-notice">This need is {need.status}, so it is no longer recruiting. Its roles have been deactivated and no further invitations can be sent. Change the status above to recruit again.</p> : null}
    {!closed && !emailConfigured() ? <p className="matching-notice">Email is not configured yet. You can prepare roles, review candidates and confirm their details now.</p> : null}
    {closed ? null : <p className="matching-meta">{data.volunteers.length} volunteer records checked · {data.roles.filter(r => r.active).reduce((n,r) => n+r.headcount,0)} places across active roles · Recomputed from current details when this page loads</p>}
    {data.recommendations.map(({role,result}) => <article className="matching-role" key={`${role.id}:${role.revision}`}>
      <h3>{role.title} <span className="matching-meta">{role.headcount} needed{!role.active ? (closed ? " · Closed with the need" : " · Paused") : ""}</span></h3>
      <p>{role.config.startDate} – {role.config.endDate} · {role.config.hoursPerWeek} hours/week · {role.config.workMode}</p>
      {closed ? null : <MatchingRoleEditor need={need} role={role}/>}
      {closed ? null : (["ready","clarify","excluded"] as const).map(category => <details key={category} className="matching-group" open={category === "ready"}>
        <summary>{category === "ready" ? "Ready for invitation" : category === "clarify" ? "Needs confirmation" : "Not currently suitable"} ({result[category].length})</summary>
        {!result[category].length ? <p>No volunteers in this group.</p> : result[category].map((candidate:Recommendation) => <div className="matching-candidate" key={candidate.volunteerId}>
          <h4><Link href={`/admin/volunteers/${candidate.volunteerId}#matching-profile`}>{candidate.name}</Link></h4>
          <ul>{candidate.checks.filter(c => category === "ready" || c.result !== "pass").map(c => <li key={c.key}><span className={`matching-result matching-result--${c.result}`}>{c.result === "unknown" ? "Confirm" : c.result === "fail" ? "Conflict" : "Meets"}</span>{c.reason}{c.question ? <p className="matching-question">{c.question}</p> : null}</li>)}</ul>
          {category === "ready" ? <>
            <p className="matching-meta">{candidate.reasons.join(" · ")}</p>
            <details><summary>Preview invitation</summary><p>Invitation to {role.title}, from {role.config.startDate} to {role.config.endDate}, {role.config.hoursPerWeek} hours weekly. Includes the matching reasons above, the approved requester email, and a private Proceed / Decline page.</p></details>
            {emailConfigured() && need.matching_contact_approved ? <MatchingActionForm action={queueMatchingInvitation} label="Invite volunteer"><input type="hidden" name="needId" value={need.id}/><input type="hidden" name="roleId" value={role.id}/><input type="hidden" name="volunteerId" value={candidate.volunteerId}/></MatchingActionForm> : <p className="matching-meta">Invitation requires configured email delivery and requester contact permission.</p>}
          </> : null}
        </div>)}
      </details>)}
    </article>)}
    {closed ? null : <MatchingRoleEditor need={need}/>}
    <h3>Invitations and connections</h3>
    {!invitations.length ? <p>No invitations yet. Recommendations are not counted as commitments.</p> : invitations.map(invite => <div className="matching-candidate" key={invite.id}>
      <h4>{data.volunteers.find(v => v.id === invite.volunteer_id)?.org_or_name ?? "Volunteer"} · {data.roles.find(r => r.id === invite.role_id)?.title}</h4>
      <p>Status: <strong>{invite.status}</strong> · Response deadline: {new Date(invite.expires_at).toLocaleString("en-GB",{timeZone:"Asia/Kathmandu"})} Nepal time</p>
      {(emails ?? []).filter(e => e.invitation_id === invite.id).map(e => <p className="matching-meta" key={e.kind}>{e.kind}: {e.status === "sent" ? "Accepted by email provider" : e.status}{e.delivery_status ? ` · ${e.delivery_status.replace("email.","")}` : ""}{e.last_error ? ` — ${e.last_error}` : ""}</p>)}
      {invite.status === "confirmed" ? <p>Work: {connections?.find(c => c.volunteer_id === invite.volunteer_id)?.status === "completed" ? "Completed" : "Active"}</p> : null}
      {invite.status === "accepted" ? <MatchingActionForm action={confirmMatchingConnection} label="Confirm connection"><input type="hidden" name="invitationId" value={invite.id}/><label className="matching-check"><input type="checkbox" name="bothAgreed" required/>Both parties have agreed to the work and dates</label></MatchingActionForm> : null}
      {["queued","sent","accepted"].includes(invite.status) ? <MatchingActionForm action={cancelMatchingInvitation} label="Cancel invitation"><input type="hidden" name="invitationId" value={invite.id}/></MatchingActionForm> : null}
      {invite.status === "confirmed" && connections?.some(c => c.volunteer_id===invite.volunteer_id && ["verified","recruiting","filled"].includes(c.status)) ? <>
        <MatchingActionForm action={finishMatchingConnection} label="Mark work completed"><input type="hidden" name="invitationId" value={invite.id}/><input type="hidden" name="outcome" value="completed"/></MatchingActionForm>
        <MatchingActionForm action={finishMatchingConnection} label="Record withdrawal"><input type="hidden" name="invitationId" value={invite.id}/><input type="hidden" name="outcome" value="withdrawn"/></MatchingActionForm>
      </> : null}
    </div>)}
  </section>;
}
