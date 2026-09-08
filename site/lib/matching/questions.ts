"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { clarificationMail, langOf, mailPath } from "../mail-copy";
import { supabaseAdmin } from "../supabase";
import { supabaseServerClient } from "../supabase-server";
import { idFrom, textFrom } from "./validation";
import type { ActionState } from "./validation";
import { errorFields, logError } from "../log";

/**
 * Asking a volunteer the question the engine could not answer for itself.
 *
 * `recommend()` already returns a `question` on every `unknown` check — "Can
 * you offer structural engineering for this role?", "Are you available from 10
 * through 23 September?". Until now a coordinator read it on screen, retyped it
 * into an email by hand, and the reply never came back into the system.
 *
 * Two rules hold here, both inherited rather than invented:
 *
 * NOTHING SENDS MAIL OUTSIDE THE OUTBOX. A question is queued in
 * `matching_email_outbox` like everything else, so the same gating, the same
 * idempotent retries and the same lease apply. That invariant is the only
 * reason no message in this system has ever been double-sent.
 *
 * A GET NEVER RECORDS AN ANSWER. Answering goes through a POST server action
 * into `matching_answer_question`, exactly as invitation responses go through
 * `matching_respond`. A link prefetcher must not be able to answer on someone's
 * behalf.
 */

function failure(e: unknown): ActionState {
  return { error: e instanceof Error ? e.message : "Could not save that. Please try again." };
}

async function coordinator() {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  // Server actions are POST endpoints reachable independently of the page that
  // renders them, so the admin check is repeated here rather than relying on
  // middleware having gated /admin.
  if (error || !data) throw new Error("Coordinator access is required.");
  return user.id;
}

export async function askClarification(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const asker = await coordinator();
    const volunteerId = idFrom(form, "volunteerId");
    const checkKey = textFrom(form, "checkKey", 80);
    const question = textFrom(form, "question", 1000);
    const roleRaw = form.get("roleId");
    const roleId = typeof roleRaw === "string" && roleRaw !== "" ? roleRaw : null;

    if (!checkKey) throw new Error("A question must name the check it is about.");
    if (question.trim().length < 10) throw new Error("Write the question out in full.");

    const { data: volunteer } = await supabaseAdmin()
      .from("submissions")
      .select("id, contact_email, lang")
      .eq("id", volunteerId)
      .eq("kind", "volunteer")
      .maybeSingle();

    if (!volunteer) throw new Error("That volunteer registration is unavailable.");
    if (!volunteer.contact_email) {
      throw new Error("This volunteer has no email address on file, so a question cannot be sent.");
    }

    // Raw token to the volunteer, hash at rest — the same shape as invitation
    // tokens, so a database leak does not hand anyone the ability to answer.
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const { data: created, error } = await supabaseAdmin()
      .from("matching_questions")
      .insert({
        volunteer_id: volunteerId,
        role_id: roleId,
        check_key: checkKey,
        question: question.trim(),
        asked_by: asker,
        token_hash: tokenHash,
      })
      .select("id")
      .single();

    if (error) {
      // The partial unique index in migration 017: one open question per check.
      if (error.code === "23505") {
        throw new Error("That question is already outstanding with this volunteer.");
      }
      logError("askclarification_insert_failed", errorFields(error));
      throw new Error("Could not record the question. Please try again.");
    }

    // English, like every message this platform sends. The link lands on the
    // answer page in the language they registered in, which is a real page in
    // both.
    const site = process.env.MATCHING_SITE_URL ?? "";
    const payload = {
      ...clarificationMail(question.trim(), `${site}${mailPath(langOf(volunteer), `/questions/${token}`)}`),
      to: volunteer.contact_email,
    };

    const queued = await supabaseAdmin()
      .from("matching_email_outbox")
      .insert({ question_id: created.id, kind: "clarification", payload });

    if (queued.error) {
      // The question exists but nobody will ever see it, which is worse than
      // not having asked. Withdraw it so the Situation Room does not show a
      // job that cannot be completed.
      await supabaseAdmin()
        .from("matching_questions")
        .update({ state: "withdrawn" })
        .eq("id", created.id);
      logError("clarification_outbox_insert_failed", errorFields(queued.error));
      throw new Error("Could not queue the email. The question was not asked.");
    }

    revalidatePath("/admin/needs", "layout");
    revalidatePath("/admin/situation");
    return { success: "Question queued. It will be sent with the next worker run." };
  } catch (e) {
    return failure(e);
  }
}

export async function withdrawClarification(
  _state: ActionState,
  form: FormData
): Promise<ActionState> {
  try {
    await coordinator();
    const id = idFrom(form, "questionId");

    const { error } = await supabaseAdmin()
      .from("matching_questions")
      .update({ state: "withdrawn" })
      .eq("id", id)
      .eq("state", "open");

    if (error) throw new Error("Could not withdraw the question.");

    revalidatePath("/admin/situation");
    return { success: "Question withdrawn." };
  } catch (e) {
    return failure(e);
  }
}

/**
 * The volunteer's answer. POST only, and idempotent — a retried submit returns
 * the answer already recorded rather than replacing it.
 *
 * Deliberately does not touch `matching_profiles.facts`. A sentence typed into
 * a form is not the same evidence as a volunteer confirming their own profile,
 * and preserving that difference is a stated product decision, not a detail. A
 * coordinator reads the answer and updates the profile through the existing
 * editor, where it is recorded as a confirmed fact with a date behind it.
 */
export async function answerClarification(
  _state: ActionState,
  form: FormData
): Promise<ActionState> {
  try {
    const token = textFrom(form, "token", 64);
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("This question is no longer available.");

    const answer = textFrom(form, "answer", 4000);
    if (answer.trim().length === 0) throw new Error("Please write an answer.");

    const { error } = await supabaseAdmin().rpc("matching_answer_question", {
      p_token_hash: createHash("sha256").update(token).digest("hex"),
      p_answer: answer,
    });

    if (error) throw new Error("This question is no longer available.");

    revalidatePath("/admin/situation");
    return { success: "Thank you — your answer has been passed to the coordination team." };
  } catch (e) {
    return failure(e);
  }
}
