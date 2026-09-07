import type { ItemKind } from "./keys";

export const QUEUE_PRIORITIES = ["urgent", "high", "normal", "low"] as const;
export type QueuePriority = (typeof QUEUE_PRIORITIES)[number];

export const QUEUE_STATES = ["open", "snoozed", "resolved"] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

export const PAGE_SIZE = 25;

/** Relief needs due within this many days, including already overdue, are "near". */
export const ITEM_NEAR_DAYS = 14;

/** Matching availability is stale after this many days without a confirmation. */
export const STALE_PROFILE_DAYS = 30;

/** An invitation enters the expiring window this far before expires_at. */
export const EXPIRING_WITHIN_MS = 24 * 60 * 60 * 1000;

/** A pending email is stuck after sitting unsent this long. */
export const STUCK_EMAIL_MS = 60 * 60 * 1000;

export type QueueAssignment = {
  item_key: string;
  owner_id: string | null;
  due_at: string | null;
  priority: QueuePriority;
  state: QueueState;
  snoozed_until: string | null;
  updated_at: string;
};

export type QueueEvent = {
  id: string;
  item_key: string;
  actor_id: string | null;
  event: string;
  detail: string | null;
  created_at: string;
};

export type DerivedItem = {
  key: string;
  kind: ItemKind;
  recordId: string;
  href: string;
  subject: string;
  nextAction: string;
  waitingSince: string;
  derivedDueAt: string | null;
  derivedPriority: QueuePriority;
  skills: string[];
  missionIds: string[];
  searchText: string;
};

export type QueueItem = DerivedItem & {
  ownerId: string | null;
  ownerLabel: string;
  dueAt: string | null;
  priority: QueuePriority;
  state: QueueState;
  snoozedUntil: string | null;
};

export type Coordinator = { id: string; email: string };

export type QueueSources = {
  now: string;
  needs: NeedRow[];
  relatedNeeds: NeedRow[];
  invitations: InvitationRow[];
  roles: RoleRow[];
  volunteers: VolunteerRow[];
  profiles: ProfileRow[];
  events: EventRow[];
  outbox: OutboxRow[];
  itemNeeds: ItemNeedRow[];
};

export type NeedRow = {
  id: string;
  status: string;
  org_or_name: string | null;
  district: string | null;
  urgency: string | null;
  skills: string[] | null;
  fields: Record<string, unknown> | null;
  created_at: string;
};

export type InvitationRow = {
  id: string;
  status: string;
  need_id: string;
  volunteer_id: string;
  role_id: string;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
};

export type RoleRow = {
  id: string;
  need_id: string;
  title: string;
  config: { skills?: string[] | null; missionIds?: string[] | null };
};

export type VolunteerRow = {
  id: string;
  org_or_name: string | null;
};

export type ProfileRow = {
  volunteer_id: string;
  paused: boolean;
  confirmed_at: string;
  facts: { skills?: string[] | null } | null;
  mission_ids: string[] | null;
};

export type EventRow = {
  id: string;
  submission_id: string;
  actor: string;
  event: string;
  detail: string | null;
  created_at: string;
};

export type OutboxRow = {
  id: string;
  invitation_id: string;
  kind: string;
  status: string;
  last_error: string | null;
  created_at: string;
};

export type ItemNeedRow = {
  id: string;
  category: string;
  quantity: number;
  district: string;
  needed_by: string;
  requester: string;
  detail: string;
  created_at: string;
  pledged: number;
};

export type QueueQuery = {
  q: string;
  kind: string;
  owner: string;
  priority: string;
  state: string;
  mission: string;
  skill: string;
  handover: boolean;
  page: number;
};

export type QueueSnapshot = {
  items: QueueItem[];
  assignmentsAvailable: boolean;
  matchingAvailable: boolean;
  requesterEventsAvailable: boolean;
};
