import { N3 } from "./intake-schema";
import { canAcceptInterest, isPublicStatus } from "./publication";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";
import { errorFields, logError } from "./log";

/**
 * The requester's own view of the request they filed.
 *
 * Until now a person submitted a need and heard nothing: no status, no way to
 * correct a mistake, no way to close it when the problem was solved another
 * way, and no way to say whether the help that arrived was any use. Every one
 * of those was a message a coordinator had to carry by hand, and the ones
 * nobody carried were simply lost.
 *
 * Access is the same proof volunteers use — a code to the mailbox on the
 * request, then `submissions.user_id`. Nothing here accepts an id from a
 * request; the row is always found *from* the session.
 */

/** Statuses a requester may act on, and what each one means to them. */
export type RequestStage =
  | "submitted"
  | "under_review"
  | "verified"
  | "recruiting"
  | "filled"
  | "completed"
  | "rejected";

export type ProposedVolunteer = {
  /** Never a name or a contact detail — see the note in `listProposed`. */
  summary: string;
  status: string;
  respondedAt: string | null;
};

export type RequestEvent = {
  id: string;
  actor: "requester" | "coordinator" | "system";
  event: string;
  detail: string | null;
  createdAt: string;
};

export type RequesterView = {
  id: string;
  /** The short code shown on the confirmation page. */
  reference: string;
  version: number;
  title: string | null;
  detail: string | null;
  district: string | null;
  urgency: string | null;
  status: RequestStage;
  createdAt: string;
  /** True while the request is still collecting help. */
  open: boolean;
  published: boolean;
  assisted: boolean;
  coordinator: string | null;
  proposed: ProposedVolunteer[];
  events: RequestEvent[];
};

export type RequesterState =
  | { state: "signed-out" }
  | { state: "no-request"; email: string | null }
  | { state: "unavailable"; email: string | null }
  | { state: "ready"; email: string | null; request: RequesterView };

export function referenceFor(id: string): string {
  return id.split("-")[0].toUpperCase();
}

function str(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Summaries of the volunteers a coordinator has approached, with no names and
 * no contact details.
 *
 * The requester needs to know that people are being found and where each one
 * has got to. They do not need — and must not be given — a roster of who was
 * approached and declined: those are people who said no to a stranger's
 * request, and publishing that back would make declining costly.
 */
async function listProposed(needId: string): Promise<ProposedVolunteer[]> {
  const { data, error } = await supabaseAdmin()
    .from("matching_invitations")
    .select("status, responded_at, matching_roles:role_id(title)")
    .eq("need_id", needId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return ((data ?? []) as Array<{
    status: string;
    responded_at: string | null;
    matching_roles: { title: string | null } | { title: string | null }[] | null;
  }>).map((row) => {
    const role = Array.isArray(row.matching_roles) ? row.matching_roles[0] : row.matching_roles;
    return {
      summary: role?.title ?? "A volunteer",
      status: row.status,
      respondedAt: row.responded_at,
    };
  });
}

async function listEvents(needId: string): Promise<RequestEvent[]> {
  const { data, error } = await supabaseAdmin()
    .from("request_events")
    .select("id, actor, event, detail, created_at")
    .eq("submission_id", needId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];

  return ((data ?? []) as Array<{
    id: string;
    actor: RequestEvent["actor"];
    event: string;
    detail: string | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    actor: row.actor,
    event: row.event,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}

export async function getRequesterView(): Promise<RequesterState> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out" };

  const email = user.email ?? null;

  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .select("id, status, district, urgency, fields, created_at, version, verified_by")
    .eq("kind", "need")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Not "you have no request". Telling someone who filed one that they did
    // not is how a second request gets filed for the same problem.
    logError("requester_view_read_failed", errorFields(error));
    return { state: "unavailable", email };
  }
  if (!data) return { state: "no-request", email };

  const fields = (data.fields ?? {}) as Record<string, unknown>;

  const [proposed, events, coordinator] = await Promise.all([
    listProposed(data.id),
    listEvents(data.id),
    coordinatorName(data.verified_by),
  ]);

  return {
    state: "ready",
    email,
    request: {
      id: data.id,
      reference: referenceFor(data.id),
      version: data.version ?? 1,
      title: str(fields, N3.title),
      detail: str(fields, N3.detail) ?? str(fields, "s04-exactly-what-needs-to-be-done"),
      district: data.district,
      urgency: data.urgency,
      status: data.status as RequestStage,
      createdAt: data.created_at,
      open: canAcceptInterest(data.status),
      published: isPublicStatus(data.status),
      assisted: str(fields, N3.assist) === "on",
      coordinator,
      proposed,
      events,
    },
  };
}

/** The coordinator who verified this request, by the name the Team page uses. */
async function coordinatorName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.email ?? null;
}

/**
 * The request the signed-in person owns, or null.
 *
 * Every write path calls this rather than trusting an id from the form. A
 * submission id in a request body is a claim, never an authorisation.
 */
export async function ownedRequest(): Promise<{ id: string; status: string; version: number } | null> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabaseAdmin()
    .from("submissions")
    .select("id, status, version")
    .eq("kind", "need")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { id: data.id, status: data.status, version: data.version ?? 1 } : null;
}
