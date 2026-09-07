import { ok, unavailable, type ReadResult } from "../publication";
import { supabaseAdmin } from "../supabase";
import { missingMigration } from "../matching/data";
import {
  applyAssignments,
  deriveQueueItems,
  filterQueueItems,
  paginateQueue,
  sortQueueItems,
} from "./derive";
import { metricsView, type QueueMetricsView } from "./metrics";
import { PAGE_SIZE } from "./types";
import type {
  Coordinator,
  EventRow,
  InvitationRow,
  ItemNeedRow,
  NeedRow,
  OutboxRow,
  ProfileRow,
  QueueAssignment,
  QueueEvent,
  QueueItem,
  QueueQuery,
  QueueSnapshot,
  QueueSources,
  RoleRow,
  VolunteerRow,
} from "./types";

type DbError = { code?: string; message: string };
type QueryResult<T> =
  | { state: "ok"; data: T }
  | { state: "missing" }
  | { state: "error"; reason: string };

async function collect<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>,
  required: boolean
): Promise<QueryResult<T[]>> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error && missingMigration(error)) {
      return required
        ? { state: "error", reason: `Required table is missing (${error.code ?? "unknown"}).` }
        : { state: "missing" };
    }
    if (error) return { state: "error", reason: error.message };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 500) return { state: "ok", data: rows };
  }
}

function valueOrEmpty<T>(result: QueryResult<T[]>): T[] {
  return result.state === "ok" ? result.data : [];
}

/**
 * Load every source the queue is derived from.
 *
 * A failed read of a required table is unavailable — never an empty list.
 * Matching, requester events and the assignment overlay are optional features:
 * if their tables have not been migrated yet, those item types are simply
 * absent, which is different from the database being unreachable.
 */
export async function loadQueueSources(): Promise<
  ReadResult<
    QueueSources & {
      assignments: QueueAssignment[];
      coordinators: Coordinator[];
      assignmentsAvailable: boolean;
      matchingAvailable: boolean;
      requesterEventsAvailable: boolean;
    }
  >
> {
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const [
    allNeeds,
    invitations,
    roles,
    volunteers,
    profiles,
    events,
    outbox,
    itemNeeds,
    pledged,
    assignments,
    coordinators,
  ] = await Promise.all([
    collect<NeedRow>(
      (from, to) =>
        db
          .from("submissions")
          .select("id, status, org_or_name, district, urgency, skills, fields, created_at")
          .eq("kind", "need")
          .order("id")
          .range(from, to),
      true
    ),
    collect<InvitationRow>(
      (from, to) =>
        db
          .from("matching_invitations")
          .select("id, status, need_id, volunteer_id, role_id, created_at, expires_at, responded_at")
          .in("status", ["accepted", "queued", "sent"])
          .order("id")
          .range(from, to),
      false
    ),
    collect<RoleRow>(
      (from, to) => db.from("matching_roles").select("id, need_id, title, config").order("id").range(from, to),
      false
    ),
    collect<VolunteerRow>(
      (from, to) =>
        db.from("submissions").select("id, org_or_name").eq("kind", "volunteer").order("id").range(from, to),
      true
    ),
    collect<ProfileRow>(
      (from, to) =>
        db
          .from("matching_profiles")
          .select("volunteer_id, paused, confirmed_at, facts, mission_ids")
          .order("volunteer_id")
          .range(from, to),
      false
    ),
    collect<EventRow>(
      (from, to) =>
        db
          .from("request_events")
          .select("id, submission_id, actor, event, detail, created_at")
          .order("id")
          .range(from, to),
      false
    ),
    collect<OutboxRow>(
      (from, to) =>
        db
          .from("matching_email_outbox")
          .select("id, invitation_id, kind, status, last_error, created_at")
          .in("status", ["failed", "pending"])
          .order("id")
          .range(from, to),
      false
    ),
    collect<Omit<ItemNeedRow, "pledged">>(
      (from, to) =>
        db
          .from("item_needs")
          .select("id, category, quantity, district, needed_by, requester, detail, created_at")
          .order("id")
          .range(from, to),
      true
    ),
    collect<{ item_need_id: string; pledged: number }>(
      (from, to) => db.from("item_need_pledged").select("item_need_id, pledged").order("item_need_id").range(from, to),
      true
    ),
    collect<QueueAssignment>(
      (from, to) => db.from("queue_assignments").select("*").order("item_key").range(from, to),
      false
    ),
    collect<{ user_id: string; email: string | null }>(
      (from, to) => db.from("admin_users").select("user_id, email").order("user_id").range(from, to),
      true
    ),
  ]);

  const required = [allNeeds, volunteers, itemNeeds, pledged, coordinators];
  const failed = required.find((result) => result.state === "error");
  if (failed && failed.state === "error") return unavailable(failed.reason);

  const optional = [invitations, roles, profiles, events, outbox, assignments];
  const optionalFailed = optional.find((result) => result.state === "error");
  if (optionalFailed && optionalFailed.state === "error") return unavailable(optionalFailed.reason);

  const needs = valueOrEmpty(allNeeds);
  const pledgedById = new Map(
    valueOrEmpty(pledged).map((row) => [row.item_need_id, Number(row.pledged) || 0])
  );

  const team: Coordinator[] = valueOrEmpty(coordinators)
    .map((row) => ({ id: row.user_id, email: row.email?.trim() || "" }))
    .filter((row) => row.email)
    .sort((a, b) => a.email.localeCompare(b.email));

  return ok({
    now,
    needs: needs.filter((row) => row.status === "submitted" || row.status === "under_review"),
    relatedNeeds: needs,
    invitations: valueOrEmpty(invitations),
    roles: valueOrEmpty(roles),
    volunteers: valueOrEmpty(volunteers),
    profiles: valueOrEmpty(profiles),
    events: valueOrEmpty(events),
    outbox: valueOrEmpty(outbox),
    itemNeeds: valueOrEmpty(itemNeeds).map((row) => ({
      ...row,
      pledged: pledgedById.get(row.id) ?? 0,
    })),
    assignments: valueOrEmpty(assignments),
    coordinators: team,
    assignmentsAvailable: assignments.state === "ok",
    matchingAvailable: invitations.state === "ok" && profiles.state === "ok",
    requesterEventsAvailable: events.state === "ok",
  });
}

export type LoadedQueue = {
  snapshot: QueueSnapshot;
  metrics: QueueMetricsView;
  visible: QueueItem[];
  page: number;
  pages: number;
  total: number;
  now: string;
  coordinators: Coordinator[];
  events: QueueEvent[];
};

export function assembleQueue(
  sources: QueueSources,
  assignments: QueueAssignment[],
  coordinators: Coordinator[],
  flags: Pick<QueueSnapshot, "assignmentsAvailable" | "matchingAvailable" | "requesterEventsAvailable">
): QueueSnapshot {
  const derived = deriveQueueItems(sources);
  const items = applyAssignments(derived, assignments, coordinators, sources.now);
  return { items, ...flags };
}

export function selectQueuePage(
  snapshot: QueueSnapshot,
  query: QueueQuery,
  nowIso: string
): { visible: QueueItem[]; page: number; pages: number; total: number } {
  const filtered = sortQueueItems(filterQueueItems(snapshot.items, query, nowIso));
  const paged = paginateQueue(filtered, query.page, PAGE_SIZE);
  return { visible: paged.rows, page: paged.page, pages: paged.pages, total: paged.total };
}

export async function loadQueue(query: QueueQuery): Promise<ReadResult<LoadedQueue>> {
  const loaded = await loadQueueSources();
  if (loaded.state === "unavailable") return loaded;

  const { assignments, coordinators, assignmentsAvailable, matchingAvailable, requesterEventsAvailable, ...sources } =
    loaded.data;
  const snapshot = assembleQueue(sources, assignments, coordinators, {
    assignmentsAvailable,
    matchingAvailable,
    requesterEventsAvailable,
  });
  const page = selectQueuePage(snapshot, query, sources.now);
  const events = await loadEventsFor(
    page.visible.map((item) => item.key),
    assignmentsAvailable
  );
  if (events.state === "unavailable") return events;

  return ok({
    snapshot,
    metrics: metricsView(ok(snapshot), sources.now),
    ...page,
    now: sources.now,
    coordinators,
    events: events.data,
  });
}

async function loadEventsFor(keys: string[], available: boolean): Promise<ReadResult<QueueEvent[]>> {
  if (!available || keys.length === 0) return ok([]);
  const { data, error } = await supabaseAdmin()
    .from("queue_events")
    .select("id, item_key, actor_id, event, detail, created_at")
    .in("item_key", keys)
    .order("created_at", { ascending: false });
  if (error && missingMigration(error)) return ok([]);
  if (error) return unavailable(error.message);
  return ok((data ?? []) as QueueEvent[]);
}
