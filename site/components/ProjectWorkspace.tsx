import {
  addProjectOutput,
  addProjectTask,
  addProjectUpdate,
  recordProjectOutcome,
  updateProject,
  updateProjectTask,
} from "@/lib/projects";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * The coordinator's view of a standing project.
 *
 * A project used to be a stage and a name. Everything here answers a question a
 * coordinator was previously answering from memory or from a chat thread: what
 * is the plan, who has it, what has happened lately, and — the one that matters
 * — what came of it.
 *
 * Two things are visible on the public page and marked as such: a task unless
 * it is set private, and an update unless it is internal. Nothing else here is,
 * and assignees never are: publishing "Ram is surveying houses in Ward 4 on
 * Thursday" tells anyone reading where a named person will be.
 */

type Project = {
  id: string;
  stage: string;
  lead: string | null;
  coordinator: string | null;
  title: string | null;
  summary: string | null;
  summary_np: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  is_milestone: boolean;
  due_on: string | null;
  assignee: string | null;
  public: boolean;
};

type Update = {
  id: string;
  body: string;
  author: string | null;
  internal: boolean;
  created_at: string;
};

type Output = { id: string; label: string; url: string };

type Outcome = {
  summary: string;
  summary_np: string | null;
  households_reached: number | null;
  people_involved: number | null;
  requester_confirmed: boolean;
  requester_confirmed_at: string | null;
  requester_note: string | null;
};

const STAGES = [
  ["draft", "Draft — not on the public page"],
  ["recruiting", "Recruiting"],
  ["in_progress", "In progress"],
  ["paused", "Paused — work has stopped"],
  ["completed", "Completed"],
] as const;

const TASK_STATUSES = [
  ["todo", "To do"],
  ["doing", "Doing"],
  ["done", "Done"],
  ["dropped", "Dropped"],
] as const;

export default async function ProjectWorkspace({ project }: { project: Project }) {
  const client = supabaseAdmin();

  const [{ data: tasks }, { data: updates }, { data: outputs }, { data: outcome }] =
    await Promise.all([
      client
        .from("project_tasks")
        .select("id, title, status, is_milestone, due_on, assignee, public")
        .eq("project_id", project.id)
        .order("position")
        .order("created_at"),
      client
        .from("project_updates")
        .select("id, body, author, internal, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      client
        .from("project_outputs")
        .select("id, label, url")
        .eq("project_id", project.id)
        .order("created_at"),
      client
        .from("project_outcomes")
        .select("*")
        .eq("project_id", project.id)
        .maybeSingle(),
    ]);

  const taskList = (tasks ?? []) as Task[];
  const done = taskList.filter((t) => t.status === "done").length;
  const recorded = outcome as Outcome | null;

  return (
    <>
      <h2 className="admin-section-title">Project</h2>

      <form action={updateProject} className="admin-detail" style={{ display: "grid", gap: 10 }}>
        <input type="hidden" name="projectId" value={project.id} />
        <div className="admin-form-row">
          <select name="stage" defaultValue={project.stage} aria-label="Project stage">
            {STAGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--dark btn--sm">
            Save project
          </button>
        </div>
        <input type="text" name="title" placeholder="Project title (public)" defaultValue={project.title ?? ""} />
        <div className="admin-form-row">
          <input type="text" name="lead" placeholder="Lead" defaultValue={project.lead ?? ""} />
          <input
            type="text"
            name="coordinator"
            placeholder="Coordinator"
            defaultValue={project.coordinator ?? ""}
          />
        </div>
        <textarea
          className="admin-textarea"
          name="summary"
          placeholder="What this project is, in a sentence or two (public)"
          defaultValue={project.summary ?? ""}
        />
        <textarea
          className="admin-textarea"
          name="summaryNp"
          placeholder="Nepali summary (optional)"
          defaultValue={project.summary_np ?? ""}
        />
        {/* The stage select offers `completed`, and the database refuses it
            without an outcome below. Saying so here means the refusal is not a
            surprise. */}
        {!recorded ? (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Completing this project needs an outcome recorded first.
          </p>
        ) : null}
      </form>

      <h3 className="admin-section-title" style={{ fontSize: 14 }}>
        Tasks and milestones — {done} of {taskList.length} done
      </h3>
      <div className="admin-detail">
        {taskList.length === 0 ? (
          <p className="admin-empty admin-empty--inline">No tasks yet.</p>
        ) : (
          taskList.map((task) => (
            <div className="admin-detail__row" key={task.id}>
              <span className="admin-detail__k">
                {task.is_milestone ? "◆ " : ""}
                {task.title}
                <br />
                <span style={{ color: "var(--faint)", fontSize: 12 }}>
                  {[
                    task.assignee ? `${task.assignee} (private)` : null,
                    task.due_on ? `due ${task.due_on}` : null,
                    task.public ? null : "not shown publicly",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Unassigned"}
                </span>
              </span>
              <span className="admin-detail__v">
                <form action={updateProjectTask} className="admin-form-row">
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <select name="status" defaultValue={task.status} aria-label="Task status">
                    {TASK_STATUSES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn--outline btn--sm">
                    Update
                  </button>
                </form>
              </span>
            </div>
          ))
        )}
      </div>

      <details style={{ margin: "10px 0 24px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5 }}>Add a task</summary>
        <form action={addProjectTask} className="admin-detail" style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <input type="hidden" name="projectId" value={project.id} />
          <input type="text" name="title" placeholder="What needs doing" required />
          <input type="text" name="titleNp" placeholder="Nepali (optional)" />
          <textarea className="admin-textarea" name="detail" placeholder="Detail (optional)" />
          <div className="admin-form-row">
            <input type="date" name="dueOn" aria-label="Due date" />
            <input type="text" name="assignee" placeholder="Assigned to (never published)" />
          </div>
          <label style={{ fontSize: 13.5 }}>
            <input type="checkbox" name="isMilestone" /> This is a milestone
          </label>
          {/* Public by default: hiding the work by default would make the
              public page useless. Private is a choice, for a safeguarding
              follow-up or anything naming a household. */}
          <label style={{ fontSize: 13.5 }}>
            <input type="checkbox" name="private" /> Keep this task off the public page
          </label>
          <button type="submit" className="btn btn--dark btn--sm" style={{ justifySelf: "start" }}>
            Add task
          </button>
        </form>
      </details>

      <h3 className="admin-section-title" style={{ fontSize: 14 }}>
        Updates
      </h3>
      <div className="admin-detail">
        {(updates ?? []).length === 0 ? (
          <p className="admin-empty admin-empty--inline">Nothing posted yet.</p>
        ) : (
          ((updates ?? []) as Update[]).map((u) => (
            <div className="admin-detail__row" key={u.id}>
              <span className="admin-detail__k">
                {new Date(u.created_at).toLocaleDateString()}
                <br />
                <span style={{ color: "var(--faint)", fontSize: 12 }}>
                  {u.author ?? "—"}
                  {u.internal ? " · internal" : ""}
                </span>
              </span>
              <span className="admin-detail__v">{u.body}</span>
            </div>
          ))
        )}
      </div>

      <form action={addProjectUpdate} className="admin-detail" style={{ margin: "10px 0 24px", display: "grid", gap: 8 }}>
        <input type="hidden" name="projectId" value={project.id} />
        <textarea className="admin-textarea" name="body" placeholder="What has happened since the last update" required />
        <textarea className="admin-textarea" name="bodyNp" placeholder="Nepali (optional)" />
        <div className="admin-form-row">
          <input type="text" name="author" placeholder="Posted by (never published)" />
          <label style={{ fontSize: 13.5 }}>
            <input type="checkbox" name="internal" /> Internal — do not publish
          </label>
        </div>
        <button type="submit" className="btn btn--dark btn--sm" style={{ justifySelf: "start" }}>
          Post update
        </button>
      </form>

      <h3 className="admin-section-title" style={{ fontSize: 14 }}>
        Output links
      </h3>
      <div className="admin-detail">
        {(outputs ?? []).length === 0 ? (
          <p className="admin-empty admin-empty--inline">No links yet.</p>
        ) : (
          ((outputs ?? []) as Output[]).map((o) => (
            <div className="admin-detail__row" key={o.id}>
              <span className="admin-detail__k">{o.label}</span>
              <span className="admin-detail__v">
                <a href={o.url} target="_blank" rel="noopener noreferrer">
                  {o.url}
                </a>
              </span>
            </div>
          ))
        )}
      </div>
      <form action={addProjectOutput} className="admin-form-row" style={{ margin: "10px 0 24px" }}>
        <input type="hidden" name="projectId" value={project.id} />
        <input type="text" name="label" placeholder="Label" required />
        <input type="url" name="url" placeholder="https://…" required />
        <button type="submit" className="btn btn--outline btn--sm">
          Add link
        </button>
      </form>

      <h3 className="admin-section-title" style={{ fontSize: 14 }}>
        Outcome
      </h3>
      <form action={recordProjectOutcome} className="admin-detail" style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="projectId" value={project.id} />
        <textarea
          className="admin-textarea"
          name="summary"
          placeholder="What this project achieved"
          defaultValue={recorded?.summary ?? ""}
          required
        />
        <textarea
          className="admin-textarea"
          name="summaryNp"
          placeholder="Nepali (optional)"
          defaultValue={recorded?.summary_np ?? ""}
        />
        <div className="admin-form-row">
          <input
            type="number"
            name="households"
            min={0}
            placeholder="Households reached"
            defaultValue={recorded?.households_reached ?? ""}
          />
          <input
            type="number"
            name="people"
            min={0}
            placeholder="People involved"
            defaultValue={recorded?.people_involved ?? ""}
          />
        </div>
        {/* The organisation that asked for the help is the only party who can
            say whether it arrived. Not required — chasing a confirmation takes
            weeks and the work is still done — but the public page then says
            plainly that it is unconfirmed rather than implying agreement. */}
        <label style={{ fontSize: 13.5 }}>
          <input
            type="checkbox"
            name="requesterConfirmed"
            defaultChecked={recorded?.requester_confirmed ?? false}
          />{" "}
          The requester has confirmed this
          {recorded?.requester_confirmed_at
            ? ` (${new Date(recorded.requester_confirmed_at).toLocaleDateString()})`
            : ""}
        </label>
        <textarea
          className="admin-textarea"
          name="requesterNote"
          placeholder="What the requester said (never published)"
          defaultValue={recorded?.requester_note ?? ""}
        />
        <button type="submit" className="btn btn--dark btn--sm" style={{ justifySelf: "start" }}>
          {recorded ? "Update outcome" : "Record outcome"}
        </button>
      </form>
    </>
  );
}
