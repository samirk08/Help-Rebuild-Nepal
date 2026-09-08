"use server";

import { revalidatePath } from "next/cache";

import { N3, TEXT_LIMITS } from "./intake-schema";
import { ownedRequest } from "./requester";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";
import type { ActionState } from "./matching/validation";
import { errorFields, logError } from "./log";

/**
 * What a requester may do to their own request.
 *
 * Two rules run through all of it.
 *
 * OWNERSHIP COMES FROM THE SESSION. `ownedRequest()` finds the row *from* the
 * signed-in user; no action reads a submission id out of the form. An id in a
 * request body is a claim, never an authorisation.
 *
 * EVERY CHANGE IS RECORDED. `request_events` is append-only, so "the requester
 * closed this on Tuesday and reopened it on Thursday" survives, which a status
 * column alone cannot express.
 */

function failure(e: unknown): ActionState {
  return {
    error: e instanceof Error ? e.message : "Could not save that change. Please try again.",
  };
}

function refresh() {
  for (const lang of ["en", "np"]) revalidatePath(`/${lang}/request`);
  revalidatePath("/admin/needs", "layout");
}

async function actorId(): Promise<string | null> {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  return user?.id ?? null;
}

async function record(
  submissionId: string,
  event: string,
  detail: string | null,
  userId: string | null
) {
  const { error } = await supabaseAdmin().from("request_events").insert({
    submission_id: submissionId,
    actor: "requester",
    actor_user_id: userId,
    event,
    detail,
  });
  // Logged, not thrown. A missing audit line is worth knowing about; failing
  // the person's close or update over it would be worse.
  if (error) logError("request_event_insert_failed", errorFields(error));
}

/**
 * Applies a change only if the row has not moved since it was read.
 *
 * `version` is bumped by a trigger on every update, so a coordinator setting a
 * status between the requester loading the page and pressing save makes this
 * match no row. The requester is told to reload rather than having their copy
 * overwrite a decision they never saw.
 */
async function guardedUpdate(
  id: string,
  version: number,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .update(patch)
    .eq("id", id)
    .eq("version", version)
    .select("id")
    .maybeSingle();

  if (error) {
    logError("requester_update_failed", errorFields(error));
    throw new Error("Could not save that change. Please try again.");
  }
  return Boolean(data);
}

const STALE = "This request was updated by a coordinator while you were editing. Reload the page to see the change, then try again.";

/**
 * Correcting the request itself.
 *
 * A material edit — what the work is, where, how soon — cancels outstanding
 * invitations through the trigger in migration 014, because a volunteer who
 * accepted one job must not be confirmed into a different one. The form says
 * so before the person saves.
 */
export async function updateRequest(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owned = await ownedRequest();
    if (!owned) throw new Error("Sign in to manage your request.");

    const version = Number(form.get("version"));
    if (!Number.isInteger(version)) throw new Error(STALE);
    if (version !== owned.version) throw new Error(STALE);

    const title = String(form.get("title") ?? "").trim();
    const detail = String(form.get("detail") ?? "").trim();

    if (title.length < 6 || title.length > TEXT_LIMITS.short) {
      throw new Error("Give a one-line summary of at least 6 characters.");
    }
    if (detail.length < 20 || detail.length > TEXT_LIMITS.long) {
      throw new Error("Describe what needs to happen in at least 20 characters.");
    }

    const { data: current } = await supabaseAdmin()
      .from("submissions")
      .select("fields")
      .eq("id", owned.id)
      .maybeSingle();

    const fields = { ...((current?.fields ?? {}) as Record<string, unknown>) };
    const materialChanged = fields[N3.detail] !== detail;
    fields[N3.title] = title;
    fields[N3.detail] = detail;

    const applied = await guardedUpdate(owned.id, version, { fields });
    if (!applied) throw new Error(STALE);

    const who = await actorId();
    await record(
      owned.id,
      materialChanged ? "request_updated_materially" : "request_updated",
      materialChanged ? "Description changed; outstanding invitations were cancelled for re-review." : "Summary updated.",
      who
    );

    refresh();
    return {
      success: materialChanged
        ? "Saved. Because the description changed, any outstanding invitations were cancelled so a coordinator can re-check them."
        : "Saved.",
    };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Closing and reopening.
 *
 * Closing is `completed`, not `rejected` — the problem was solved, whether by
 * us or otherwise, and marking it rejected would read as though the request
 * was refused. Reopening returns it to `submitted` so a coordinator looks at
 * it again rather than it quietly rejoining the board.
 */
export async function closeRequest(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owned = await ownedRequest();
    if (!owned) throw new Error("Sign in to manage your request.");

    const version = Number(form.get("version"));
    if (version !== owned.version) throw new Error(STALE);

    const reason = String(form.get("reason") ?? "").trim().slice(0, TEXT_LIMITS.line) || null;

    const applied = await guardedUpdate(owned.id, version, { status: "completed" });
    if (!applied) throw new Error(STALE);

    await record(owned.id, "request_closed", reason, await actorId());
    refresh();
    return { success: "Your request is closed. You can reopen it if you need to." };
  } catch (e) {
    return failure(e);
  }
}

export async function reopenRequest(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owned = await ownedRequest();
    if (!owned) throw new Error("Sign in to manage your request.");

    const version = Number(form.get("version"));
    if (version !== owned.version) throw new Error(STALE);

    const applied = await guardedUpdate(owned.id, version, { status: "submitted" });
    if (!applied) throw new Error(STALE);

    await record(owned.id, "request_reopened", null, await actorId());
    refresh();
    return { success: "Reopened. A coordinator will look at it again." };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Whether the help actually arrived and was any use.
 *
 * Recorded as an event rather than a column because it is testimony, not
 * state: it belongs in the history beside who closed the request and when,
 * and there may be more than one of them over the life of a request.
 */
export async function recordOutcome(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owned = await ownedRequest();
    if (!owned) throw new Error("Sign in to manage your request.");

    const met = form.get("met");
    if (met !== "yes" && met !== "partly" && met !== "no") {
      throw new Error("Choose whether the support met the need.");
    }

    const note = String(form.get("note") ?? "").trim().slice(0, TEXT_LIMITS.long) || null;

    await record(owned.id, `outcome_${met}`, note, await actorId());
    refresh();
    return { success: "Thank you — that is recorded and a coordinator will see it." };
  } catch (e) {
    return failure(e);
  }
}

/**
 * The requester's half of a both-party confirmation.
 *
 * Deliberately records the decision rather than completing the connection.
 * `matching_confirm` sends contact details to both sides, and that step stays
 * with a coordinator until the invitation lifecycle work in Phase 4 — a
 * requester pressing a button should not be what puts a volunteer's details in
 * an email.
 */
export async function respondToProposal(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owned = await ownedRequest();
    if (!owned) throw new Error("Sign in to manage your request.");

    const decision = form.get("decision");
    if (decision !== "confirm" && decision !== "decline") {
      throw new Error("Choose whether to go ahead with this volunteer.");
    }

    const note = String(form.get("note") ?? "").trim().slice(0, TEXT_LIMITS.line) || null;

    await record(
      owned.id,
      decision === "confirm" ? "proposal_confirmed" : "proposal_declined",
      note,
      await actorId()
    );

    refresh();
    return {
      success:
        decision === "confirm"
          ? "Recorded. Your coordinator will confirm the arrangement with both sides."
          : "Recorded. Your coordinator will look for someone else.",
    };
  } catch (e) {
    return failure(e);
  }
}
