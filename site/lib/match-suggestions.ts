import { PUBLISHED_STATUSES } from "./public-needs";
import { supabaseAdmin } from "./supabase";
import {
  assessMatch,
  rankNeedsForVolunteer,
  rankVolunteersForNeed,
  shortfall,
  urgencyWeight,
  type MatchableNeed,
  type MatchableVolunteer,
  type MatchAssessment,
  type RankedNeed,
  type RankedVolunteer,
} from "./matching";

/**
 * The read layer for matching: rows in, ranked suggestions out.
 *
 * lib/matching.ts holds the judgement and touches nothing; this file holds the
 * queries and makes none. The split is what lets the engine be tested against
 * fixtures, and what keeps every "which volunteers are candidates at all"
 * decision in one reviewable place rather than spread across page components.
 *
 * ------------------------------------------------------------- Suggest only
 *
 * Nothing here writes a match. Every function returns a ranked, explained list
 * for a person to act on, and `createMatch` in lib/admin-actions.ts remains the
 * only thing that records one. That is not caution about the algorithm being
 * new — it is the design. Sending a volunteer to a site has consequences the
 * platform cannot see (who is actually reachable, what the ward office already
 * arranged, whether someone is safe to send), and a coordination desk that
 * assigns people automatically is a desk nobody can be held responsible for.
 * What is automated here is the reading of three hundred registrations, which
 * is the part a person genuinely cannot do.
 *
 * -------------------------------------------------------------- On scaling
 *
 * Candidates are fetched and scored in the app, capped at CANDIDATE_LIMIT.
 * At this project's scale — hundreds to a few thousand registrations — that is
 * a handful of milliseconds against a query that already had to run, and it
 * buys the whole scoring vocabulary, which SQL over a jsonb column would not.
 * If the register ever outgrows the cap, the move is a prefilter in Postgres
 * (district and skills are already indexed, skills with GIN) narrowing the pool
 * before it reaches here — not a rewrite of the engine.
 */

/** Rows read per suggestion query. See the scaling note above. */
const CANDIDATE_LIMIT = 1000;

/** How many suggestions a screen shows before "show the rest". */
export const SUGGESTION_PAGE = 12;

/**
 * Statuses a volunteer can be suggested from.
 *
 * `submitted` and `under_review` are in deliberately. The coordination desk's
 * problem is not only "who fits this need" but "whose registration should I
 * check next", and those are the same question: a strong fit sitting
 * unreviewed is exactly the row a verifier should open. Every suggestion
 * carries the volunteer's status, and an unverified one is labelled wherever
 * it is rendered. `rejected` is excluded here and gated in the engine too.
 */
const SUGGESTABLE_VOLUNTEER_STATUSES = [
  "submitted",
  "under_review",
  "verified",
  "recruiting",
] as const;

/** Field keys on the volunteer form, same naming rule as lib/public-needs.ts. */
const V = {
  contribution: "s02-how-you-can-contribute",
  primarySkill: "s03-primary-skill",
  years: "s03-years-of-experience",
  subSkills: "s03-sub-skills",
  certifications: "s03-certifications-and-licences",
  availableFrom: "s04-available-from",
  commitDuration: "s04-duration-you-can-commit",
  hoursPerWeek: "s04-hours-per-week",
  maxDeployment: "s04-maximum-single-deployment",
  workMode: "s05-where-you-can-work",
  travel: "s05-travel",
  preferredDistricts: "s05-preferred-districts",
  resources: "s06-resources",
  languages: "s07-languages",
} as const;

/** Field keys on the need form. */
const N = {
  resources: "s03-resources-required",
  experience: "s04-experience-level-required",
  startDate: "s05-start-date",
  duration: "s05-duration",
  deadline: "s05-deadline",
  accommodation: "s06-accommodation",
  food: "s06-food",
  transport: "s06-transport",
  workMode: "s07-where-the-work-happens",
} as const;

type SubmissionRow = {
  id: string;
  org_or_name: string | null;
  status: string;
  district: string | null;
  province: string | null;
  urgency: string | null;
  skills: string[] | null;
  people_needed: number | null;
  fields: Record<string, unknown>;
};

const VOLUNTEER_COLUMNS = "id, org_or_name, status, district, fields";
const NEED_COLUMNS =
  "id, org_or_name, status, district, province, urgency, skills, people_needed, fields";

function str(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function list(fields: Record<string, unknown>, key: string): string[] {
  const value = fields[key];
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/* ------------------------------------------------------------- Adapters */

export function toMatchableVolunteer(
  row: SubmissionRow,
  extras: { activeMatches?: number; alreadyMatched?: boolean } = {}
): MatchableVolunteer {
  const f = row.fields ?? {};
  return {
    id: row.id,
    name: row.org_or_name,
    status: row.status,
    district: row.district,
    primarySkill: str(f, V.primarySkill),
    subSkills: str(f, V.subSkills),
    certifications: str(f, V.certifications),
    yearsExperience: str(f, V.years),
    contribution: list(f, V.contribution),
    availableFrom: str(f, V.availableFrom),
    commitDuration: str(f, V.commitDuration),
    hoursPerWeek: str(f, V.hoursPerWeek),
    maxDeployment: str(f, V.maxDeployment),
    workMode: str(f, V.workMode),
    travel: str(f, V.travel),
    preferredDistricts: str(f, V.preferredDistricts),
    resources: list(f, V.resources),
    languages: list(f, V.languages),
    activeMatches: extras.activeMatches ?? 0,
    alreadyMatched: extras.alreadyMatched ?? false,
  };
}

export function toMatchableNeed(row: SubmissionRow, committed = 0): MatchableNeed {
  const f = row.fields ?? {};
  return {
    id: row.id,
    title: row.org_or_name,
    status: row.status,
    district: row.district,
    province: row.province,
    urgency: row.urgency,
    // The promoted column, with the raw answer as the fallback for rows
    // written before migration 002 backfilled it.
    skills: row.skills ?? list(f, "s03-skills-required"),
    resourcesRequired: list(f, N.resources),
    experienceRequired: str(f, N.experience),
    peopleNeeded: row.people_needed,
    committed,
    startDate: str(f, N.startDate),
    duration: str(f, N.duration),
    deadline: str(f, N.deadline),
    workMode: str(f, N.workMode),
    accommodation: str(f, N.accommodation),
    food: str(f, N.food),
    transport: str(f, N.transport),
  };
}

/* --------------------------------------------------------------- Queries */

/** Matches per volunteer id, for the workload term in the ranking. */
async function matchCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const { data } = await supabaseAdmin().from("matches").select("volunteer_id, need_id");
  for (const row of data ?? []) {
    counts.set(row.volunteer_id, (counts.get(row.volunteer_id) ?? 0) + 1);
  }
  return counts;
}

/** Volunteers already recorded against a need, so they are not re-suggested. */
async function matchedToNeed(needId: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin().from("matches").select("volunteer_id").eq("need_id", needId);
  return new Set((data ?? []).map((row) => row.volunteer_id as string));
}

async function committedByNeed(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data } = await supabaseAdmin().from("matches").select("need_id").in("need_id", ids);
  for (const row of data ?? []) counts.set(row.need_id, (counts.get(row.need_id) ?? 0) + 1);
  return counts;
}

/* ----------------------------------------------------- Volunteers → need */

export type NeedSuggestions = {
  need: MatchableNeed;
  ranked: RankedVolunteer[];
  /** Eligible pairings only, best first — what a screen shows by default. */
  eligible: RankedVolunteer[];
  /** Ruled out, with the reason. Shown collapsed rather than hidden. */
  blocked: RankedVolunteer[];
  /** How many registrations were considered, before any of it was ranked. */
  poolSize: number;
};

/**
 * Rank the register against one need.
 *
 * Returns null when the need does not exist, so a caller can 404 rather than
 * render an empty suggestion list that looks like "nobody fits".
 */
export async function suggestVolunteersForNeed(needId: string): Promise<NeedSuggestions | null> {
  if (!/^[0-9a-f-]{36}$/i.test(needId)) return null;
  const client = supabaseAdmin();

  const { data: needRow } = await client
    .from("submissions")
    .select(NEED_COLUMNS)
    .eq("id", needId)
    .eq("kind", "need")
    .maybeSingle();

  if (!needRow) return null;

  const [{ data: volunteerRows }, counts, alreadyMatched] = await Promise.all([
    client
      .from("submissions")
      .select(VOLUNTEER_COLUMNS)
      .eq("kind", "volunteer")
      .in("status", SUGGESTABLE_VOLUNTEER_STATUSES)
      .limit(CANDIDATE_LIMIT),
    matchCounts(),
    matchedToNeed(needId),
  ]);

  const committed = alreadyMatched.size;
  const need = toMatchableNeed(needRow as SubmissionRow, committed);

  const volunteers = ((volunteerRows ?? []) as SubmissionRow[]).map((row) =>
    toMatchableVolunteer(row, {
      activeMatches: counts.get(row.id) ?? 0,
      alreadyMatched: alreadyMatched.has(row.id),
    })
  );

  const ranked = rankVolunteersForNeed(need, volunteers);
  return {
    need,
    ranked,
    eligible: ranked.filter((r) => r.assessment.eligible),
    blocked: ranked.filter((r) => !r.assessment.eligible),
    poolSize: volunteers.length,
  };
}

/* ----------------------------------------------------- Needs → volunteer */

export type VolunteerSuggestions = {
  volunteer: MatchableVolunteer;
  ranked: RankedNeed[];
  eligible: RankedNeed[];
  poolSize: number;
};

/**
 * Rank open needs against one volunteer.
 *
 * `publishedOnly` is the difference between the two callers. The public
 * profile page must never surface a need a verifier has not published — that
 * rule belongs to lib/public-needs.ts and is repeated here rather than
 * assumed — while the admin screens want to see everything under review too.
 */
export async function suggestNeedsForVolunteer(
  volunteerId: string,
  { publishedOnly = false }: { publishedOnly?: boolean } = {}
): Promise<VolunteerSuggestions | null> {
  if (!/^[0-9a-f-]{36}$/i.test(volunteerId)) return null;
  const client = supabaseAdmin();

  const { data: volunteerRow } = await client
    .from("submissions")
    .select(VOLUNTEER_COLUMNS)
    .eq("id", volunteerId)
    .eq("kind", "volunteer")
    .maybeSingle();

  if (!volunteerRow) return null;

  // Needs that are done are not suggestions. `filled` and `completed` are
  // published statuses because the board shows what happened to a request,
  // but nothing is gained by offering someone work that is finished.
  const openStatuses = publishedOnly
    ? PUBLISHED_STATUSES.filter((s) => s === "verified" || s === "recruiting")
    : ["submitted", "under_review", "verified", "recruiting"];

  const [{ data: needRows }, counts] = await Promise.all([
    client
      .from("submissions")
      .select(NEED_COLUMNS)
      .eq("kind", "need")
      .in("status", openStatuses)
      .limit(CANDIDATE_LIMIT),
    matchCounts(),
  ]);

  const rows = (needRows ?? []) as SubmissionRow[];
  const committed = await committedByNeed(rows.map((r) => r.id));

  // Which of these this person is already on, so their own profile does not
  // suggest work they have already been matched to.
  const { data: mine } = await client
    .from("matches")
    .select("need_id")
    .eq("volunteer_id", volunteerId);
  const alreadyOn = new Set((mine ?? []).map((row) => row.need_id as string));

  const volunteer = toMatchableVolunteer(volunteerRow as SubmissionRow, {
    activeMatches: counts.get(volunteerId) ?? 0,
  });

  const needs = rows
    .filter((row) => !alreadyOn.has(row.id))
    .map((row) => toMatchableNeed(row, committed.get(row.id) ?? 0));

  const ranked = rankNeedsForVolunteer(volunteer, needs);
  return {
    volunteer,
    ranked,
    eligible: ranked.filter((r) => r.assessment.eligible),
    poolSize: needs.length,
  };
}

/* -------------------------------------------------------- The work queue */

export type QueueEntry = {
  need: MatchableNeed;
  /** Best pairings for this need, already trimmed for display. */
  top: RankedVolunteer[];
  strong: number;
  possible: number;
  /** What the queue is ordered by: urgency against how far short it still is. */
  priority: number;
};

/**
 * The coordination queue: every open need that still has room, ordered by how
 * badly it needs attention, each with the people it should be offered to.
 *
 * This is the screen that replaces reading the register by hand. It runs one
 * pass over the volunteer pool and reuses it for every need rather than
 * querying per need, which is what keeps it a single page load rather than N
 * round trips.
 */
export async function matchQueue(limit = 25): Promise<QueueEntry[]> {
  const client = supabaseAdmin();

  const [{ data: needRows }, { data: volunteerRows }, { data: matchRows }] = await Promise.all([
    client
      .from("submissions")
      .select(NEED_COLUMNS)
      .eq("kind", "need")
      .in("status", ["verified", "recruiting"])
      .limit(CANDIDATE_LIMIT),
    client
      .from("submissions")
      .select(VOLUNTEER_COLUMNS)
      .eq("kind", "volunteer")
      .in("status", SUGGESTABLE_VOLUNTEER_STATUSES)
      .limit(CANDIDATE_LIMIT),
    client.from("matches").select("need_id, volunteer_id"),
  ]);

  const committed = new Map<string, number>();
  const workload = new Map<string, number>();
  const pairs = new Set<string>();
  for (const row of matchRows ?? []) {
    committed.set(row.need_id, (committed.get(row.need_id) ?? 0) + 1);
    workload.set(row.volunteer_id, (workload.get(row.volunteer_id) ?? 0) + 1);
    pairs.add(`${row.need_id}:${row.volunteer_id}`);
  }

  const volunteerRowsTyped = (volunteerRows ?? []) as SubmissionRow[];
  const needs = ((needRows ?? []) as SubmissionRow[]).map((row) =>
    toMatchableNeed(row, committed.get(row.id) ?? 0)
  );

  const entries: QueueEntry[] = needs.map((need) => {
    const volunteers = volunteerRowsTyped.map((row) =>
      toMatchableVolunteer(row, {
        activeMatches: workload.get(row.id) ?? 0,
        alreadyMatched: pairs.has(`${need.id}:${row.id}`),
      })
    );

    const ranked = rankVolunteersForNeed(need, volunteers).filter((r) => r.assessment.eligible);
    const urgency = urgencyWeight(need.urgency);

    return {
      need,
      top: ranked.slice(0, 4),
      strong: ranked.filter((r) => r.assessment.band === "strong").length,
      possible: ranked.filter((r) => r.assessment.band === "possible").length,
      priority: urgency * shortfall(need) * 100,
    };
  });

  return entries
    .filter((entry) => shortfall(entry.need) > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/** One pairing, for recording the engine's opinion alongside a manual match. */
export async function assessPair(
  needId: string,
  volunteerId: string
): Promise<MatchAssessment | null> {
  const client = supabaseAdmin();
  const [{ data: needRow }, { data: volunteerRow }] = await Promise.all([
    client.from("submissions").select(NEED_COLUMNS).eq("id", needId).eq("kind", "need").maybeSingle(),
    client
      .from("submissions")
      .select(VOLUNTEER_COLUMNS)
      .eq("id", volunteerId)
      .eq("kind", "volunteer")
      .maybeSingle(),
  ]);

  if (!needRow || !volunteerRow) return null;
  return assessMatch(
    toMatchableNeed(needRow as SubmissionRow),
    toMatchableVolunteer(volunteerRow as SubmissionRow)
  );
}
