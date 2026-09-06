import MatchingActionForm from "./MatchingActionForm";
import { saveMatchingRole } from "@/lib/matching/actions";
import { isoDate, SKILLS, skillId, textList } from "@/lib/matching/catalog";
import type { Role, Submission } from "@/lib/matching/types";

export default function MatchingRoleEditor({ need, role }: { need:Submission & {matching_contact_approved?:boolean}; role?:Role }) {
  const c = role?.config;
  const skills = c?.skills ?? textList(need.fields["s03-skills-required"]).flatMap(label => skillId(label) ?? []);
  return <details className="matching-editor" open={!role}>
    <summary>{role ? `Edit ${role.title}` : "Add a role to this need"}</summary>
    <p>Separate roles when different people need different skills. Every checked skill below is required for this role. Editing a role cancels its outstanding invitations.</p>
    <MatchingActionForm action={saveMatchingRole} label={role ? "Save role" : "Add role"}>
      <input type="hidden" name="needId" value={need.id}/>
      {role ? <><input type="hidden" name="roleId" value={role.id}/><input type="hidden" name="revision" value={role.revision}/></> : null}
      <div className="matching-grid">
        <label>Role title<input name="title" required maxLength={160} placeholder="e.g. Remote housing engineer" defaultValue={role?.title}/></label>
        <label>People needed for this role<input name="headcount" type="number" min={1} max={1000} required defaultValue={role?.headcount ?? 1}/></label>
      </div>
      <fieldset className="matching-skills"><legend>Required skills</legend>{SKILLS.map(([id,label]) => <label key={id}><input type="checkbox" name="skills" value={id} defaultChecked={skills.includes(id)}/>{label}</label>)}</fieldset>
      <div className="matching-grid">
        <label>Work mode<select name="workMode" required defaultValue={c?.workMode ?? ""}><option value="">Choose…</option><option value="remote">Remote</option><option value="onsite">On-site</option><option value="either">Either remote or on-site</option><option value="hybrid">Both remote and on-site required</option></select></label>
        <label>District (required if on-site work is possible)<input name="district" maxLength={100} defaultValue={c?.district ?? need.district ?? ""}/></label>
        <label>Start date<input name="startDate" type="date" required defaultValue={c?.startDate ?? isoDate(need.fields["s05-start-date"]) ?? ""}/></label>
        <label>End date<input name="endDate" type="date" required defaultValue={c?.endDate ?? isoDate(need.fields["s05-deadline"]) ?? ""}/></label>
        <label>Hours per week<input name="hoursPerWeek" type="number" min={1} max={168} required defaultValue={c?.hoursPerWeek}/></label>
        <label>Minimum relevant years (optional)<input name="minExperienceYears" type="number" min={1} max={80} defaultValue={c?.minExperienceYears ?? ""}/></label>
        <label>Required qualifications (comma separated)<input name="qualifications" maxLength={1000} defaultValue={c?.qualifications.join(", ")}/></label>
        <label>Preferred specialties (comma separated)<input name="preferredSpecialties" maxLength={1000} defaultValue={c?.preferredSpecialties.join(", ")} placeholder="damage assessment, housing design"/></label>
        <label>Confirmed requester email<input name="requesterEmail" type="email" maxLength={254} defaultValue={need.contact_email ?? ""}/></label>
      </div>
      <label className="matching-check"><input type="checkbox" name="preferLocal" defaultChecked={c?.preferLocal ?? false}/>Prefer local volunteers among otherwise suitable candidates</label>
      <label className="matching-check"><input type="checkbox" name="contactApproved" defaultChecked={need.matching_contact_approved ?? false}/>Requester permits sharing this email with invited volunteers</label>
      <label className="matching-check"><input type="checkbox" name="active" defaultChecked={role?.active ?? true}/>Role is active</label>
    </MatchingActionForm>
  </details>;
}
