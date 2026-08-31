import { renderSubmissionFields, type RenderedSection } from "./admin-render";
import { fieldKey, VOLUNTEER_SECTIONS } from "./form-schema";
import { PUBLISHED_STATUSES } from "./public-needs";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";

/**
 * The read layer behind /[lang]/profile.
 *
 * Security model, in one sentence: the only input this module accepts is the
 * session cookie. Who is asking comes from `auth.getUser()` server-side, and
 * every query is filtered by that user's id — there is no parameter a caller
 * could vary to read someone else's registration. Data access goes through
 * `supabaseAdmin()` (service role) like the rest of the app: no RLS policies,
 * no anon/authenticated grants — see supabase/003-service-role-grants.sql.
 *
 * Registrations with `user_id IS NULL` (made before accounts existed) are
 * simply never returned here — `eq("user_id", …)` cannot match NULL — and are
 * never written to. A signed-in user without a claimed registration is a
 * normal state this module reports, not an error.
 */

export type InterestedNeed = {
  id: string;
  /** What the needs board calls the need: its skills, falling back to the org. */
  title: string;
  district: string | null;
  status: string;
  /** Only published needs get a link — the public detail page 404s otherwise. */
  published: boolean;
};

export type Completeness = { answered: number; total: number; percent: number };

export type VolunteerRegistration = {
  id: string;
  name: string | null;
  district: string | null;
  primarySkill: string | null;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  /** The person's answers, labelled and grouped like the form they filled in. */
  sections: RenderedSection[];
  completeness: Completeness;
  interests: InterestedNeed[];
};

export type VolunteerProfile =
  | { state: "signed-out" }
  | { state: "no-registration"; email: string | null }
  | { state: "registered"; email: string | null; registration: VolunteerRegistration };

const PRIMARY_SKILL_KEY = fieldKey("03", "Primary skill");

type SubmissionRow = {
  id: string;
  org_or_name: string | null;
  district: string | null;
  status: string;
  fields: Record<string, unknown>;
  created_at: string;
  verified_at: string | null;
};

export async function getVolunteerProfile(): Promise<VolunteerProfile> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out" };

  const email = user.email ?? null;

  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select(
      "id, org_or_name, district, status, fields, created_at, verified_at"
    )
    .eq("kind", "volunteer")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // A read fault should degrade to the empty state, not a 500: the page
    // stays useful (it still links to the form) and the log says why.
    console.error("volunteer profile read failed", error);
    return { state: "no-registration", email };
  }
  if (!data) return { state: "no-registration", email };

  const row = data as SubmissionRow;
  const sections = renderSubmissionFields(row.fields, VOLUNTEER_SECTIONS);

  return {
    state: "registered",
    email,
    registration: {
      id: row.id,
      name: row.org_or_name,
      district: row.district,
      primarySkill: firstString(row.fields[PRIMARY_SKILL_KEY]),
      status: row.status,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
      sections,
      completeness: completenessOf(sections),
      interests: await needsOfInterest(user.id),
    },
  };
}

/**
 * Answered fields over total fields in the volunteer form schema.
 *
 * "Answered" is exactly what `renderSubmissionFields` kept: both sides of the
 * fraction come from the same emptiness rule, so the meter cannot disagree
 * with the rows shown below it.
 */
function completenessOf(sections: RenderedSection[]): Completeness {
  const total = VOLUNTEER_SECTIONS.reduce((n, section) => n + section.fields.length, 0);
  const answered = sections.reduce((n, section) => n + section.rows.length, 0);
  return { answered, total, percent: total === 0 ? 0 : Math.round((answered / total) * 100) };
}

/**
 * Needs this person has expressed interest in.
 *
 * Matched on `interests.user_id` and nothing else. This used to compare a
 * normalised version of the contact someone typed against the registration's
 * email and phone, which meant two people sharing a phone number — ordinary
 * where a household has one — each saw the other's interests on their own
 * profile. Need ids are public and no contact details were rendered, so little
 * was exposed, but "the needs you offered to help with" has to be true of the
 * person reading it.
 *
 * The cost is that an interest expressed while signed out is not attributed to
 * anyone, and so appears on no profile. That is the honest outcome: at the time
 * it was recorded there was no account to attach it to, and inferring one after
 * the fact is exactly the guess being removed here.
 */
async function needsOfInterest(userId: string): Promise<InterestedNeed[]> {
  const { data: interestRows } = await supabaseAdmin()
    .from("interests")
    .select("need_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const needIds: string[] = [];
  for (const row of interestRows ?? []) {
    if (!needIds.includes(row.need_id)) needIds.push(row.need_id);
  }
  if (needIds.length === 0) return [];

  const { data: needs } = await supabaseAdmin()
    .from("submissions")
    .select("id, org_or_name, district, skills, status")
    .eq("kind", "need")
    .in("id", needIds);

  type NeedRow = {
    id: string;
    org_or_name: string | null;
    district: string | null;
    skills: string[] | null;
    status: string;
  };
  const byId = new Map(((needs ?? []) as NeedRow[]).map((need) => [need.id, need] as const));

  // Keep the interest order (most recent first), not the query's row order.
  return needIds.flatMap((id) => {
    const need = byId.get(id);
    if (!need) return [];
    return [
      {
        id: need.id,
        title: need.skills?.length ? need.skills.join(", ") : (need.org_or_name ?? "—"),
        district: need.district,
        status: need.status,
        published: (PUBLISHED_STATUSES as readonly string[]).includes(need.status),
      },
    ];
  });
}


function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}
