import { readinessFor, type Readiness } from "./matching/readiness";
import type { Profile, Submission } from "./matching/types";
import { supabaseAdmin } from "./supabase";

/**
 * The volunteer's own view of where they stand: what is still outstanding,
 * what they have agreed to, and what they are currently committed to.
 *
 * Everything is filtered by a volunteer id the caller has already proved
 * belongs to the signed-in account. Nothing here takes an id from a request.
 */

export type OpenInvitation = {
  id: string;
  status: "queued" | "sent" | "accepted";
  roleTitle: string;
  needTitle: string;
  district: string | null;
  expiresAt: string;
  /** True once the response window has closed but the row has not been swept. */
  lapsed: boolean;
};

export type Commitment = {
  id: string;
  roleTitle: string;
  needTitle: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
};

export type Workspace = {
  readiness: Readiness;
  invitations: OpenInvitation[];
  commitments: Commitment[];
  /** Weekly hours already promised at the busiest overlapping point. */
  committedHours: number;
  /** False when the matching tables are not present (migration 010 unapplied). */
  available: boolean;
};

type InvitationRow = {
  id: string;
  status: string;
  expires_at: string;
  snapshot: Record<string, unknown> | null;
  matching_roles: { title: string | null } | { title: string | null }[] | null;
  submissions: { org_or_name: string | null; district: string | null; skills: string[] | null } | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function needTitle(need: InvitationRow["submissions"]): string {
  if (!need) return "—";
  if (need.skills?.length) return need.skills.join(", ");
  return need.org_or_name ?? "—";
}

/**
 * Peak simultaneous weekly hours across commitments.
 *
 * The same rule the engine uses: two commitments that do not overlap in time
 * do not add up. Summing them would tell someone they are full when they are
 * free, which is the difference between a volunteer being invited and not.
 */
export function peakWeeklyHours(commitments: Commitment[]): number {
  if (commitments.length === 0) return 0;
  const boundaries = commitments.map((c) => c.startDate);
  return Math.max(
    0,
    ...boundaries.map((date) =>
      commitments.reduce(
        (total, c) => total + (c.startDate <= date && c.endDate >= date ? c.hoursPerWeek : 0),
        0
      )
    )
  );
}

export async function loadWorkspace(
  volunteer: Submission,
  profile: Profile | null,
  now: number = Date.now()
): Promise<Workspace> {
  const readiness = readinessFor(volunteer, profile, now);
  const client = supabaseAdmin();

  const [invitationRes, commitmentRes] = await Promise.all([
    client
      .from("matching_invitations")
      .select(
        "id, status, expires_at, snapshot, matching_roles:role_id(title), submissions:need_id(org_or_name, district, skills)"
      )
      .eq("volunteer_id", volunteer.id)
      .in("status", ["queued", "sent", "accepted"])
      .order("created_at", { ascending: false }),
    client
      .from("matching_commitments")
      .select(
        "match_id, start_date, end_date, hours_per_week, matching_roles:role_id(title), matching_invitations:invitation_id(volunteer_id, need_id)"
      ),
  ]);

  // Missing matching tables is a configuration state, not an error to show a
  // volunteer. The page hides the whole panel rather than reporting a fault
  // they cannot act on.
  if (invitationRes.error || commitmentRes.error) {
    console.error("workspace read failed", invitationRes.error ?? commitmentRes.error);
    return { readiness, invitations: [], commitments: [], committedHours: 0, available: false };
  }

  const invitations: OpenInvitation[] = ((invitationRes.data ?? []) as unknown as InvitationRow[]).map(
    (row) => {
      const role = one(row.matching_roles);
      return {
        id: row.id,
        status: row.status as OpenInvitation["status"],
        roleTitle: role?.title ?? "—",
        needTitle: needTitle(one(row.submissions)),
        district: one(row.submissions)?.district ?? null,
        expiresAt: row.expires_at,
        lapsed: Date.parse(row.expires_at) < now,
      };
    }
  );

  type CommitmentRow = {
    match_id: string;
    start_date: string;
    end_date: string;
    hours_per_week: number;
    matching_roles: { title: string | null } | { title: string | null }[] | null;
    matching_invitations:
      | { volunteer_id: string; need_id: string }
      | { volunteer_id: string; need_id: string }[]
      | null;
  };

  // Commitments join through the invitation, so they are filtered here rather
  // than in the query — PostgREST cannot filter on an embedded resource
  // without dropping rows whose embed is null.
  const commitments: Commitment[] = ((commitmentRes.data ?? []) as unknown as CommitmentRow[])
    .filter((row) => one(row.matching_invitations)?.volunteer_id === volunteer.id)
    .map((row) => ({
      id: row.match_id,
      roleTitle: one(row.matching_roles)?.title ?? "—",
      needTitle: "—",
      startDate: row.start_date,
      endDate: row.end_date,
      hoursPerWeek: row.hours_per_week,
    }));

  return {
    readiness,
    invitations,
    commitments,
    committedHours: peakWeeklyHours(commitments),
    available: true,
  };
}
