"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase";
import { supabaseServerClient } from "../supabase-server";
import { getMatchingProfile, getNeed, loadMatching } from "./data";
import { cleanTags } from "./catalog";
import { recommend } from "./engine";
import { emailConfigured, invitationEmail } from "./email";
import { anonymousParty, introductionMail, langOf, mailPath, otherPartyLabel } from "../mail-copy";
import { idFrom, parseFacts, parseRole, textFrom } from "./validation";
import type { ActionState } from "./validation";
import type { Role, Submission } from "./types";

async function actor(adminRequired: boolean) {
  const { data: { user } } = await (await supabaseServerClient()).auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await supabaseAdmin().from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
  const admin = !error && !!data;
  if (adminRequired && !admin) throw new Error("Coordinator access is required.");
  return { id:user.id, admin };
}
function failure(e: unknown): ActionState {
  return { error: e instanceof Error ? e.message : "Could not save this change. Please refresh and try again." };
}
function refresh(needId?: string, volunteerId?: string) {
  revalidatePath("/admin/needs", "layout");
  if (needId) revalidatePath(`/admin/needs/${needId}`);
  if (volunteerId) revalidatePath(`/admin/volunteers/${volunteerId}`);
  revalidatePath("/en/profile"); revalidatePath("/np/profile");
  revalidatePath("/en/needs", "layout"); revalidatePath("/np/needs", "layout");
  revalidatePath("/en/tracker"); revalidatePath("/np/tracker");
}
export async function saveMatchingProfile(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor(false);
    const id = idFrom(form,"volunteerId");
    const db = supabaseAdmin();
    const { data: volunteer, error } = await db.from("submissions").select("*").eq("id",id).eq("kind","volunteer").single();
    if (error || !volunteer || (!who.admin && volunteer.user_id !== who.id)) throw new Error("This profile is unavailable.");
    const { profile, available } = await getMatchingProfile(id);
    if (!available) throw new Error("Apply migration 010 before saving matching details.");
    const revision = Number(form.get("revision"));
    if (revision !== (profile?.revision ?? 0)) throw new Error("This profile changed. Refresh before saving.");
    if (form.get("confirmFacts") !== "on") throw new Error("Confirm that these details were provided by the volunteer.");
    const patch = {
      volunteer_id:id, facts:parseFacts(form), paused:form.get("paused") === "on",
      confirmed_at:new Date().toISOString(), updated_by:who.id,
      ...(who.admin ? { verified_qualifications:cleanTags(textFrom(form,"verifiedQualifications",1000)) } : {}),
    };
    const query = profile ? db.from("matching_profiles").update(patch).eq("volunteer_id",id).eq("revision",revision)
      : db.from("matching_profiles").insert(patch);
    const saved = await query.select("volunteer_id").maybeSingle();
    if (saved.error || !saved.data) throw new Error("The profile changed or could not be saved. Refresh and try again.");
    refresh(undefined,id);
    return { success:"Matching details saved. Recommendations will use these answers." };
  } catch(e) { return failure(e); }
}

export async function saveMatchingRole(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor(true);
    const needId = idFrom(form,"needId");
    await getNeed(needId);
    const db = supabaseAdmin();
    const roleId = form.get("roleId") ? idFrom(form,"roleId") : null;
    let existing: Role | null = null;
    if (roleId) {
      const { data, error } = await db.from("matching_roles").select("*").eq("id",roleId).eq("need_id",needId).single();
      if (error || !data) throw new Error("Role unavailable.");
      existing = data;
      if (existing!.revision !== Number(form.get("revision"))) throw new Error("This role changed. Refresh before saving.");
    }
    const parsed = parseRole(form, existing?.config.missionIds ?? []);
    const approved = form.get("contactApproved") === "on";
    if (approved && !parsed.requesterEmail) throw new Error("Confirm the requester email before approving contact sharing.");
    const patch = { need_id:needId,title:parsed.title,headcount:parsed.headcount,config:parsed.config,active:form.get("active") === "on",updated_by:who.id };
    const query = existing ? db.from("matching_roles").update(patch).eq("id",roleId!).eq("revision",existing.revision) : db.from("matching_roles").insert(patch);
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data) throw new Error("Role could not be saved. Refresh and try again.");
    const contact = await db.from("submissions").update({ contact_email:parsed.requesterEmail || null, matching_contact_approved:approved }).eq("id",needId).eq("kind","need");
    if (contact.error) throw new Error("Role saved; requester contact could not be saved. Please retry.");
    refresh(needId);
    return { success:"Role saved. Recommendations use its latest requirements." };
  } catch(e) { return failure(e); }
}

export async function queueMatchingInvitation(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor(true);
    if (!emailConfigured()) throw new Error("Email delivery is not configured. Set up the matching email settings before inviting volunteers.");
    const needId = idFrom(form,"needId"), roleId = idFrom(form,"roleId"), volunteerId = idFrom(form,"volunteerId");
    const need = await getNeed(needId);
    if (!need.matching_contact_approved) throw new Error("Confirm the requester's permission to share their contact.");
    const data = await loadMatching(need);
    const entry = data.recommendations.find(x => x.role.id === roleId);
    const candidate = entry?.result.ready.find(x => x.volunteerId === volunteerId);
    if (!entry || !candidate) throw new Error("This candidate is no longer ready. Refresh the recommendations.");
    const v = data.volunteers.find(x => x.id === volunteerId)!;
    const token = randomBytes(32).toString("hex");
    const site = new URL(process.env.MATCHING_SITE_URL!);
    if (site.protocol !== "https:" && site.hostname !== "localhost") throw new Error("The invitation site must use HTTPS.");
    // The message is English; the link lands on the page in the language they
    // registered in, because that page exists in both and sending them to the
    // English one would discard a translation that is already there.
    const url = new URL(mailPath(langOf(v), `/opportunities/${token}`),site).href;
    const payload = invitationEmail(entry.role,candidate,v.contact_email!,need.contact_email!,url);
    const { error } = await supabaseAdmin().rpc("matching_queue_invitation", {
      p_role:roleId,p_volunteer:volunteerId,p_role_revision:entry.role.revision,p_profile_revision:candidate.profileRevision,
      p_token_hash:createHash("sha256").update(token).digest("hex"),p_snapshot:candidate,p_email:payload,p_actor:who.id,
    });
    if (error) throw new Error(error.message);
    refresh(needId);
    return { success:"Invitation queued. Delivery status appears below." };
  } catch(e) { return failure(e); }
}

export async function confirmMatchingConnection(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor(true);
    const invitationId = idFrom(form,"invitationId");
    if (form.get("bothAgreed") !== "on") throw new Error("Confirm that both parties agreed to work together.");
    const db = supabaseAdmin();
    const { data: invite, error } = await db.from("matching_invitations").select("*").eq("id",invitationId).single();
    if (error || !invite) throw new Error("Invitation unavailable.");
    const need = await getNeed(invite.need_id);
    const data = await loadMatching(need);
    const role = data.roles.find(x => x.id === invite.role_id);
    if (!role) throw new Error("Role unavailable.");
    // Remove this invitation's own hold while rechecking all other constraints.
    const context = { ...data.context, invitations:data.context.invitations.filter(i => i.id !== invite.id) };
    const candidate = recommend(role,data.volunteers,context).ready.find(x => x.volunteerId === invite.volunteer_id);
    if (!candidate) throw new Error("Current details need review before this connection can be confirmed.");
    if (!need.matching_contact_approved || !need.contact_email) throw new Error("Requester contact sharing needs confirmation.");
    const v = data.volunteers.find(x => x.id === invite.volunteer_id)!;
    // Each side is written in its own language: a volunteer who registered in
    // Nepali and a requester who registered in English are the ordinary case,
    // and one shared body would have to be wrong for one of them.
    // An introduction with no address on one side is half a message. Only the
    // requester's was checked before; the volunteer's went into a template
    // string, where a missing one would have read as the literal "null".
    if (!v.contact_email) throw new Error("This volunteer has no email address on file.");
    const vLang = langOf(v);
    const rLang = langOf(need);
    const shared = {
      roleTitle:role.title, startDate:role.config.startDate,
      endDate:role.config.endDate, hoursPerWeek:role.config.hoursPerWeek,
    };
    const result = await db.rpc("matching_confirm", {
      p_invitation:invite.id,p_profile_revision:candidate.profileRevision,p_actor:who.id,
      p_volunteer_email:{
        ...introductionMail({
          ...shared,
          otherPartyLabel:otherPartyLabel("requester"),
          otherPartyName:need.org_or_name ?? anonymousParty("requester"),
          otherPartyEmail:need.contact_email,
        }),
        to:v.contact_email,
      },
      p_requester_email:{
        ...introductionMail({
          ...shared,
          otherPartyLabel:otherPartyLabel("volunteer"),
          otherPartyName:v.org_or_name ?? anonymousParty("volunteer"),
          otherPartyEmail:v.contact_email,
        }),
        to:need.contact_email,
      },
    });
    if (result.error) throw new Error(result.error.message);
    refresh(need.id,v.id);
    return { success:"Connection confirmed. Introduction emails queued for both parties." };
  } catch(e) { return failure(e); }
}

export async function cancelMatchingInvitation(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await actor(true);
    const id = idFrom(form,"invitationId");
    const { data, error } = await supabaseAdmin().from("matching_invitations").update({ status:"cancelled" }).eq("id",id).in("status",["queued","sent","accepted"]).select("need_id").maybeSingle();
    if (error || !data) throw new Error("This invitation can no longer be cancelled.");
    refresh(data.need_id);
    return { success:"Invitation cancelled. The role slot is available again." };
  } catch(e) { return failure(e); }
}

export async function finishMatchingConnection(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await actor(true);
    const id=idFrom(form,"invitationId"),outcome=textFrom(form,"outcome",20);
    const {data,error}=await supabaseAdmin().rpc("matching_finish",{p_invitation:id,p_outcome:outcome});
    if (error) throw new Error(error.message);
    refresh(data);
    return {success:outcome==="completed" ? "Work completed. Weekly availability released." : "Withdrawal recorded. The place and weekly availability are free again."};
  } catch(e) { return failure(e); }
}

export async function respondToMatchingInvitation(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const token = textFrom(form,"token",64);
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invitation unavailable.");
    const response = textFrom(form,"response",10);
    if (!["accepted","declined"].includes(response)) throw new Error("Choose Proceed or Decline.");
    if (response === "accepted" && form.get("confirmAvailability") !== "on") throw new Error("Confirm the dates, commitment and any required travel before proceeding.");
    const { data, error } = await supabaseAdmin().rpc("matching_respond", { p_token_hash:createHash("sha256").update(token).digest("hex"),p_response:response,p_pause:form.get("pause") === "on" });
    if (error) throw new Error("This invitation is no longer available. Please contact the coordination team.");
    revalidatePath("/admin/needs", "layout");
    return { success:data === "accepted" ? "Interest recorded. The coordination team will confirm the connection with both parties." : "Response recorded. Thank you for letting us know." };
  } catch(e) { return failure(e); }
}
