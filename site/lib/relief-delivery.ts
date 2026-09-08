/**
 * The vocabulary of a relief delivery.
 *
 * Migration 018 enforces these transitions; this module names them, so the
 * dashboard offers a coordinator the buttons that will actually work rather
 * than a dropdown of every stage and an error message for most of them.
 *
 * The transition table is deliberately a duplicate of the one in SQL, and
 * tests/relief-delivery-db.test.ts checks the two agree by driving the
 * database with this table. A second source of truth that is asserted equal is
 * better than a UI that has to guess.
 *
 * Pure: no Supabase import, so this is safe in a client component.
 */

export const DELIVERY_STAGES = [
  "offered",
  "reserved",
  "dispatched",
  "received",
  "cancelled",
] as const;

export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export function isDeliveryStage(value: unknown): value is DeliveryStage {
  return typeof value === "string" && (DELIVERY_STAGES as readonly string[]).includes(value);
}

export const STAGE_LABEL: Record<DeliveryStage, string> = {
  offered: "Offered",
  reserved: "Reserved",
  dispatched: "Dispatched",
  received: "Received",
  cancelled: "Cancelled",
};

/**
 * What each stage actually asserts. Written out because the difference between
 * "someone said they would" and "it is there" is the entire point of the
 * stages, and a one-word label does not carry it.
 */
export const STAGE_MEANING: Record<DeliveryStage, string> = {
  offered: "Someone has offered these goods. Nothing has been arranged.",
  reserved: "A coordinator accepted the offer and a collection is arranged.",
  dispatched: "The goods have left the donor.",
  received: "The recipient confirmed what arrived, in the amount that arrived.",
  cancelled: "This offer will not be delivered. It no longer counts as supply.",
};

/**
 * The stages a coordinator may move an offer to next.
 *
 * `verified` gates reserving: arranging a collection from an offer nobody has
 * checked means the platform vouching for a donor it knows nothing about.
 */
export function nextStages(stage: string, status: string): DeliveryStage[] {
  switch (stage) {
    case "offered":
      return status === "verified" ? ["reserved", "cancelled"] : ["cancelled"];
    case "reserved":
      return ["dispatched", "received", "cancelled"];
    case "dispatched":
      return ["received", "cancelled"];
    default:
      // `received` and `cancelled` are terminal. Goods that arrived cannot be
      // un-arrived, and reviving a cancelled offer would lose why it was
      // cancelled — the donor makes a fresh offer instead.
      return [];
  }
}

/** Whether moving to this stage has to record how much actually arrived. */
export function needsQuantity(stage: string): boolean {
  return stage === "received";
}

export type ItemNeedProgress = {
  quantity: number;
  /** Offered and not cancelled. A lead, not supply. */
  pledged: number;
  /** Reserved or dispatched: supply a coordinator has committed to. */
  committed: number;
  /** Confirmed at the destination, in the amount that turned up. */
  received: number;
};

/**
 * What is still needed.
 *
 * Bare offers do not reduce it. That is the whole correction this phase makes:
 * a board reading "200 of 200 pledged" against goods that have not moved tells
 * a coordinator to stop looking, and the tarpaulins never arrive.
 */
export function remainingDemand(p: ItemNeedProgress): number {
  return Math.max(0, p.quantity - p.received - p.committed);
}

/** Percentage of the request that has actually arrived, for a progress bar. */
export function receivedPercent(p: ItemNeedProgress): number {
  if (p.quantity <= 0) return 0;
  return Math.min(100, Math.round((p.received / p.quantity) * 100));
}

/** Percentage arranged but not yet confirmed — drawn behind `received`. */
export function committedPercent(p: ItemNeedProgress): number {
  if (p.quantity <= 0) return 0;
  return Math.min(100 - receivedPercent(p), Math.round((p.committed / p.quantity) * 100));
}

export const ITEM_NEED_STATUSES = ["requested", "closed", "cancelled"] as const;
export type ItemNeedStatus = (typeof ITEM_NEED_STATUSES)[number];

export function isItemNeedStatus(value: unknown): value is ItemNeedStatus {
  return typeof value === "string" && (ITEM_NEED_STATUSES as readonly string[]).includes(value);
}

/**
 * Whether a request can still take an offer.
 *
 * Mirrors `pledges_guard_demand` in migration 018. The database is the
 * authority — this exists so the offer form can say why rather than surfacing
 * a raised exception.
 *
 * Returns a code rather than a sentence. The server does not know which
 * language the donor is reading in; lib/form-errors.ts turns the code into
 * words on the client, where `lang` is known.
 */
export type PledgeRefusal = "need_closed" | "need_allocated" | "need_fully_offered";

export function canAcceptPledge(
  need: ItemNeedProgress & { status: string }
): { ok: true } | { ok: false; code: PledgeRefusal } {
  if (need.status !== "requested") return { ok: false, code: "need_closed" };
  if (remainingDemand(need) <= 0) return { ok: false, code: "need_allocated" };
  // Not a database rule, and deliberately so: excess offers are refused here
  // as a courtesy to the donor, but a request that is over-offered and
  // under-delivered must never be treated by the schema as met.
  if (need.pledged >= need.quantity) return { ok: false, code: "need_fully_offered" };
  return { ok: true };
}
