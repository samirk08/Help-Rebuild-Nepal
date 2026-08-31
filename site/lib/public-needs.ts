import { supabaseAdmin } from "./supabase";

/**
 * The read layer behind the public needs board and need detail pages.
 *
 * Two rules govern everything here, and both are deliberate:
 *
 * 1. WHAT PUBLISHES. Only needs a verifier has actually moved past `submitted`
 *    appear publicly. A posted need is not visible to anyone but the
 *    coordination team until a person has looked at it. The design labels
 *    individual-posted requests "community-reported" to set expectations about
 *    how strongly they are attested — but that is a label on reviewed content,
 *    not a bypass around review. Publishing unreviewed submissions on a live
 *    disaster site is a policy decision with real misinformation risk, so it
 *    is not something this file grants by default.
 *
 * 2. WHAT IS WITHHELD. The need form collects a contact person, a phone/email
 *    and an exact location. None of those are ever returned by this module.
 *    The whole flow is built on the requester making contact first (see the
 *    interest form), so publishing their direct line would only expose them to
 *    scraping, and a precise pin adds nothing to the decision of whether you
 *    can help. Admin screens still see all of it.
 */

/** Statuses a verifier has acted on — the only ones the public site shows. */
export const PUBLISHED_STATUSES = ["verified", "recruiting", "filled", "completed"] as const;

/** Sentinel for the status dropdown's one non-status entry. */
export const COMMUNITY_REPORTED = "community-reported";

/** The board's filter dropdowns: stored value + the label a reader sees. */
export const URGENCY_OPTIONS = [
  { value: "Immediate", label: "Immediate (0–72 hrs)" },
  { value: "Urgent", label: "Urgent (1 week)" },
  { value: "Upcoming", label: "Upcoming (1 month)" },
  { value: "Reconstruction", label: "Reconstruction" },
] as const;

export const STATUS_OPTIONS = [
  { value: "verified", label: "Verified" },
  { value: "recruiting", label: "Recruiting" },
  { value: "filled", label: "Filled" },
  { value: "completed", label: "Completed" },
  { value: COMMUNITY_REPORTED, label: "Community-reported" },
] as const;

const F = {
  postingAs: "s01-you-are-posting-as",
  municipality: "s02-municipality",
  ward: "s02-ward",
  resources: "s03-resources-required",
  experience: "s04-experience-level-required",
  whatToDo: "s04-exactly-what-needs-to-be-done",
  objectives: "s04-objectives-what-success-looks-like",
  startDate: "s05-start-date",
  duration: "s05-duration",
  deadline: "s05-deadline",
  accommodation: "s06-accommodation",
  food: "s06-food",
  transport: "s06-transport",
  equipment: "s06-equipment-available-on-site",
  workMode: "s07-where-the-work-happens",
  paid: "s07-paid-or-unpaid",
  extra: "s09-anything-else-volunteers-should-know",
} as const;

export type NeedFilters = {
  province?: string;
  district?: string;
  skill?: string;
  urgency?: string;
  status?: string;
};

export type PublicNeedRow = {
  id: string;
  org: string | null;
  district: string | null;
  municipality: string | null;
  province: string | null;
  urgency: string | null;
  status: string;
  skills: string[];
  peopleNeeded: number | null;
  committed: number;
  communityReported: boolean;
  createdAt: string;
};

export type PublicNeedDetail = PublicNeedRow & {
  ward: string | null;
  resources: string[];
  experience: string | null;
  whatToDo: string | null;
  objectives: string | null;
  startDate: string | null;
  duration: string | null;
  deadline: string | null;
  accommodation: string | null;
  food: string | null;
  transport: string | null;
  equipment: string | null;
  workMode: string | null;
  paid: string | null;
  extra: string | null;
  interestCount: number;
};

type Row = {
  id: string;
  org_or_name: string | null;
  district: string | null;
  province: string | null;
  urgency: string | null;
  status: string;
  skills: string[] | null;
  people_needed: number | null;
  created_at: string;
  fields: Record<string, unknown>;
};

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

/**
 * The form tells individual posters their request is published as
 * "community-reported" (see the note on `s01-you-are-posting-as`), so the
 * badge has to follow the same rule the person was promised.
 */
function isCommunityReported(fields: Record<string, unknown>): boolean {
  return str(fields, F.postingAs) === "Individual";
}

function toRow(row: Row, committed: number): PublicNeedRow {
  return {
    id: row.id,
    org: row.org_or_name,
    district: row.district,
    municipality: str(row.fields, F.municipality),
    province: row.province,
    urgency: row.urgency,
    status: row.status,
    skills: row.skills ?? [],
    peopleNeeded: row.people_needed,
    committed,
    communityReported: isCommunityReported(row.fields),
    createdAt: row.created_at,
  };
}

/** How many volunteers an admin has already matched to each of these needs. */
async function committedByNeed(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  const { data } = await supabaseAdmin().from("matches").select("need_id").in("need_id", ids);
  for (const match of data ?? []) {
    counts.set(match.need_id, (counts.get(match.need_id) ?? 0) + 1);
  }
  return counts;
}

export async function listPublicNeeds(filters: NeedFilters = {}): Promise<PublicNeedRow[]> {
  let query = supabaseAdmin()
    .from("submissions")
    .select("id, org_or_name, district, province, urgency, status, skills, people_needed, created_at, fields")
    .eq("kind", "need")
    .in("status", PUBLISHED_STATUSES)
    .order("created_at", { ascending: false });

  if (filters.province) query = query.eq("province", filters.province);
  if (filters.district) query = query.eq("district", filters.district);
  // Overlap, not equality: a need lists several required skills and should
  // surface under any of them. Backed by the GIN index in migration 002.
  if (filters.skill) query = query.overlaps("skills", [filters.skill]);
  // The radio group stores the bare label ("Immediate"), not the display text
  // with its timeframe note, so the filter's option values match it exactly.
  if (filters.urgency) query = query.eq("urgency", filters.urgency);

  // "Community-reported" sits in the status dropdown because that is where a
  // reader looks for it, but it is not a status — it is who posted the need.
  if (filters.status === COMMUNITY_REPORTED) {
    query = query.eq(`fields->>${F.postingAs}`, "Individual");
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listPublicNeeds failed", error);
    return [];
  }

  const rows = (data ?? []) as Row[];
  const committed = await committedByNeed(rows.map((r) => r.id));
  return rows.map((row) => toRow(row, committed.get(row.id) ?? 0));
}

export async function getPublicNeed(id: string): Promise<PublicNeedDetail | null> {
  // A malformed id is a 404, not a 500: these come straight from the URL.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data } = await supabaseAdmin()
    .from("submissions")
    .select("id, org_or_name, district, province, urgency, status, skills, people_needed, created_at, fields")
    .eq("kind", "need")
    .eq("id", id)
    .in("status", PUBLISHED_STATUSES)
    .maybeSingle();

  if (!data) return null;
  const row = data as Row;

  const [committed, { count: interestCount }] = await Promise.all([
    committedByNeed([row.id]),
    supabaseAdmin().from("interests").select("id", { count: "exact", head: true }).eq("need_id", row.id),
  ]);

  return {
    ...toRow(row, committed.get(row.id) ?? 0),
    ward: str(row.fields, F.ward),
    resources: list(row.fields, F.resources),
    experience: str(row.fields, F.experience),
    whatToDo: str(row.fields, F.whatToDo),
    objectives: str(row.fields, F.objectives),
    startDate: str(row.fields, F.startDate),
    duration: str(row.fields, F.duration),
    deadline: str(row.fields, F.deadline),
    accommodation: str(row.fields, F.accommodation),
    food: str(row.fields, F.food),
    transport: str(row.fields, F.transport),
    equipment: str(row.fields, F.equipment),
    workMode: str(row.fields, F.workMode),
    paid: str(row.fields, F.paid),
    extra: str(row.fields, F.extra),
    interestCount: interestCount ?? 0,
  };
}

/** Human-readable location line, coarsest-first, skipping anything unanswered. */
export function needLocation(need: PublicNeedRow): string {
  return [need.municipality, need.district].filter(Boolean).join(" · ") || "—";
}

/** What the board's "Need" column shows: the skills asked for. */
export function needSummary(need: PublicNeedRow): string {
  return need.skills.length > 0 ? need.skills.join(", ") : (need.org ?? "—");
}
