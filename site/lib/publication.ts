/**
 * One statement of what the public may see, and what it may still act on.
 *
 * These two questions had four different answers scattered across the codebase:
 * the board queried one status list, the detail page a second, the interest
 * route a third, and the counts on the tracker a fourth. A need rejected after
 * publication disappeared from the board while remaining reachable at its own
 * URL and still collecting offers of help.
 *
 * Publication and openness are separate on purpose. A completed request stays
 * readable — that is the record of what happened — but it cannot take new
 * interest, because there is nothing left to volunteer for.
 */

/** Statuses a verifier has acted on: the only ones the public site shows. */
export const PUBLISHED_STATUSES = ["verified", "recruiting", "filled", "completed"] as const;

/** Of those, the ones still looking for people. */
export const OPEN_STATUSES = ["verified", "recruiting"] as const;

export type PublishedStatus = (typeof PUBLISHED_STATUSES)[number];

export function isPublicStatus(status: unknown): status is PublishedStatus {
  return typeof status === "string" && (PUBLISHED_STATUSES as readonly string[]).includes(status);
}

/** Whether a need row may appear on any public surface, including counts. */
export function isPublicNeed(row: { kind?: string | null; status?: string | null }): boolean {
  if (row.kind !== undefined && row.kind !== null && row.kind !== "need") return false;
  return isPublicStatus(row.status);
}

/**
 * Whether a project may appear publicly.
 *
 * A project inherits its parent need's visibility: promoting a need to a
 * project must not publish something the need itself would not have published.
 */
export function isPublicProject(project: {
  stage?: string | null;
  need?: { kind?: string | null; status?: string | null } | null;
}): boolean {
  if (project.need && !isPublicNeed(project.need)) return false;
  return typeof project.stage === "string" && project.stage !== "draft";
}

/**
 * Whether a need can still take an offer of help.
 *
 * `filled` and `completed` are published but closed. Offering help on a filled
 * request wastes the volunteer's time and gives the requester a queue of people
 * they must now turn down, so the action is refused rather than merely hidden.
 */
export function canAcceptInterest(status: unknown): boolean {
  return typeof status === "string" && (OPEN_STATUSES as readonly string[]).includes(status);
}

/**
 * The result of a public read, with failure distinguishable from emptiness.
 *
 * Every read model here used to `return []` on error, so "no needs have been
 * posted" and "the database is unreachable" rendered as the same page — an
 * encouraging empty state during an outage. Callers must now decide which they
 * are showing, and the `unavailable` case is the one that says so.
 */
export type ReadResult<T> =
  | { state: "ok"; data: T; lastUpdated: string }
  | { state: "unavailable"; reason: string };

export function ok<T>(data: T, lastUpdated: string = new Date().toISOString()): ReadResult<T> {
  return { state: "ok", data, lastUpdated };
}

export function unavailable<T>(reason: string): ReadResult<T> {
  return { state: "unavailable", reason };
}

/**
 * The data if the read worked, otherwise a caller-supplied stand-in.
 *
 * For surfaces where an outage genuinely is not worth a message — a decorative
 * count in a footer. Anything a person makes a decision from should branch on
 * `state` instead, so use this deliberately rather than by default.
 */
export function dataOr<T>(result: ReadResult<T>, fallback: T): T {
  return result.state === "ok" ? result.data : fallback;
}

/**
 * A value that was never collected, rendered the same way everywhere.
 *
 * Distinct from a zero and from an unavailable read, per the rule that those
 * three states never collapse into one another.
 */
export const NOT_SPECIFIED = "Not specified";
export const NOT_COLLECTED = "Not collected";
