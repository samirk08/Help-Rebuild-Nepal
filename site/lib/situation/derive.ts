import { NOT_SPECIFIED } from "../publication";
import { itemKey } from "./keys";
import {
  EXPIRING_WITHIN_MS,
  ITEM_NEAR_DAYS,
  QUEUE_PRIORITIES,
  STALE_PROFILE_DAYS,
  STUCK_EMAIL_MS,
  type Coordinator,
  type DerivedItem,
  type EventRow,
  type NeedRow,
  type QueueAssignment,
  type QueueItem,
  type QueuePriority,
  type QueueQuery,
  type QueueSources,
  type QueueState,
} from "./types";

const PRIORITY_RANK: Record<QueuePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function named(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_SPECIFIED;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86400000).toISOString();
}

function endOfDay(date: string): string {
  const day = date.slice(0, 10);
  return `${day}T23:59:59.000Z`;
}

function needTitle(need: NeedRow | undefined): string {
  const fields = need?.fields;
  const fromFields = typeof fields?.["n3-title"] === "string" ? fields["n3-title"] : "";
  return named(fromFields || need?.org_or_name);
}

function needHref(id: string): string {
  return `/admin/needs/${id}`;
}

function urgencyPriority(urgency: string | null): QueuePriority {
  const value = (urgency ?? "").toLowerCase();
  if (value.includes("immediate")) return "urgent";
  if (value.includes("urgent")) return "urgent";
  if (value.includes("upcoming")) return "high";
  return "normal";
}

function searchBlob(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Facts that belong in the queue, before anyone has assigned, snoozed or
 * resolved them. Pure: the same rows always produce the same keys.
 */
export function deriveQueueItems(sources: QueueSources): DerivedItem[] {
  const now = Date.parse(sources.now);
  const items: DerivedItem[] = [];
  const needs = byId([...sources.needs, ...sources.relatedNeeds]);
  const roles = byId(sources.roles);
  const volunteers = byId(sources.volunteers);

  for (const need of sources.needs) {
    if (need.status !== "submitted" && need.status !== "under_review") continue;
    const subject = `${needTitle(need)} (${named(need.district)})`;
    items.push({
      key: itemKey("need_verify", need.id),
      kind: "need_verify",
      recordId: need.id,
      href: needHref(need.id),
      subject,
      nextAction: "Review and verify or reject this need",
      waitingSince: need.created_at,
      derivedDueAt: addDays(need.created_at, urgencyPriority(need.urgency) === "urgent" ? 1 : 2),
      derivedPriority: urgencyPriority(need.urgency),
      skills: need.skills ?? [],
      missionIds: [],
      searchText: searchBlob([subject, need.status, need.urgency, need.org_or_name, ...(need.skills ?? [])]),
    });
  }

  for (const invite of sources.invitations) {
    const role = roles.get(invite.role_id);
    const volunteer = volunteers.get(invite.volunteer_id);
    const need = needs.get(invite.need_id);
    const roleTitle = named(role?.title);
    const volunteerName = named(volunteer?.org_or_name);
    const skills = role?.config.skills?.filter((s): s is string => typeof s === "string") ?? [];
    const missionIds = role?.config.missionIds?.filter((s): s is string => typeof s === "string") ?? [];

    if (invite.status === "accepted") {
      const subject = `Accepted: ${roleTitle} — ${volunteerName}`;
      items.push({
        key: itemKey("invite_accepted", invite.id),
        kind: "invite_accepted",
        recordId: invite.id,
        href: needHref(invite.need_id),
        subject,
        nextAction: "Coordinate both-party confirmation",
        waitingSince: invite.responded_at ?? invite.created_at,
        derivedDueAt: invite.responded_at ?? invite.created_at,
        derivedPriority: "high",
        skills,
        missionIds,
        searchText: searchBlob([subject, needTitle(need), volunteerName, roleTitle]),
      });
    }

    if (invite.status === "queued" || invite.status === "sent") {
      const expires = Date.parse(invite.expires_at);
      if (!Number.isFinite(expires) || expires >= now + EXPIRING_WITHIN_MS) continue;
      const entered = Math.max(Date.parse(invite.created_at), expires - EXPIRING_WITHIN_MS);
      const overdue = expires <= now;
      const subject = `${overdue ? "Expired" : "Expiring"}: ${roleTitle} — ${volunteerName}`;
      items.push({
        key: itemKey("invite_expiring", invite.id),
        kind: "invite_expiring",
        recordId: invite.id,
        href: needHref(invite.need_id),
        subject,
        nextAction: overdue
          ? "Close or renew this expired invitation"
          : "Follow up before the invitation expires",
        waitingSince: new Date(entered).toISOString(),
        derivedDueAt: invite.expires_at,
        derivedPriority: overdue ? "urgent" : "high",
        skills,
        missionIds,
        searchText: searchBlob([subject, needTitle(need), volunteerName, roleTitle, invite.status]),
      });
    }
  }

  const staleBefore = now - STALE_PROFILE_DAYS * 86400000;
  for (const profile of sources.profiles) {
    if (profile.paused) continue;
    const confirmed = Date.parse(profile.confirmed_at);
    if (!Number.isFinite(confirmed) || confirmed >= staleBefore) continue;
    const volunteer = volunteers.get(profile.volunteer_id);
    const subject = `Availability unconfirmed: ${named(volunteer?.org_or_name)}`;
    const skills = profile.facts?.skills?.filter((s): s is string => typeof s === "string") ?? [];
    items.push({
      key: itemKey("profile_stale", profile.volunteer_id),
      kind: "profile_stale",
      recordId: profile.volunteer_id,
      href: `/admin/volunteers/${profile.volunteer_id}`,
      subject,
      nextAction: "Ask the volunteer to confirm current availability",
      waitingSince: addDays(profile.confirmed_at, STALE_PROFILE_DAYS),
      derivedDueAt: addDays(profile.confirmed_at, STALE_PROFILE_DAYS),
      derivedPriority: "normal",
      skills,
      missionIds: profile.mission_ids ?? [],
      searchText: searchBlob([subject, volunteer?.org_or_name, ...skills]),
    });
  }

  items.push(...deriveUnacknowledgedEvents(sources.events, needs));

  const invites = byId(sources.invitations);
  for (const mail of sources.outbox) {
    const created = Date.parse(mail.created_at);
    const stuckPending = mail.status === "pending" && Number.isFinite(created) && created < now - STUCK_EMAIL_MS;
    if (mail.status !== "failed" && !stuckPending) continue;
    // Nullable since migration 017 — a clarification email has a question,
    // not an invitation, behind it.
    const invite = mail.invitation_id ? invites.get(mail.invitation_id) : undefined;
    const subject = `${mail.kind} email ${mail.status}${mail.last_error ? ` — ${mail.last_error}` : ""}`;
    items.push({
      key: itemKey("email_stuck", mail.id),
      kind: "email_stuck",
      recordId: mail.id,
      href: invite ? needHref(invite.need_id) : "/admin/diagnostics",
      subject,
      nextAction: "Inspect the failed or stuck email and retry or cancel it",
      waitingSince: mail.created_at,
      derivedDueAt: addDays(mail.created_at, 0),
      derivedPriority: "high",
      skills: [],
      missionIds: [],
      searchText: searchBlob([subject, mail.kind, mail.status, mail.last_error]),
    });
  }

  // A question the engine generated, sent to a volunteer, and still waiting.
  // Before migration 017 there was nothing to derive this from: the engine
  // produced the question, a coordinator retyped it into an email by hand, and
  // the answer never came back into the system.
  for (const question of sources.questions) {
    if (question.state !== "open") continue;
    const volunteer = volunteers.get(question.volunteer_id);
    const subject = `Waiting on an answer: ${question.question}`;
    items.push({
      key: itemKey("unanswered_question", question.id),
      kind: "unanswered_question",
      recordId: question.id,
      href: `/admin/volunteers/${question.volunteer_id}`,
      subject,
      nextAction: "Chase the answer, or withdraw the question if it no longer matters",
      waitingSince: question.asked_at,
      derivedDueAt: addDays(question.asked_at, 3),
      derivedPriority: "normal",
      skills: [],
      missionIds: [],
      searchText: searchBlob([subject, question.check_key, volunteer?.org_or_name]),
    });
  }

  const nearUntil = now + ITEM_NEAR_DAYS * 86400000;
  for (const item of sources.itemNeeds) {
    if (item.pledged >= item.quantity) continue;
    const needed = Date.parse(`${item.needed_by.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(needed) || needed > nearUntil) continue;
    const remaining = item.quantity - item.pledged;
    const subject = `${item.category}: ${remaining} still needed in ${named(item.district)}`;
    items.push({
      key: itemKey("item_unpledged", item.id),
      kind: "item_unpledged",
      recordId: item.id,
      href: "/admin/relief",
      subject,
      nextAction: "Find pledges or revise this item need",
      waitingSince: item.created_at,
      derivedDueAt: endOfDay(item.needed_by),
      derivedPriority: needed <= now ? "urgent" : "high",
      skills: [],
      missionIds: [],
      searchText: searchBlob([subject, item.category, item.district, item.requester, item.detail]),
    });
  }

  return items;
}

function latestOf(
  events: EventRow[],
  match: (event: EventRow) => boolean
): Map<string, EventRow> {
  const latest = new Map<string, EventRow>();
  for (const event of events) {
    if (!match(event)) continue;
    const current = latest.get(event.submission_id);
    if (!current || Date.parse(event.created_at) >= Date.parse(current.created_at)) {
      latest.set(event.submission_id, event);
    }
  }
  return latest;
}

function laterCoordinator(events: EventRow[], after: EventRow): boolean {
  return events.some(
    (event) =>
      event.submission_id === after.submission_id &&
      event.actor === "coordinator" &&
      Date.parse(event.created_at) > Date.parse(after.created_at)
  );
}

function deriveUnacknowledgedEvents(events: EventRow[], needs: Map<string, NeedRow>): DerivedItem[] {
  const items: DerivedItem[] = [];

  const push = (
    event: EventRow,
    kind: DerivedItem["kind"],
    subject: string,
    nextAction: string,
    priority: QueuePriority
  ) => {
    if (laterCoordinator(events, event)) return;
    const need = needs.get(event.submission_id);
    items.push({
      key: itemKey(kind, event.id),
      kind,
      recordId: event.id,
      href: needHref(event.submission_id),
      subject: `${subject} — ${needTitle(need)}`,
      nextAction,
      waitingSince: event.created_at,
      derivedDueAt: addDays(event.created_at, 1),
      derivedPriority: priority,
      skills: need?.skills ?? [],
      missionIds: [],
      searchText: searchBlob([subject, needTitle(need), event.event, event.detail, need?.org_or_name]),
    });
  };

  for (const event of latestOf(events, (e) => e.event.startsWith("outcome_")).values()) {
    const label =
      event.event === "outcome_yes"
        ? "Requester says the support met the need"
        : event.event === "outcome_partly"
          ? "Requester says the support partly met the need"
          : event.event === "outcome_no"
            ? "Requester says the support did not meet the need"
            : `Requester outcome (${event.event})`;
    push(event, "feedback_outcome", label, "Read the requester's outcome feedback", "high");
  }

  for (const event of latestOf(
    events,
    (e) => e.event === "request_closed" || e.event === "request_reopened"
  ).values()) {
    const closed = event.event === "request_closed";
    push(
      event,
      "request_lifecycle",
      closed ? "Requester closed this request" : "Requester reopened this request",
      closed ? "Acknowledge the close and stop outstanding work" : "Acknowledge the reopen and resume review",
      "high"
    );
  }

  for (const event of latestOf(
    events,
    (e) => e.event === "proposal_confirmed" || e.event === "proposal_declined"
  ).values()) {
    const confirmed = event.event === "proposal_confirmed";
    push(
      event,
      "proposal_decision",
      confirmed ? "Requester confirmed a volunteer proposal" : "Requester declined a volunteer proposal",
      confirmed
        ? "Confirm the arrangement with both parties"
        : "Look for someone else for this request",
      "high"
    );
  }

  return items;
}

export function effectiveState(assignment: QueueAssignment | undefined, nowIso: string): QueueState {
  if (!assignment) return "open";
  if (assignment.state === "resolved") return "resolved";
  if (
    assignment.state === "snoozed" &&
    assignment.snoozed_until &&
    Date.parse(assignment.snoozed_until) > Date.parse(nowIso)
  ) {
    return "snoozed";
  }
  return "open";
}

/**
 * Overlay stored assignment onto a derived item. Resolving never changes the
 * underlying record — it only marks this queue entry as dealt with.
 */
export function applyAssignments(
  derived: DerivedItem[],
  assignments: QueueAssignment[],
  coordinators: Coordinator[],
  nowIso: string
): QueueItem[] {
  const byKey = new Map(assignments.map((row) => [row.item_key, row]));
  const names = new Map(coordinators.map((row) => [row.id, row.email]));

  return derived.map((item) => {
    const assignment = byKey.get(item.key);
    const ownerId = assignment?.owner_id ?? null;
    let ownerLabel = "Unassigned";
    if (ownerId) ownerLabel = names.get(ownerId)?.trim() || NOT_SPECIFIED;

    return {
      ...item,
      ownerId,
      ownerLabel,
      dueAt: assignment?.due_at ?? item.derivedDueAt,
      priority: assignment?.priority ?? item.derivedPriority,
      state: effectiveState(assignment, nowIso),
      snoozedUntil: assignment?.snoozed_until ?? null,
    };
  });
}

export function sortQueueItems(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return Date.parse(a.waitingSince) - Date.parse(b.waitingSince);
  });
}

export function filterQueueItems(items: QueueItem[], query: QueueQuery, nowIso: string): QueueItem[] {
  const q = query.q.trim().toLowerCase();
  const now = Date.parse(nowIso);
  const wantedState = query.state || "open";

  return items.filter((item) => {
    if (q && !item.searchText.includes(q) && !item.subject.toLowerCase().includes(q)) return false;
    if (query.kind && item.kind !== query.kind) return false;
    if (query.priority && item.priority !== query.priority) return false;
    if (query.mission && !item.missionIds.includes(query.mission)) return false;
    if (query.skill && !item.skills.includes(query.skill)) return false;

    if (query.owner === "unassigned") {
      if (item.ownerId) return false;
    } else if (query.owner && item.ownerId !== query.owner) {
      return false;
    }

    if (query.handover && !item.ownerId) return false;

    if (wantedState === "overdue") {
      return item.state === "open" && !!item.dueAt && Date.parse(item.dueAt) < now;
    }
    // Handover is "everything currently assigned": open and snoozed, not resolved.
    if (query.handover && (wantedState === "open" || wantedState === "all")) {
      return item.state === "open" || item.state === "snoozed";
    }
    if (wantedState !== "all" && item.state !== wantedState) return false;
    return true;
  });
}

export function paginateQueue<T>(items: T[], page: number, size: number): {
  rows: T[];
  page: number;
  pages: number;
  total: number;
} {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { rows: items.slice(start, start + size), page: current, pages, total };
}

export function isQueuePriority(value: string): value is QueuePriority {
  return (QUEUE_PRIORITIES as readonly string[]).includes(value);
}

export function isQueueState(value: string): value is QueueState {
  return value === "open" || value === "snoozed" || value === "resolved";
}
