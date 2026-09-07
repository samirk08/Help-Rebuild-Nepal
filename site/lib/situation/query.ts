import { ITEM_KINDS, isItemKind } from "./keys";
import { isQueuePriority, isQueueState } from "./derive";
import { PAGE_SIZE, type QueueQuery } from "./types";

function one(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export function parseQueueQuery(params: Record<string, string | string[] | undefined>): QueueQuery {
  const kind = one(params, "type");
  const priority = one(params, "priority");
  const state = one(params, "state");
  const page = Number(one(params, "page") || "1");

  return {
    q: one(params, "q"),
    kind: isItemKind(kind) ? kind : "",
    owner: one(params, "owner"),
    priority: isQueuePriority(priority) ? priority : "",
    state:
      state === "all" || state === "overdue" || isQueueState(state) ? state : "open",
    mission: one(params, "mission"),
    skill: one(params, "skill"),
    handover: one(params, "view") === "handover",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function queueSearchParams(query: QueueQuery, overrides: Partial<QueueQuery> = {}): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.kind) params.set("type", merged.kind);
  if (merged.owner) params.set("owner", merged.owner);
  if (merged.priority) params.set("priority", merged.priority);
  if (merged.state && merged.state !== "open") params.set("state", merged.state);
  if (merged.mission) params.set("mission", merged.mission);
  if (merged.skill) params.set("skill", merged.skill);
  if (merged.handover) params.set("view", "handover");
  if (merged.page > 1) params.set("page", String(merged.page));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const FILTER_KINDS = ITEM_KINDS;
export { PAGE_SIZE };
