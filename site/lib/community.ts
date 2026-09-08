import { PRIMARY_SKILL_KEY } from "./networks";
import { isPublicProject, ok, unavailable, type ReadResult } from "./publication";
import { NETWORKS } from "./site-data";
import { supabaseAdmin } from "./supabase";
import { errorFields, logError } from "./log";

/**
 * Read models for the two "the database should not just sit there" pages:
 * skill networks and standing projects.
 */

/**
 * Members per skill network.
 *
 * Two kinds of member, counted once each. Accounts that joined (or were
 * auto-enrolled by primary skill — migration 009 backfill and the claim flow)
 * are rows in network_members. Registrations never claimed by an account
 * cannot hold a membership row, so they are added by primary skill — the
 * derivation this page used before joining existed, kept only for the rows
 * that cannot join. `user_id is null` is what keeps the two sets disjoint:
 * every claimed registration is enrolled in its skill network, so counting
 * unclaimed rows only never counts the same person twice.
 *
 * Counts everyone registered, not only verified volunteers: this is a measure
 * of how much capacity exists, and the tracker counts the same way.
 */
export async function networkCounts(): Promise<Map<string, number>> {
  const client = supabaseAdmin();
  const counts = new Map<string, number>();

  const results = await Promise.all(
    NETWORKS.map(async (network) => {
      const [joined, unclaimed] = await Promise.all([
        client
          .from("network_members")
          .select("id", { count: "exact", head: true })
          .eq("network", network.name),
        client
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("kind", "volunteer")
          .is("user_id", null)
          .eq(`fields->>${PRIMARY_SKILL_KEY}`, network.skill),
      ]);
      return [network.name, (joined.count ?? 0) + (unclaimed.count ?? 0)] as const;
    })
  );

  for (const [name, count] of results) counts.set(name, count);
  return counts;
}

export type PublicProject = {
  id: string;
  stage: string;
  coordinator: string | null;
  lead: string | null;
  title: string;
  district: string | null;
  committed: number;
  peopleNeeded: number | null;
  /** Redacted progress, from migration 019's `project_public_progress`. */
  summary: string | null;
  summaryNp: string | null;
  tasksDone: number;
  tasksTotal: number;
  milestonesDone: number;
  milestonesTotal: number;
  latestUpdate: string | null;
  latestUpdateNp: string | null;
  latestUpdateAt: string | null;
  outcome: {
    summary: string;
    summaryNp: string | null;
    households: number | null;
    people: number | null;
    confirmed: boolean;
  } | null;
};

type ProjectRow = {
  id: string;
  stage: string;
  coordinator: string | null;
  lead: string | null;
  title: string | null;
  title_np: string | null;
  summary: string | null;
  summary_np: string | null;
  need_id: string;
  tasks_total: number | string | null;
  tasks_done: number | string | null;
  milestones_total: number | string | null;
  milestones_done: number | string | null;
  latest_update: string | null;
  latest_update_np: string | null;
  latest_update_at: string | null;
  outcome_summary: string | null;
  outcome_summary_np: string | null;
  outcome_households: number | null;
  outcome_people: number | null;
  outcome_confirmed: boolean | null;
  need_org_or_name: string | null;
  need_district: string | null;
  need_skills: string[] | null;
  need_people_needed: number | null;
  need_kind: string | null;
  need_status: string | null;
};

/**
 * Standing projects, with the need each was promoted from.
 *
 * A project is only as public as the need behind it. That was stated in this
 * comment but not enforced: the query dropped projects whose need row was
 * missing, and published every other one regardless of the need's status. A
 * need rejected or withdrawn after promotion kept its project on the public
 * page. `isPublicProject` applies the same rule the board applies, so the two
 * cannot drift apart again.
 *
 * Since migration 019 the source is `project_public_progress`, which applies
 * that same rule in SQL and — the reason it exists — has no `assignee` and no
 * update `author` column in it at all. `isPublicProject` still runs over the
 * result, so the two statements of the rule check each other rather than one
 * quietly replacing the other.
 */
export async function listProjects(): Promise<ReadResult<PublicProject[]>> {
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("project_public_progress")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logError("listprojects_failed", errorFields(error));
    return unavailable(error.code ?? "read_failed");
  }

  const rows = (data ?? []) as ProjectRow[];

  // The view already applies this rule. Running it again over the result is
  // deliberate belt and braces: the two statements of "a project is as public
  // as its need" check each other, which is what was missing when a rejected
  // need kept a live project page.
  const withNeed = rows.filter((row) =>
    isPublicProject({
      stage: row.stage,
      need: { kind: row.need_kind, status: row.need_status },
    })
  );
  if (withNeed.length === 0) return ok([]);

  const { data: matches } = await client
    .from("matches")
    .select("need_id")
    .in("need_id", withNeed.map((r) => r.need_id));

  const committed = new Map<string, number>();
  for (const match of matches ?? []) {
    committed.set(match.need_id, (committed.get(match.need_id) ?? 0) + 1);
  }

  const count = (value: number | string | null): number => Number(value ?? 0) || 0;

  return ok(
    withNeed.map((row) => ({
      id: row.id,
      stage: row.stage,
      coordinator: row.coordinator,
      lead: row.lead,
      // A title a coordinator wrote beats the requesting organisation's name,
      // which is what the card fell back to when a project had no name of its
      // own — and still does.
      title: row.title ?? row.need_org_or_name ?? (row.need_skills?.[0] ?? "Project"),
      district: row.need_district,
      committed: committed.get(row.need_id) ?? 0,
      peopleNeeded: row.need_people_needed,
      summary: row.summary,
      summaryNp: row.summary_np,
      tasksDone: count(row.tasks_done),
      tasksTotal: count(row.tasks_total),
      milestonesDone: count(row.milestones_done),
      milestonesTotal: count(row.milestones_total),
      latestUpdate: row.latest_update,
      latestUpdateNp: row.latest_update_np,
      latestUpdateAt: row.latest_update_at,
      outcome: row.outcome_summary
        ? {
            summary: row.outcome_summary,
            summaryNp: row.outcome_summary_np,
            households: row.outcome_households,
            people: row.outcome_people,
            confirmed: row.outcome_confirmed === true,
          }
        : null,
    }))
  );
}
