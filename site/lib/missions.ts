import { supabaseAdmin } from "./supabase";
import { currentVolunteer } from "./volunteer-auth";
import { errorFields, logError } from "./log";

/**
 * Mission teams: the read layer, and the rules about who may change what.
 *
 * A mission is an interest signal, not a qualification. Selecting one says "I
 * would like to work on this"; it proves nothing about competence, grants no
 * admin rights, and — unless the volunteer explicitly narrows their scope —
 * does not remove them from consideration for other suitable work. The
 * matching engine already treats it that way: missions break ties between
 * equally-qualified people rather than acting as a filter.
 */

/** The cap the database enforces. Repeated here so the UI can say it first. */
export const MAX_MISSIONS = 2;

export type MissionSource = "email_reply" | "self_selected" | "admin_recorded";
export type PreferenceState = "interested" | "mission_only";

export type Mission = {
  id: string;
  title: string;
  summary: string;
  purpose: string | null;
  currentTask: string | null;
  leadName: string | null;
  meetingLink: string | null;
  nextCheckIn: string | null;
  status: "active" | "paused" | "closed";
  members: number;
};

export type MissionMembership = {
  missionId: string;
  preferenceState: PreferenceState;
  source: MissionSource;
  createdAt: string;
};

export type MissionViewer = {
  signedIn: boolean;
  /** The volunteer submission this account claimed, if any. */
  volunteerId: string | null;
  memberships: MissionMembership[];
  missionOnly: boolean;
  /** False once the cap is reached — the UI disables rather than fails. */
  canJoinMore: boolean;
};

type MissionRow = {
  id: string;
  title: string;
  summary: string;
  purpose: string | null;
  current_task: string | null;
  lead_user_id: string | null;
  meeting_link: string | null;
  next_check_in: string | null;
  status: string;
  sort_order: number;
};

function toMission(row: MissionRow, members: number, leadName: string | null): Mission {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    // Empty rather than invented. A mission page that shows a "current task"
    // nobody entered sends someone to work that does not exist.
    purpose: row.purpose?.trim() || null,
    currentTask: row.current_task?.trim() || null,
    leadName,
    meetingLink: row.meeting_link?.trim() || null,
    nextCheckIn: row.next_check_in,
    status: (row.status as Mission["status"]) ?? "active",
    members,
  };
}

/** How many volunteers have opted into each mission. */
async function memberCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const { data } = await supabaseAdmin().from("mission_members").select("mission_id");
  for (const row of (data ?? []) as Array<{ mission_id: string }>) {
    counts.set(row.mission_id, (counts.get(row.mission_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Display names for mission leads.
 *
 * Read from the admin allowlist rather than `auth.users`, so a lead is
 * identified by the same name the Team page shows and no auth record is
 * exposed to a public page. A lead with no allowlist row is simply unnamed.
 */
async function leadNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id, email")
    .in("user_id", ids);
  for (const row of (data ?? []) as Array<{ user_id: string; email: string | null }>) {
    if (row.email) names.set(row.user_id, row.email);
  }
  return names;
}

export async function listMissions(): Promise<Mission[]> {
  const { data, error } = await supabaseAdmin()
    .from("missions")
    .select(
      "id, title, summary, purpose, current_task, lead_user_id, meeting_link, next_check_in, status, sort_order"
    )
    .order("sort_order");

  if (error) {
    logError("listmissions_failed", errorFields(error));
    return [];
  }

  const rows = (data ?? []) as MissionRow[];
  const [counts, names] = await Promise.all([
    memberCounts(),
    leadNames(rows.map((r) => r.lead_user_id).filter((id): id is string => Boolean(id))),
  ]);

  return rows.map((row) =>
    toMission(row, counts.get(row.id) ?? 0, row.lead_user_id ? (names.get(row.lead_user_id) ?? null) : null)
  );
}

export async function getMission(id: string): Promise<Mission | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return null;

  const { data } = await supabaseAdmin()
    .from("missions")
    .select(
      "id, title, summary, purpose, current_task, lead_user_id, meeting_link, next_check_in, status, sort_order"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  const row = data as MissionRow;

  const [counts, names] = await Promise.all([
    memberCounts(),
    leadNames(row.lead_user_id ? [row.lead_user_id] : []),
  ]);

  return toMission(
    row,
    counts.get(row.id) ?? 0,
    row.lead_user_id ? (names.get(row.lead_user_id) ?? null) : null
  );
}

/**
 * What the signed-in person may do on the missions pages.
 *
 * Identity comes from the session cookie only. A signed-in account with no
 * claimed registration is a normal state — they are told to register, not
 * shown a broken picker.
 */
export async function missionViewer(): Promise<MissionViewer> {
  const empty: MissionViewer = {
    signedIn: false,
    volunteerId: null,
    memberships: [],
    missionOnly: false,
    canJoinMore: false,
  };

  const user = await currentVolunteer();
  if (!user) return empty;

  const { data: registration } = await supabaseAdmin()
    .from("submissions")
    .select("id")
    .eq("kind", "volunteer")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!registration) return { ...empty, signedIn: true };

  const { data } = await supabaseAdmin()
    .from("mission_members")
    .select("mission_id, preference_state, source, created_at")
    .eq("volunteer_id", registration.id)
    .order("created_at");

  const memberships = ((data ?? []) as Array<{
    mission_id: string;
    preference_state: PreferenceState;
    source: MissionSource;
    created_at: string;
  }>).map((row) => ({
    missionId: row.mission_id,
    preferenceState: row.preference_state,
    source: row.source,
    createdAt: row.created_at,
  }));

  return {
    signedIn: true,
    volunteerId: registration.id,
    memberships,
    // One volunteer-level switch, even though the state is stored per
    // membership: "only invite me within my missions" is a statement about
    // the person's whole scope, not about one team.
    missionOnly: memberships.some((m) => m.preferenceState === "mission_only"),
    canJoinMore: memberships.length < MAX_MISSIONS,
  };
}

/**
 * Selection order carries no meaning.
 *
 * The design shows two slots side by side, which invites reading the first as
 * a first choice. Nothing downstream ranks them: the engine treats any
 * matching mission the same way, so the pages sort by the mission's own order
 * rather than by when someone joined.
 */
export function sortedMemberships(
  memberships: MissionMembership[],
  missions: Mission[]
): MissionMembership[] {
  const order = new Map(missions.map((m, i) => [m.id, i]));
  return [...memberships].sort(
    (a, b) => (order.get(a.missionId) ?? 0) - (order.get(b.missionId) ?? 0)
  );
}
