import { REVIEWED_VOLUNTEER_STATUSES } from "./types";
import type { Profile, Submission } from "./types";

/**
 * What is still missing before this volunteer can be matched to anything.
 *
 * The engine answers that question one role at a time, which is right for a
 * coordinator looking at a specific vacancy and useless to the volunteer: they
 * do not have a role in front of them, and telling them "unknown for role 47"
 * is not something they can act on. This asks the role-independent half — the
 * facts that would come back `unknown` against *every* role — and names only
 * those.
 *
 * Deliberately not a score. A percentage invites optimising the number rather
 * than answering the question, and there is no meaningful "62% ready".
 *
 * Pure: no database, no clock beyond the `now` passed in. Every rule here
 * mirrors a check in `engine.ts`, and the test asserts they agree — a
 * readiness page that disagrees with the engine is worse than none, because it
 * tells someone they are ready when nobody can invite them.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Matches the engine's freshness window for confirmed availability. */
export const STALE_AFTER_DAYS = 30;

export type MissingFact = {
  key: string;
  /** What to tell the volunteer, in the first person. */
  label: string;
  /** Which control fixes it, so the page can link straight there. */
  fixes: "matching" | "registration" | "coordinator";
};

export type Readiness = {
  ready: boolean;
  missing: MissingFact[];
  /** Set when the person has asked not to receive invitations at all. */
  paused: boolean;
};

function validEmail(value: string | null | undefined): boolean {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function readinessFor(
  volunteer: Submission,
  profile: Profile | null,
  now: number = Date.now()
): Readiness {
  const missing: MissingFact[] = [];
  const add = (key: string, label: string, fixes: MissingFact["fixes"]) =>
    missing.push({ key, label, fixes });

  // Registration-level facts. These are not matching answers, so they are not
  // things the matching form can fix.
  if (!validEmail(volunteer.contact_email)) {
    add("email", "A working email address", "registration");
  }
  if (volunteer.fields?.consent !== "on" && volunteer.fields?.consent !== true) {
    add("consent", "Consent to share your details for coordination", "registration");
  }
  if (volunteer.status === "rejected") {
    add("review", "This registration was not accepted", "coordinator");
  } else if (!REVIEWED_VOLUNTEER_STATUSES.includes(volunteer.status)) {
    // Waiting on a coordinator is not the volunteer's task, but leaving it out
    // would let the page claim they are ready when nobody can invite them yet.
    add("review", "A coordinator still has to review your registration", "coordinator");
  }

  // Matching answers. Without a profile at all, none of them are confirmed —
  // listing each one separately would be a wall of items for one action.
  if (!profile) {
    add("profile", "Confirm the skills and time you can offer", "matching");
    return { ready: false, missing, paused: false };
  }

  const f = profile.facts;
  if (!f.skills || f.skills.length === 0) add("skills", "The skills you are offering", "matching");
  if (!f.workMode) add("mode", "Whether you can work remotely, on site, or both", "matching");
  if (!f.availableFrom || !f.availableUntil) add("dates", "The dates you are available", "matching");
  if (f.hoursPerWeek === null) add("hours", "How many hours a week you can offer", "matching");
  // Travel scope only matters to someone who might be asked to go somewhere.
  if ((f.workMode === "onsite" || f.workMode === "both") && !f.travel) {
    add("travel", "How far you are willing to travel", "matching");
  }

  const confirmed = Date.parse(profile.confirmed_at);
  const stale =
    !Number.isFinite(confirmed) || confirmed > now || now - confirmed > STALE_AFTER_DAYS * DAY;
  if (stale) {
    add("freshness", `Confirm your availability is still current`, "matching");
  }

  return {
    ready: missing.length === 0,
    missing,
    // Being paused is a choice, not a gap. It is reported separately so the
    // page can say "you are ready, and you have paused invitations" rather
    // than listing the person's own decision as something they forgot.
    paused: profile.paused,
  };
}
