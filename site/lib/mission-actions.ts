"use server";

import { revalidatePath } from "next/cache";

import { MAX_MISSIONS, type MissionSource } from "./missions";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";
import type { ActionState } from "./matching/validation";
import { errorFields, logError } from "./log";

/**
 * Joining, leaving and scoping mission teams.
 *
 * Every action here answers "who is asking?" from the session cookie and then
 * proves the registration belongs to them. A volunteer id in the form is a
 * *claim*, never an authorisation — the same rule the upload and claim routes
 * follow, and the reason a coordinator's own id cannot be swapped in from the
 * browser.
 *
 * Joining a mission grants nothing beyond membership. It does not confer
 * coordinator access, does not verify a skill, and does not by itself change
 * who gets invited to what — only the explicit `mission_only` switch narrows
 * matching scope.
 */

function failure(e: unknown): ActionState {
  return {
    error: e instanceof Error ? e.message : "Could not save this change. Please try again.",
  };
}

function refresh() {
  for (const lang of ["en", "np"]) {
    revalidatePath(`/${lang}/missions`, "layout");
    revalidatePath(`/${lang}/profile`);
  }
}

async function signedInUser() {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  return user;
}

/** Whether this account is on the coordinator allowlist. */
async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

/**
 * The registration this person may act on.
 *
 * A coordinator may act for a named volunteer — that is what recording an
 * email reply is — but only when they are actually a coordinator, and the
 * source is recorded so the entry is never mistaken for the volunteer's own
 * click.
 */
async function targetVolunteer(form: FormData, userId: string): Promise<{ id: string; onBehalf: boolean }> {
  const requested = form.get("volunteerId");

  const { data: own } = await supabaseAdmin()
    .from("submissions")
    .select("id")
    .eq("kind", "volunteer")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (typeof requested !== "string" || requested === "" || requested === own?.id) {
    if (!own) throw new Error("Register as a volunteer before choosing a mission.");
    return { id: own.id, onBehalf: false };
  }

  if (!(await isAdmin(userId))) throw new Error("This registration is not yours.");

  const { data: other } = await supabaseAdmin()
    .from("submissions")
    .select("id")
    .eq("kind", "volunteer")
    .eq("id", requested)
    .maybeSingle();

  if (!other) throw new Error("No volunteer registration with that id.");
  return { id: other.id, onBehalf: true };
}

function missionIdFrom(form: FormData): string {
  const id = form.get("missionId");
  if (typeof id !== "string" || !/^[a-z0-9-]{1,40}$/.test(id)) {
    throw new Error("No mission with that name.");
  }
  return id;
}

export async function joinMission(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await signedInUser();
    const { id: volunteerId, onBehalf } = await targetVolunteer(form, user.id);
    const missionId = missionIdFrom(form);

    const requested = form.get("source");
    const source: MissionSource = onBehalf
      ? requested === "email_reply"
        ? "email_reply"
        : "admin_recorded"
      : "self_selected";

    const { error } = await supabaseAdmin().from("mission_members").insert({
      volunteer_id: volunteerId,
      mission_id: missionId,
      source,
      recorded_by: user.id,
    });

    if (error) {
      // The cap is a trigger, so this is the database refusing rather than a
      // count the browser could have been wrong about.
      if (/at most two missions/i.test(error.message)) {
        throw new Error(`You can choose up to ${MAX_MISSIONS} missions. Leave one first.`);
      }
      if (error.code === "23505") return { success: "You are already part of this mission." };
      if (error.code === "23503") throw new Error("No mission with that name.");
      logError("joinmission_failed", errorFields(error));
      throw new Error("Could not join this mission. Please try again.");
    }

    refresh();
    return { success: "You have joined this mission." };
  } catch (e) {
    return failure(e);
  }
}

export async function leaveMission(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await signedInUser();
    const { id: volunteerId } = await targetVolunteer(form, user.id);
    const missionId = missionIdFrom(form);

    const { error } = await supabaseAdmin()
      .from("mission_members")
      .delete()
      .eq("volunteer_id", volunteerId)
      .eq("mission_id", missionId);

    if (error) {
      logError("leavemission_failed", errorFields(error));
      throw new Error("Could not leave this mission. Please try again.");
    }

    refresh();
    return { success: "You have left this mission." };
  } catch (e) {
    return failure(e);
  }
}

/**
 * The one control that actually changes who gets invited to what.
 *
 * Off by default and reversible in one click. Turning it on says "only invite
 * me to needs inside my missions"; turning it off puts the person back in the
 * wider pool without touching which missions they are in.
 */
export async function setMissionOnly(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await signedInUser();
    const { id: volunteerId } = await targetVolunteer(form, user.id);
    const only = form.get("missionOnly") === "on";

    const { data: memberships } = await supabaseAdmin()
      .from("mission_members")
      .select("mission_id")
      .eq("volunteer_id", volunteerId);

    if (only && (memberships ?? []).length === 0) {
      throw new Error("Choose at least one mission before limiting invitations to it.");
    }

    const { error } = await supabaseAdmin()
      .from("mission_members")
      .update({
        preference_state: only ? "mission_only" : "interested",
        updated_at: new Date().toISOString(),
      })
      .eq("volunteer_id", volunteerId);

    if (error) {
      logError("setmissiononly_failed", errorFields(error));
      throw new Error("Could not save that preference. Please try again.");
    }

    refresh();
    return {
      success: only
        ? "You will only be invited to needs within your missions."
        : "You are back in the wider pool of opportunities.",
    };
  } catch (e) {
    return failure(e);
  }
}
