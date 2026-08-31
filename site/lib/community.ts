import { NETWORKS } from "./site-data";
import { supabaseAdmin } from "./supabase";

/**
 * Read models for the two "the database should not just sit there" pages:
 * skill networks and standing projects.
 */

const PRIMARY_SKILL_FIELD = "s03-primary-skill";

/**
 * Members per skill network.
 *
 * A "member" is a registered volunteer whose primary skill is the network's
 * skill. Nothing asks people to join a network separately, so deriving it from
 * what they already told us is both accurate and avoids a second, emptier
 * number that would contradict the register.
 *
 * Counts everyone registered, not only verified volunteers: this is a measure
 * of how much capacity exists, and the tracker counts the same way.
 */
export async function networkCounts(): Promise<Map<string, number>> {
  const client = supabaseAdmin();
  const counts = new Map<string, number>();

  const results = await Promise.all(
    NETWORKS.map(async (network) => {
      const { count } = await client
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "volunteer")
        .eq(`fields->>${PRIMARY_SKILL_FIELD}`, network.skill);
      return [network.name, count ?? 0] as const;
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
  } | null;
};

/**
 * Standing projects, with the need each was promoted from.
 *
 * A project is only as public as the need behind it, so anything whose need is
 * missing is dropped rather than rendered as an untitled row.
 */
export async function listProjects(): Promise<PublicProject[]> {
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("projects")
    .select("id, stage, coordinator, need_id, submissions:need_id(org_or_name, district, skills, people_needed)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listProjects failed", error);
    return [];
  }

  const rows = (data ?? []).map((row) => ({
    ...row,
    // Supabase types a to-one embed as an array; need_id -> submissions.id is
    // a single FK, same as the matches embed in the admin need detail page.
    submissions: Array.isArray(row.submissions) ? row.submissions[0] : row.submissions,
  })) as ProjectRow[];

  const withNeed = rows.filter((row) => row.submissions);
  if (withNeed.length === 0) return [];

  const { data: matches } = await client
    .from("matches")
    .select("need_id")
    .in("need_id", withNeed.map((r) => r.need_id));

  const committed = new Map<string, number>();
  for (const match of matches ?? []) {
    committed.set(match.need_id, (committed.get(match.need_id) ?? 0) + 1);
  }

  return withNeed.map((row) => {
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
  });
}
