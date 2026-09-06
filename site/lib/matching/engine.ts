import { skillLabel, validEmail } from "./catalog";
import { legacyFacts } from "./normalize";
import { ENGINE_VERSION, OPEN_NEED_STATUSES, REVIEWED_VOLUNTEER_STATUSES } from "./types";
import type { Check, Context, Recommendation, Role, Submission } from "./types";

const DAY = 86400000;
const check = (key: string, result: Check["result"], reason: string, question?: string): Check => ({ key, result, reason, ...(question ? { question } : {}) });
const compareText = (a: string | null, b: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
function tie(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function comparePriorities(a: Recommendation, b: Recommendation): number {
  for (let i = 0; i < a.priority.length; i++) {
    if (a.priority[i] !== b.priority[i]) return a.priority[i] - b.priority[i];
  }
  return a.volunteerId.localeCompare(b.volunteerId);
}

/** Pure, deterministic, side-effect-free. Unknown facts never satisfy a must-have. */
export function recommend(role: Role, volunteers: Submission[], context: Context) {
  const result: Record<Recommendation["category"], Recommendation[]> = { ready: [], clarify: [], excluded: [] };
  const r = role.config;
  const now = Date.parse(context.now);
  const today = context.now.slice(0, 10);
  const roleInvites = context.invitations.filter(i => i.role_id === role.id);
  const occupied = roleInvites.filter(i => i.status === "confirmed" || (["queued", "sent", "accepted"].includes(i.status) && Date.parse(i.expires_at) > now)).length;

  for (const v of volunteers) {
    if (v.kind !== "volunteer") continue;
    const p = context.profiles.get(v.id);
    const f = p?.facts ?? legacyFacts(v);
    const checks: Check[] = [];
    const add = (key: string, state: Check["result"], reason: string, question?: string) => checks.push(check(key, state, reason, question));
    const fail = (key: string, reason: string) => add(key, "fail", reason);
    const unknown = (key: string, reason: string, question: string) => add(key, "unknown", reason, question);

    if (!role.active || !OPEN_NEED_STATUSES.includes(context.needStatus) || r.endDate < today) fail("need", "This role is closed or its dates have passed.");
    if (occupied >= role.headcount) fail("capacity", "All role slots are committed or awaiting a response.");
    if (v.status === "rejected") fail("review", "Registration was rejected.");
    else if (!REVIEWED_VOLUNTEER_STATUSES.includes(v.status)) unknown("review", "Volunteer review is pending.", "Review this registration before sending an invitation.");
    else add("review", "pass", "Volunteer registration reviewed.");
    if (p?.paused) fail("notifications", "Volunteer has paused matching invitations.");
    if (p?.mission_only && !r.missionIds.some(id => p.mission_ids.includes(id))) fail("scope", "Outside the volunteer's selected mission scope.");
    if (!validEmail(v.contact_email)) unknown("email", "A valid volunteer email is missing.", "Confirm an email address for this volunteer.");
    if (v.fields?.consent !== "on" && v.fields?.consent !== true) unknown("consent", "Coordination consent has not been recorded.", "Record the volunteer's consent to sharing contact details for coordination.");
    if (roleInvites.some(i => i.volunteer_id === v.id)) fail("invitation", "This volunteer has already been approached for this role.");
    if (context.invitations.some(i => i.volunteer_id === v.id && i.role_id !== role.id && ["queued","sent","accepted"].includes(i.status) && Date.parse(i.expires_at) > now)) fail("outstanding", "Volunteer already has an outstanding invitation to another role.");

    for (const skill of r.skills) {
      if (!f.skills) unknown(`skill:${skill}`, `${skillLabel(skill)} has not been confirmed.`, `Can you offer ${skillLabel(skill)} for this role?`);
      else if (f.skills.includes(skill)) add(`skill:${skill}`, "pass", `${skillLabel(skill)} offered.`);
      else if (p) fail(`skill:${skill}`, `${skillLabel(skill)} is outside the confirmed skills offered.`);
      else unknown(`skill:${skill}`, "Only a different primary skill is recorded.", `Do you also offer ${skillLabel(skill)}?`);
    }
    if (r.minExperienceYears !== null) {
      if (f.experienceYears === null) unknown("experience", "Relevant experience is unconfirmed.", `Do you have at least ${r.minExperienceYears} years of relevant experience?`);
      else add("experience", f.experienceYears >= r.minExperienceYears ? "pass" : "fail", `${f.experienceYears} years reported; ${r.minExperienceYears} required.`);
    }
    for (const qualification of r.qualifications) {
      if (p?.verified_qualifications.includes(qualification)) add(`qualification:${qualification}`, "pass", `${qualification} checked by a coordinator.`);
      else unknown(`qualification:${qualification}`, `${qualification} requires verification.`, `Ask a coordinator to verify ${qualification}.`);
    }

    let onsite = r.workMode === "onsite" || r.workMode === "hybrid";
    if (!f.workMode) unknown("mode", "Work preference is missing or ambiguous.", "Can you work remotely, on site, or both for this opportunity?");
    else {
      const fits = r.workMode === "either" || f.workMode === "both" || r.workMode === f.workMode;
      add("mode", fits ? "pass" : "fail", fits ? "Work mode is compatible." : "Work mode conflicts with the volunteer's preference.");
      if (r.workMode === "either") onsite = f.workMode === "onsite";
    }
    if (onsite) {
      if (!r.district) unknown("location", "Role district is missing.", "Confirm the district where the work will happen.");
      else if (compareText(f.district, r.district)) add("travel", "pass", "Volunteer is based in the required district.");
      else if (f.travel === "anywhere" || (f.travel === "districts" && f.travelDistricts.some(d => compareText(d, r.district)))) add("travel", "pass", "Required district is within the travel area; confirm arrival when accepting.");
      else if (f.travel === "local" && f.district) fail("travel", "Volunteer only travels within another district.");
      else if (f.travel === "districts" && f.travelDistricts.length) fail("travel", "Required district is outside the selected travel area.");
      else unknown("travel", "Travel area needs confirmation.", `Can you travel to ${r.district} for these dates?`);
      const days = (Date.parse(r.endDate) - Date.parse(r.startDate)) / DAY + 1;
      if (f.maxDeploymentDays === null) unknown("deployment", "Maximum deployment duration is unknown.", `Can you commit to ${days} days on site?`);
      else add("deployment", f.maxDeploymentDays >= days ? "pass" : "fail", `Role spans ${days} days; maximum deployment is ${f.maxDeploymentDays}.`);
    }

    const fresh = p && Number.isFinite(Date.parse(p.confirmed_at)) && now - Date.parse(p.confirmed_at) <= 30 * DAY && Date.parse(p.confirmed_at) <= now;
    if (!fresh) unknown("freshness", "Availability needs a current confirmation.", "Confirm your current availability for this opportunity.");
    if (!f.availableFrom || !f.availableUntil) unknown("dates", "An available date range has not been confirmed.", `Are you available from ${r.startDate} through ${r.endDate}?`);
    else add("dates", f.availableFrom <= r.startDate && f.availableUntil >= r.endDate ? "pass" : "fail", "Compare the confirmed available dates with the full role period.");
    if (f.hoursPerWeek === null) unknown("hours", "Weekly hours are not confirmed.", `Can you offer ${r.hoursPerWeek} hours per week?`);
    else add("hours", f.hoursPerWeek >= r.hoursPerWeek ? "pass" : "fail", `${f.hoursPerWeek} hours offered; ${r.hoursPerWeek} needed weekly.`);

    const commitments = context.commitments.filter(c => c.volunteerId === v.id);
    if (commitments.some(c => c.needId === role.need_id)) fail("commitment", "Already committed to this need.");
    const other = commitments.filter(c => c.needId !== role.need_id);
    if (other.some(c => !c.startDate || !c.endDate || c.hoursPerWeek === null)) unknown("commitment", "Existing commitment has no confirmed schedule.", "Check existing work with the coordinator before adding this commitment.");
    // Use peak overlap, not the sum of commitments that overlap disjoint weeks.
    const boundaries = [r.startDate, ...other.map(c => c.startDate).filter((d): d is string => !!d && d >= r.startDate && d <= r.endDate)];
    const peak = Math.max(0, ...boundaries.map(date => other.reduce((total, c) => total + (c.startDate && c.endDate && c.startDate <= date && c.endDate >= date ? c.hoursPerWeek ?? 0 : 0), 0)));
    if (f.hoursPerWeek !== null && peak + r.hoursPerWeek > f.hoursPerWeek) fail("capacity-hours", "Existing commitments leave insufficient weekly capacity.");

    const direct = Boolean(v.user_id && context.interestedUserIds.has(v.user_id));
    const mission = Boolean(p && r.missionIds.some(id => p.mission_ids.includes(id)));
    const specialtyMatches = r.preferredSpecialties.filter(tag => f.specialties.includes(tag));
    const previous = context.invitations.filter(i => i.volunteer_id === v.id && i.status !== "cancelled");
    const recent = previous.filter(i => now - Date.parse(i.created_at) < 14 * DAY).length;
    const last = Math.max(0, ...previous.map(i => Date.parse(i.created_at)).filter(Number.isFinite));
    const reasons = [
      ...specialtyMatches.map(tag => `Relevant specialty: ${tag}`),
      ...(direct ? ["Expressed interest in this need"] : mission ? ["Matches a selected mission"] : []),
      ...(r.preferLocal && compareText(f.district, r.district) ? ["Based in the preferred district"] : []),
      `${recent} invitations in the last 14 days`,
    ];
    const category = checks.some(c => c.result === "fail") ? "excluded" : checks.some(c => c.result === "unknown") ? "clarify" : "ready";
    result[category].push({
      volunteerId: v.id, name: v.org_or_name ?? "Unnamed volunteer", category, checks, reasons,
      priority: [-specialtyMatches.length, direct ? 0 : mission ? 1 : 2, r.preferLocal && compareText(f.district, r.district) ? 0 : 1, recent, last, tie(`${role.id}:${role.revision}:${v.id}`)],
      profileRevision: p?.revision ?? 0, engineVersion: ENGINE_VERSION,
    });
  }
  for (const group of Object.values(result)) group.sort(comparePriorities);
  return result;
}
