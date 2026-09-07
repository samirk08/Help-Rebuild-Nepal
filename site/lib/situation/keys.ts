/**
 * Stable identifiers for Situation Room items.
 *
 * Queue items are derived from other tables on every load. The assignment
 * overlay has to point at something that still exists after that recompute,
 * so the key is a kind plus the underlying row's uuid — not a surrogate id
 * that would have to be recreated.
 *
 * Format: `<kind>:<uuid>`
 * Example: `need_verify:3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607`
 */

export const ITEM_KINDS = [
  "need_verify",
  "invite_accepted",
  "invite_expiring",
  "profile_stale",
  "feedback_outcome",
  "request_lifecycle",
  "proposal_decision",
  "email_stuck",
  "item_unpledged",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  need_verify: "Need awaiting verification",
  invite_accepted: "Accepted invitation",
  invite_expiring: "Invitation about to expire",
  profile_stale: "Stale volunteer profile",
  feedback_outcome: "Requester outcome feedback",
  request_lifecycle: "Request closed or reopened",
  proposal_decision: "Requester proposal decision",
  email_stuck: "Failed or stuck email",
  item_unpledged: "Relief item short of pledges",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set<string>(ITEM_KINDS);

export function isItemKind(value: string): value is ItemKind {
  return KINDS.has(value);
}

export function itemKey(kind: ItemKind, id: string): string {
  if (!UUID.test(id)) throw new Error("Queue item keys must use a uuid record id.");
  return `${kind}:${id.toLowerCase()}`;
}

export function parseItemKey(key: string): { kind: ItemKind; id: string } | null {
  const split = key.indexOf(":");
  if (split < 1) return null;
  const kind = key.slice(0, split);
  const id = key.slice(split + 1).toLowerCase();
  if (!isItemKind(kind) || !UUID.test(id)) return null;
  return { kind, id };
}
