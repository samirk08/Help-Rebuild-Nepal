import { DEMO_COUNTS, TRACKER_LABELS } from "./content";
import { DEMAND, EXPERTISE, LOCATIONS } from "./site-data";
import { supabaseAdmin } from "./supabase";

export type Metric = { label: string; value: number };

const WORK_MODE_FIELD = "s05-where-you-can-work";
const CONTRIBUTE_FIELD = "s02-how-you-can-contribute";

/**
 * Headline capacity numbers, backed by real rows once they exist.
 *
 * Three of the five labels have an exact, unambiguous field behind them and
 * are computed for real. The other two — "On the ground, need logistics" and
 * "On the ground, self-supported" — describe a split the volunteer form
 * (VOL_FORM in content.ts) has no field for: nothing asks whether an
 * on-the-ground volunteer needs the coordination team to arrange their
 * lodging/transport or can cover it themselves. Rather than guess at a proxy
 * for that (e.g. "brought equipment" answers a different question), those two
 * stay at zero until either a form field exists to ask it directly or an
 * admin tags it — a wrong number here would be worse than an honest zero.
 */
export async function trackerMetrics(demo: boolean): Promise<Metric[]> {
  if (demo) {
    return TRACKER_LABELS.map((label, i) => ({ label, value: DEMO_COUNTS[i] ?? 0 }));
  }

  const client = supabaseAdmin();

  const [{ count: total }, { count: remote }, { count: offeringTime }] = await Promise.all([
    client.from("submissions").select("id", { count: "exact", head: true }).eq("kind", "volunteer"),
    client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("kind", "volunteer")
      .eq(`fields->>${WORK_MODE_FIELD}`, "Remote"),
    client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("kind", "volunteer")
      .contains("fields", { [CONTRIBUTE_FIELD]: ["I can contribute time"] }),
  ]);

  const values = [total ?? 0, remote ?? 0, 0, 0, offeringTime ?? 0];
  return TRACKER_LABELS.map((label, i) => ({ label, value: values[i] ?? 0 }));
}

/** A labelled row with a bar behind it: the two breakdown cards on the tracker. */
export type BreakdownRow = { label: string; count: number; percent: number };

/**
 * The card's eight "Skills registered" buckets, against the twelve options
 * the volunteer form actually offers for "Primary skill".
 *
 * The card and the form were written separately and do not use the same
 * words — "Logistics" on the card is "Logistics & transport" on the form — so
 * the join has to be stated rather than inferred from the label. The seven
 * mapped here are the ones the card names; the eighth, "Other", is whatever
 * is left, which is exactly what it says and keeps the percentages adding up.
 * Each string must match its form option verbatim, the same rule NETWORKS in
 * site-data.ts follows for the same reason.
 *
 * A bucket takes a list of options, not one, so that renaming a form option
 * does not orphan the answers already stored under the old wording: the view
 * groups on the exact string the volunteer picked, so "IT & data" is still
 * counted next to the longer name that replaced it, in the row it always
 * belonged to.
 */
const SKILL_BUCKETS: Record<string, readonly string[]> = {
  Engineering: ["Engineering (structural / civil)"],
  Architecture: ["Architecture"],
  "Health & medical": ["Health & medical"],
  "Project management": ["Project management"],
  "Water & sanitation": ["Water & sanitation (WASH)"],
  Logistics: ["Logistics & transport"],
  "IT & data": ["IT, data & mapping (GIS)", "IT & data"],
};

/** The design's own table, which is all zeros — what `?demo` and a failed query show. */
function emptyExpertise(): BreakdownRow[] {
  return EXPERTISE.map((label) => ({ label, count: 0, percent: 0 }));
}

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/**
 * Registered volunteers by skill, in the card's eight buckets.
 *
 * Percentages are of the volunteers who answered the question, not of everyone
 * registered. Someone who skipped it is not evidence of anything, and folding
 * them into "Other" would report them as having a skill outside the seven
 * named ones — which is a claim about a person who made no claim.
 */
export async function skillBreakdown(demo: boolean): Promise<BreakdownRow[]> {
  if (demo) return emptyExpertise();

  const { data, error } = await supabaseAdmin()
    .from("volunteer_skill_counts")
    .select("skill, volunteers");

  if (error) {
    console.error("skillBreakdown failed", error);
    return emptyExpertise();
  }

  // The view emits one row per distinct answer plus a null row for the blanks,
  // which is dropped here: `answered` is the denominator.
  const bySkill = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ skill: string | null; volunteers: number | null }>) {
    if (row.skill) bySkill.set(row.skill, row.volunteers ?? 0);
  }

  const answered = [...bySkill.values()].reduce((sum, n) => sum + n, 0);

  const counts = new Map<string, number>();
  for (const [label, skills] of Object.entries(SKILL_BUCKETS)) {
    counts.set(label, skills.reduce((sum, skill) => sum + (bySkill.get(skill) ?? 0), 0));
  }

  // The one bucket the mapping does not name takes everything the other seven
  // did not claim. Resolved by lookup rather than by position so that a
  // regenerated card with a second unnamed bucket leaves it empty instead of
  // counting the same people twice. Never negative: a skill option dropped
  // from the form upstream would still be counted by the view.
  const named = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const other = EXPERTISE.find((label) => !(label in SKILL_BUCKETS));
  const remainder = Math.max(0, answered - named);

  return EXPERTISE.map((label) => {
    const count = label === other ? remainder : (counts.get(label) ?? 0);
    return { label, count, percent: percent(count, answered) };
  });
}

/** How many places the "Registered from" card names before rolling the rest up. */
const ORIGIN_ROWS = 5;

/** The label the rolled-up row carries — already in the translation map. */
const ORIGIN_OTHER = "Other";

/** The design's own table, all zeros — same failure fallback as the skills card. */
function emptyLocations(): BreakdownRow[] {
  return LOCATIONS.map((label) => ({ label, count: 0, percent: 0 }));
}

/**
 * Where registered volunteers are, most-registered first.
 *
 * The design's card lists countries. The volunteer form has no country
 * question — it asks for a district, with one "Outside Nepal" entry for the
 * diaspora — so this reports the places people actually gave, which is the
 * same question answered at the granularity the data supports. Everything
 * past the fifth is one "Other" row, as the design's own last row does.
 *
 * Volunteers who left the field blank are left out entirely rather than shown
 * as an unnamed place: a missing answer is not a location.
 */
export async function originBreakdown(demo: boolean): Promise<BreakdownRow[]> {
  if (demo) return emptyLocations();

  const { data, error } = await supabaseAdmin()
    .from("volunteer_origin_counts")
    .select("origin, volunteers");

  // An unreachable view falls back to the design's table rather than to an
  // empty list: no rows is how the page says "nobody has registered yet", and
  // a failed query is not evidence of that.
  if (error) {
    console.error("originBreakdown failed", error);
    return emptyLocations();
  }

  const places = ((data ?? []) as Array<{ origin: string | null; volunteers: number | null }>)
    .filter((row): row is { origin: string; volunteers: number | null } => Boolean(row.origin))
    .map((row) => ({ label: row.origin, count: row.volunteers ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const total = places.reduce((sum, place) => sum + place.count, 0);
  const named = places.slice(0, ORIGIN_ROWS);
  const rest = places.slice(ORIGIN_ROWS);

  const rows = named.map((place) => ({ ...place, percent: percent(place.count, total) }));

  if (rest.length > 0) {
    const count = rest.reduce((sum, place) => sum + place.count, 0);
    rows.push({ label: ORIGIN_OTHER, count, percent: percent(count, total) });
  }

  return rows;
}

/**
 * The five "What is needed" figures.
 *
 * All five are cumulative totals of what has actually been recorded, in the
 * design's order. A request counts as active while it is still looking for
 * people (verified or recruiting) and as met once it is not (filled or
 * completed), so no request is in both columns and none is in neither.
 * "People needed" is what those active requests asked for — not what is still
 * outstanding — and "Volunteers matched" beside it is the other half of that
 * subtraction.
 */
export async function demandTotals(demo: boolean): Promise<Metric[]> {
  if (demo) return DEMAND.map((row) => ({ label: row.label, value: Number(row.value) || 0 }));

  const client = supabaseAdmin();
  const [totals, { count: matched }, { count: projectsCompleted }] = await Promise.all([
    client.from("need_demand_totals").select("active_requests, people_needed, needs_met").maybeSingle(),
    client.from("matches").select("id", { count: "exact", head: true }),
    client.from("projects").select("id", { count: "exact", head: true }).eq("stage", "completed"),
  ]);

  if (totals.error) console.error("demandTotals failed", totals.error);

  const values = [
    totals.data?.active_requests ?? 0,
    totals.data?.people_needed ?? 0,
    matched ?? 0,
    totals.data?.needs_met ?? 0,
    projectsCompleted ?? 0,
  ];

  return DEMAND.map((row, i) => ({ label: row.label, value: values[i] ?? 0 }));
}

/**
 * Whether this build will honour `?demo` at all.
 *
 * Reading the query string opts a page out of static rendering. Kept even
 * though the site no longer has a static-export build, because it's still
 * what stops a public deployment from letting anyone open `?demo` and
 * screenshot a full register: it must be turned on deliberately per
 * environment, not just by knowing the query string.
 */
export const DEMO_ALLOWED = process.env.NEXT_PUBLIC_ALLOW_DEMO === "1";

export function isDemo(searchParams: Record<string, string | string[] | undefined>): boolean {
  if (!DEMO_ALLOWED) return false;
  return searchParams.demo !== undefined;
}
