"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";

/**
 * The project workspace.
 *
 * A project used to be four columns — which need it came from, a stage, a
 * coordinator's name, a date — which is enough to put a card on a page and
 * nothing else. Migration 019 gives it a task list, updates, output links and
 * an outcome; this file is how a coordinator writes them.
 *
 * The rule worth stating up front: `stage = 'completed'` is refused by the
 * database unless an outcome record exists. Nothing here needs to check that,
 * and nothing here should — the value of putting it in the schema is that
 * every path is covered, including the ones written after this file.
 */

async function requireAdmin(): Promise<string> {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  if (!user || !(await isAdmin(user.id))) redirect("/admin/login");
  return user.id;
}

function text(form: FormData, key: string, max = 2000): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

function count(form: FormData, key: string): number | null {
  const raw = form.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

const PROJECT_STAGES = ["draft", "recruiting", "in_progress", "paused", "completed"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

const TASK_STATUSES = ["todo", "doing", "done", "dropped"] as const;

function after(needId: string) {
  revalidatePath(`/admin/needs/${needId}`);
  revalidatePath("/projects", "layout");
}

/** The need behind a project, needed to revalidate the page it is edited on. */
async function needIdOf(projectId: string): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("projects")
    .select("need_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) throw new Error("That project is no longer available.");
  return data.need_id as string;
}

export async function updateProject(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("projectId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!(PROJECT_STAGES as readonly string[]).includes(stage)) {
    throw new Error(`Unknown project stage: ${stage}`);
  }

  const { error } = await supabaseAdmin()
    .from("projects")
    .update({
      stage,
      lead: text(formData, "lead", 200),
      coordinator: text(formData, "coordinator", 200),
      title: text(formData, "title", 200),
      summary: text(formData, "summary", 4000),
      summary_np: text(formData, "summaryNp", 4000),
    })
    .eq("id", id);

  // The completion guard in migration 019 arrives here. Its message already
  // says what to do — "Record what this project achieved before completing it"
  // — so it is passed through rather than replaced.
  if (error) throw new Error(error.message);

  after(await needIdOf(id));
}

export async function addProjectTask(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const title = text(formData, "title", 300);
  if (!title) throw new Error("A task needs a title.");

  const { error } = await supabaseAdmin().from("project_tasks").insert({
    project_id: projectId,
    title,
    title_np: text(formData, "titleNp", 300),
    detail: text(formData, "detail", 2000),
    is_milestone: formData.get("isMilestone") === "on",
    due_on: text(formData, "dueOn", 20),
    // Private by default would hide the work; private by choice is what the
    // column is for. A safeguarding follow-up or anything naming a household
    // gets the box unticked.
    public: formData.get("private") !== "on",
    assignee: text(formData, "assignee", 200),
  });

  if (error) throw new Error(error.message);
  after(await needIdOf(projectId));
}

export async function updateProjectTask(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Unknown task status: ${status}`);
  }

  const { error } = await supabaseAdmin()
    .from("project_tasks")
    .update({ status })
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  after(await needIdOf(projectId));
}

/**
 * A progress note.
 *
 * Rows rather than a `latest_update` column, because a column means every new
 * note destroys the one before it and the history of a project is most of what
 * makes it worth reading. `internal` is what lets a coordinator write the
 * useful version — without it the only safe update is a bland one, and people
 * stop writing them.
 */
export async function addProjectUpdate(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const body = text(formData, "body", 4000);
  if (!body) throw new Error("Write the update before posting it.");

  const { error } = await supabaseAdmin().from("project_updates").insert({
    project_id: projectId,
    body,
    body_np: text(formData, "bodyNp", 4000),
    author: text(formData, "author", 200),
    internal: formData.get("internal") === "on",
  });

  if (error) throw new Error(error.message);
  after(await needIdOf(projectId));
}

export async function addProjectOutput(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const label = text(formData, "label", 200);
  const url = text(formData, "url", 1000);
  if (!label || !url) throw new Error("An output needs both a label and a link.");
  // Also enforced by a check constraint; refused here so the coordinator gets
  // a sentence instead of a constraint name.
  if (!/^https?:\/\//i.test(url)) throw new Error("Links must start with http:// or https://.");

  const { error } = await supabaseAdmin()
    .from("project_outputs")
    .insert({ project_id: projectId, label, url });

  if (error) throw new Error(error.message);
  after(await needIdOf(projectId));
}

/**
 * What the project achieved, and whether the requester agrees.
 *
 * Upserted rather than inserted: an outcome gets corrected as the last figures
 * come in, and forcing a delete-and-retype would be refused outright once the
 * project is completed.
 *
 * `requester_confirmed` is the part that makes this an outcome rather than a
 * self-assessment — the organisation that asked for the help is the only party
 * who can say whether it arrived. It is not required, because chasing a
 * confirmation can take weeks and the work is still done; the record then says
 * plainly that it is unconfirmed instead of implying an agreement nobody gave.
 */
export async function recordProjectOutcome(formData: FormData) {
  const actor = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const summary = text(formData, "summary", 4000);
  if (!summary) throw new Error("Say what this project achieved.");

  const { error } = await supabaseAdmin().from("project_outcomes").upsert(
    {
      project_id: projectId,
      summary,
      summary_np: text(formData, "summaryNp", 4000),
      households_reached: count(formData, "households"),
      people_involved: count(formData, "people"),
      requester_confirmed: formData.get("requesterConfirmed") === "on",
      requester_note: text(formData, "requesterNote", 2000),
      recorded_by: actor,
    },
    { onConflict: "project_id" }
  );

  if (error) throw new Error(error.message);
  after(await needIdOf(projectId));
}
