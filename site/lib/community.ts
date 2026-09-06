import { PRIMARY_SKILL_KEY } from "./networks";
import { isPublicProject, ok, unavailable, type ReadResult } from "./publication";
import { NETWORKS } from "./site-data";
import { supabaseAdmin } from "./supabase";

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
  title: string;
  district: string | null;
  committed: number;
  peopleNeeded: number | null;
};

type ProjectRow = {
  id: string;
  stage: string;
  coordinator: string | null;
  need_id: string;
  submissions: {
    org_or_name: string | null;
    district: string | null;
    skills: string[] | null;
    people_needed: number | null;
    kind: string | null;
    status: string | null;
  } | null;
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
 */
export async function listProjects(): Promise<ReadResult<PublicProject[]>> {
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("projects")
    .select(
      "id, stage, coordinator, need_id, submissions:need_id(org_or_name, district, skills, people_needed, kind, status)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listProjects failed", error);
    return unavailable(error.code ?? "read_failed");
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    // Supabase types a to-one embed as an array; need_id -> submissions.id is
    // a single FK, same as the matches embed in the admin need detail page.
    submissions: Array.isArray(row.submissions) ? row.submissions[0] : row.submissions,
  })) as ProjectRow[];

  const withNeed = rows.filter((row) =>
    isPublicProject({ stage: row.stage, need: row.submissions })
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

  return ok(
    withNeed.map((row) => {
      const need = row.submissions!;
      const skills = need.skills ?? [];
      return {
        id: row.id,
        stage: row.stage,
        coordinator: row.coordinator,
        title: need.org_or_name ?? (skills[0] ?? "Project"),
        district: need.district,
        committed: committed.get(row.need_id) ?? 0,
        peopleNeeded: need.people_needed,
      };
    })
  );
}
