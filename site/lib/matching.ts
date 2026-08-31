import { districtDistanceKm, isOutsideNepal, provinceOf } from "./districts";

/**
 * The matching engine: how well one volunteer fits one need.
 *
 * Everything in this file is a pure function of two plain objects. It touches
 * no database, no clock and no network, so a match can be unit-tested, re-run
 * against yesterday's data and explained line by line. lib/match-suggestions.ts
 * is the part that reads rows and calls in here.
 *
 * ---------------------------------------------------------------- Why rules
 *
 * Not a learned model, and deliberately so:
 *
 *   * There is nothing to learn from. `matches` records the handful of
 *     decisions admins have made by hand; it is not a labelled training set,
 *     and a model fitted to it would mostly reproduce whoever was easiest to
 *     find in an alphabetical dropdown.
 *   * A suggestion has to be arguable. A coordinator sending someone to a
 *     collapsed building, and a volunteer deciding whether to travel, both
 *     need to know why — "the model ranked her third" is not a reason. Every
 *     score here decomposes into named dimensions with the answers behind
 *     them.
 *   * It has to be stable. The same register and the same request produce the
 *     same ranking today and next week, so two coordinators looking at one
 *     need see one list.
 *
 * That is also what the humanitarian tools that already do this converge on:
 * Sahana Eden, the most widely deployed disaster-management platform, matches
 * volunteers through structured search over skills, availability and location
 * rather than a similarity model.
 *
 * ------------------------------------------------------- Shape of the score
 *
 * Two stages, and keeping them apart is the point:
 *
 *   1. HARD GATES decide whether a pairing is possible at all — someone who
 *      said they cannot leave their district is not a weak match for work two
 *      provinces away, they are not a match. Blockers are returned rather than
 *      swallowed, because "why is she not on this list" is a question a
 *      coordinator will ask.
 *
 *   2. WEIGHTED DIMENSIONS rank what is left. Each returns a 0–1 ratio, or
 *      null when the answer it needs was never given. Nulls drop out of both
 *      halves of the average instead of scoring zero — the register is full of
 *      half-filled optional sections, and a blank is not a bad answer. What
 *      that costs is reported as `confidence` rather than hidden.
 *
 * Urgency and workload are deliberately NOT in here. How urgent a request is
 * does not change who suits it, and how busy a volunteer is does not either;
 * both belong to ranking, which is why they live in `rankNeedsForVolunteer`
 * and `rankVolunteersForNeed` at the bottom of this file. Folding them into
 * the fit score would make one number mean two things.
 */

/* ------------------------------------------------------------------ Types */

export type MatchableVolunteer = {
  id: string;
  name: string | null;
  status: string;
  /** Where they are based — a district name, or the "Outside Nepal" entry. */
  district: string | null;
  primarySkill: string | null;
  subSkills: string | null;
  certifications: string | null;
  yearsExperience: string | null;
  contribution: string[];
  availableFrom: string | null;
  commitDuration: string | null;
  hoursPerWeek: string | null;
  maxDeployment: string | null;
  workMode: string | null;
  travel: string | null;
  preferredDistricts: string | null;
  resources: string[];
  languages: string[];
  /** Needs an admin has already matched this person to. Ranking input only. */
  activeMatches: number;
  /** Already matched to the need being scored — a gate, not a low score. */
  alreadyMatched?: boolean;
};

export type MatchableNeed = {
  id: string;
  title: string | null;
  status: string;
  district: string | null;
  province: string | null;
  urgency: string | null;
  skills: string[];
  resourcesRequired: string[];
  experienceRequired: string | null;
  peopleNeeded: number | null;
  committed: number;
  startDate: string | null;
  duration: string | null;
  deadline: string | null;
  workMode: string | null;
  accommodation: string | null;
  food: string | null;
  transport: string | null;
};

/**
 * A machine-readable reason. The engine never returns a sentence: the admin
 * dashboard is English-only and the public site is bilingual, so phrasing
 * belongs to whichever of them is rendering. See `lib/match-copy.ts`.
 */
export type Signal = { code: SignalCode; value?: string };

export type SignalCode =
  // Gates
  | "volunteer-rejected"
  | "already-matched"
  | "needs-on-site-help"
  | "needs-remote-help"
  | "district-locked"
  | "available-after-deadline"
  // Positives
  | "same-district"
  | "named-this-district"
  | "nearby-district"
  | "same-province"
  | "remote-work"
  | "skill-exact"
  | "skill-related"
  | "skill-secondary"
  | "experience-meets"
  | "certified"
  | "duration-covers"
  | "can-travel"
  | "brings-resources"
  | "speaks-nepali"
  | "speaks-local-language"
  | "support-provided"
  // Cautions
  | "not-verified"
  | "safeguarding-vetting"
  | "outside-nepal"
  | "outside-preferred-districts"
  | "experience-below"
  | "no-certification-on-file"
  | "shorter-than-needed"
  | "starts-after-need"
  | "unsupported-travel"
  | "no-nepali-listed"
  | "skills-unspecified"
  | "date-not-understood"
  | "date-maybe-bikram-sambat"
  | "low-information";

export type DimensionId =
  | "skill"
  | "location"
  | "availability"
  | "experience"
  | "commitment"
  | "resources"
  | "language";

export type DimensionResult = {
  id: DimensionId;
  weight: number;
  /** 0–1, or null when the answers this dimension needs were not given. */
  ratio: number | null;
};

export type Band = "strong" | "possible" | "stretch" | "ineligible";

export type MatchAssessment = {
  needId: string;
  volunteerId: string;
  eligible: boolean;
  blockers: Signal[];
  /** 0–100 over the dimensions that had answers. 0 when not eligible. */
  score: number;
  band: Band;
  /** Share of the total weight that had an answer behind it, 0–1. */
  confidence: number;
  dimensions: DimensionResult[];
  reasons: Signal[];
  cautions: Signal[];
};

/* ---------------------------------------------------------------- Weights */

/**
 * What the coordination desk is actually trading off, as numbers out of 100.
 *
 * Skill leads because it is the thing a request is fundamentally asking for,
 * and location is close behind on the evidence rather than on intuition: the
 * UNDP review of volunteer engagement after the 2015 Gorkha earthquake found
 * that local volunteers, who knew the ward and could be there the same day,
 * were what made the response work. Distance is not only a travel cost here.
 *
 * These are a starting point, not a finding. `matches.suggested_score`
 * (migration 009) records what the engine thought of every pairing an admin
 * actually accepted, which is the evidence needed to move them later.
 */
export const DIMENSION_WEIGHTS: Record<DimensionId, number> = {
  skill: 30,
  location: 22,
  availability: 16,
  experience: 12,
  commitment: 10,
  resources: 6,
  language: 4,
};

/** Score at or above which a pairing is called a strong fit. */
const STRONG_AT = 70;
/** Score at or above which it is worth a coordinator's attention. */
const POSSIBLE_AT = 45;
/**
 * How high a pairing can score given how well the volunteer's skill matches:
 * 25 at the skill floor, 100 at an exact match.
 *
 * Without this the seven dimensions add up as if they were independent, and
 * they are not. Location, availability, experience and language all ask "how
 * easily could this person do the work"; skill asks whether they can do it at
 * all, and a no there is not something the other six can make up for. A doctor
 * who lives in the ward, is free all month and speaks the language scored 66
 * against a request for a structural engineer before this existed — sixth on
 * the list, above people who could actually do the job — because everything
 * except the one thing that mattered was perfect.
 *
 * So the skill ratio sets a ceiling as well as contributing its 30 points. The
 * rule it encodes is one sentence: you cannot be a good fit for work you
 * cannot do, however well the rest of it lines up.
 */
function skillCeiling(skillRatio: number): number {
  return 25 + 75 * skillRatio;
}

/**
 * Below this share of answered weight, a pairing cannot be called "strong"
 * however well the answered part scores. A near-empty registration that
 * happens to name the right skill is a guess, and should not outrank someone
 * who filled the form in.
 *
 * Set above the 0.52 that skill and location alone come to, deliberately: those
 * two are the biggest dimensions and it would be easy to let them carry a
 * registration on their own, but knowing what somebody does and where they live
 * while knowing nothing about whether they are free is not knowing they fit. A
 * third substantive answer is the bar.
 */
const CONFIDENCE_FOR_STRONG = 0.6;

/* ------------------------------------------------------------ Vocabularies */

/**
 * Skills that are close enough that one is worth suggesting for the other,
 * and how close, 0–1. Symmetric; only the pairs worth stating are listed.
 *
 * The judgements are conservative on purpose. A structural engineer can be
 * useful on a construction site and an architect's damage assessment overlaps
 * an engineer's, so those score high. Nothing bridges into health, child
 * support or psychosocial work: those are not adjacent to anything, they are
 * qualifications, and treating "close enough" as a reason to suggest someone
 * for them is how an untrained person ends up in front of a traumatised child.
 */
const SKILL_ADJACENCY: Record<string, Record<string, number>> = {
  "Engineering (structural / civil)": {
    Architecture: 0.65,
    "Construction & trades": 0.6,
    "Water & sanitation (WASH)": 0.4,
  },
  Architecture: {
    "Engineering (structural / civil)": 0.65,
    "Construction & trades": 0.5,
  },
  "Construction & trades": {
    "Engineering (structural / civil)": 0.6,
    Architecture: 0.5,
    "Water & sanitation (WASH)": 0.35,
  },
  "Water & sanitation (WASH)": {
    "Engineering (structural / civil)": 0.4,
    "Construction & trades": 0.35,
  },
  "Project management": {
    "Logistics & transport": 0.5,
    "IT & data": 0.3,
  },
  "Logistics & transport": {
    "Project management": 0.5,
  },
  "IT & data": {
    "Project management": 0.3,
    Translation: 0.25,
  },
  Translation: {
    "IT & data": 0.25,
    "Education & child support": 0.3,
  },
  "Education & child support": {
    Translation: 0.3,
  },
  "Health & medical": {},
  "Psychosocial support": {},
  Other: {},
};

/**
 * Skills whose work puts a volunteer next to people who cannot protect
 * themselves from them.
 *
 * The convergence literature is blunt about why this matters: alongside the
 * people who turn up to help, disasters draw what one review calls "the
 * exploiters" — individuals seeking access to vulnerable people. A ranking
 * engine that quietly promoted an unchecked registration into a shortlist for
 * child support work would be doing their recruiting. So a pairing on one of
 * these skills cannot be called a strong fit until a person has verified the
 * volunteer, whatever the arithmetic says. It still appears — hiding it would
 * only mean nobody knows to check them — with the reason stated.
 */
const SAFEGUARDED_SKILLS = new Set([
  "Health & medical",
  "Psychosocial support",
  "Education & child support",
]);

/**
 * What a volunteer can offer, mapped onto what a request can ask for. The two
 * chip lists were written for different questions and only partly meet.
 *
 * "Funding" is absent on purpose, and so is every route to it: this site never
 * takes custody of money — financial contributions hand off to the PMDRF — so
 * a request that asks for funding must not make anyone look like a match for
 * it. "Materials", "Medical supplies" and "Food and water" are absent because
 * the volunteer form has no way to say you have them; the relief-items board
 * is where physical supply is offered, and this dimension reports no data
 * rather than a zero it did not earn.
 */
const RESOURCE_MAP: Record<string, string[]> = {
  Equipment: ["Equipment", "Tools"],
  Vehicles: ["Vehicle"],
  "Tents / shelter": ["Accommodation", "Warehouse / storage"],
  Materials: ["Warehouse / storage"],
};

/** Regional languages that say something about a province they are spoken in. */
const LANGUAGE_REGIONS: Record<string, string[]> = {
  Maithili: ["madhesh"],
  Newar: ["bagmati"],
  Tamang: ["bagmati"],
};

/** Approximate days behind each duration answer on the two forms. */
const NEED_DURATION_DAYS: Record<string, number> = {
  "1-3 days": 3,
  "1 week": 7,
  "2 weeks": 14,
  "1 month": 30,
  "Longer / ongoing project": 120,
};

const COMMIT_DURATION_DAYS: Record<string, number> = {
  "A few days": 3,
  "1-2 weeks": 14,
  "1 month": 30,
  "3 months": 90,
  Ongoing: 365,
};

/** "or more" is open-ended, so the top answer is not a ceiling. */
const MAX_DEPLOYMENT_DAYS: Record<string, number> = {
  "3 days": 3,
  "1 week": 7,
  "2 weeks": 14,
  "1 month or more": 365,
};

const EXPERIENCE_YEARS: Record<string, number> = {
  "Under 2": 1,
  "2-5": 3.5,
  "5-10": 7.5,
  "10-20": 15,
  "20+": 25,
};

/** Years the request's experience answer is really asking for. */
const EXPERIENCE_REQUIRED_YEARS: Record<string, number> = {
  Any: 0,
  "Some experience": 2,
  "Qualified professional": 5,
  "Senior / licensed": 10,
};

/**
 * Straight-line kilometres between two district headquarters, banded.
 *
 * Bands, not a curve, because the underlying number does not deserve one: a
 * point-to-point line in Nepal can be a ridge, and 60km of Terai road and 60km
 * of Karnali track are not the same journey. Bands say what can honestly be
 * said — same district, next district over, same part of the country, far.
 */
const PROXIMITY_BANDS: Array<{ maxKm: number; ratio: number; code: SignalCode }> = [
  { maxKm: 0, ratio: 1, code: "same-district" },
  { maxKm: 60, ratio: 0.85, code: "nearby-district" },
  { maxKm: 150, ratio: 0.6, code: "same-province" },
  { maxKm: 400, ratio: 0.3, code: "same-province" },
  { maxKm: Infinity, ratio: 0.15, code: "same-province" },
];

/* ---------------------------------------------------------------- Helpers */

/**
 * Compare answers without tripping over dash characters.
 *
 * The design writes its ranges with en dashes ("2–5", "1–2 weeks"). Anything
 * typed by hand, pasted from a spreadsheet or written into a fixture uses a
 * hyphen. They mean the same answer and must not score differently, so every
 * lookup key in this file is written with a plain hyphen and every value read
 * out of a submission comes through here first.
 */
function norm(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
}

function lower(value: string | null | undefined): string {
  return norm(value).toLowerCase();
}

function has(list: string[] | null | undefined, value: string): boolean {
  const wanted = lower(value);
  return (list ?? []).some((entry) => lower(entry) === wanted);
}

/** Work modes are the same three answers on both forms. */
function worksRemotely(mode: string | null): boolean {
  const m = norm(mode);
  return m === "Remote" || m === "Both";
}

function worksOnSite(mode: string | null): boolean {
  const m = norm(mode);
  return m === "On the ground" || m === "Both";
}

export type ParsedDate =
  | { kind: "date"; date: Date }
  | { kind: "none" }
  | { kind: "unreadable" }
  /** A year in the 2070s–2090s is almost certainly Bikram Sambat. */
  | { kind: "ambiguous-calendar" };

/**
 * Read a date out of a free-text field.
 *
 * Both forms ask for dates as plain text with a "DD / MM / YYYY" placeholder,
 * so what arrives is whatever people type. This accepts the common forms and
 * says "unreadable" for the rest rather than guessing — a wrong start date
 * would silently rule a volunteer in or out of a deployment.
 *
 * The Bikram Sambat case is called out rather than converted. Nepal's official
 * calendar runs about 56 years and 8 months ahead of the Gregorian one, so a
 * date typed as 2082 is this year to the person typing it and the year 2082 to
 * `Date`. Converting would need the exact month boundary, which shifts, and
 * getting it wrong by a month on a deadline is worse than admitting the
 * ambiguity: the pairing keeps its other dimensions and the coordinator gets
 * told to read the date themselves.
 */
export function parseFormDate(raw: string | null | undefined): ParsedDate {
  const input = norm(raw);
  if (!input) return { kind: "none" };

  const dmy = /^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{4})$/.exec(input);
  const ymd = /^(\d{4})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{1,2})$/.exec(input);

  let year: number, month: number, day: number;
  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    return { kind: "unreadable" };
  }

  if (year >= 2070 && year <= 2099) return { kind: "ambiguous-calendar" };
  if (month < 1 || month > 12 || day < 1 || day > 31) return { kind: "unreadable" };

  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects the 31st of a 30-day month, which Date would roll into the next.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { kind: "unreadable" };
  }
  return { kind: "date", date };
}

/** A table lookup on a form answer, tolerant of dash and spacing variants. */
function tableValue(table: Record<string, number>, value: string | null): number | null {
  const key = norm(value);
  if (!key) return null;
  return table[key] ?? null;
}

/**
 * Accumulates the parts of one dimension so a dimension made of several
 * questions averages only over the ones that were answered — the same rule
 * the overall score uses, one level down.
 */
class Parts {
  private total = 0;
  private count = 0;

  add(ratio: number): void {
    this.total += Math.max(0, Math.min(1, ratio));
    this.count += 1;
  }

  get value(): number | null {
    return this.count === 0 ? null : this.total / this.count;
  }
}

/* ------------------------------------------------------------ Hard gates */

/**
 * Reasons this pairing is not possible, as opposed to merely weak.
 *
 * Each of these is something the volunteer or the requester actually stated,
 * not something inferred. A gate on an inference would silently delete people
 * from a shortlist on the strength of a guess, which is the one thing a
 * ranking engine must never do.
 */
function gates(need: MatchableNeed, volunteer: MatchableVolunteer): Signal[] {
  const blockers: Signal[] = [];

  if (volunteer.alreadyMatched) blockers.push({ code: "already-matched" });
  if (volunteer.status === "rejected") blockers.push({ code: "volunteer-rejected" });

  const needsOnSite = worksOnSite(need.workMode) && !worksRemotely(need.workMode);
  const needsRemote = worksRemotely(need.workMode) && !worksOnSite(need.workMode);

  if (needsOnSite && norm(volunteer.workMode) === "Remote") {
    blockers.push({ code: "needs-on-site-help" });
  }
  if (needsRemote && norm(volunteer.workMode) === "On the ground") {
    blockers.push({ code: "needs-remote-help" });
  }

  // Someone who said they cannot leave their own district has ruled themselves
  // out of on-site work elsewhere, and it is not this engine's place to
  // re-open that. Remote work is unaffected: it asks nothing of them.
  const remotePossible = worksRemotely(need.workMode) && worksRemotely(volunteer.workMode);
  if (
    !remotePossible &&
    norm(volunteer.travel) === "Within my district only" &&
    volunteer.district &&
    need.district &&
    norm(volunteer.district) !== norm(need.district)
  ) {
    blockers.push({ code: "district-locked", value: volunteer.district });
  }

  // Available only after the work has to be finished. Both dates are free
  // text, so this fires only when both actually parsed.
  const from = parseFormDate(volunteer.availableFrom);
  const deadline = parseFormDate(need.deadline);
  if (from.kind === "date" && deadline.kind === "date" && from.date > deadline.date) {
    blockers.push({ code: "available-after-deadline", value: volunteer.availableFrom ?? undefined });
  }

  return blockers;
}

/* --------------------------------------------------------- The dimensions */

/**
 * Skill (weight 30).
 *
 * A request lists every skill it needs; a volunteer names one primary skill
 * and types the rest as free text. The best available reading of those two is:
 * a listed primary skill is the answer, a related skill is worth suggesting
 * with the relationship named, and a skill mentioned in the sub-skills box is
 * real but secondary.
 *
 * The floor is 0.08 rather than 0, because "no skill in common" is not "no
 * use" — clearing rubble and carrying water are needed and this form has no
 * chip for them — but it must never be enough to reach a shortlist on its own.
 */
function skillDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[],
  cautions: Signal[]
): number | null {
  const required = need.skills.filter((s) => norm(s) !== "");
  if (required.length === 0) {
    cautions.push({ code: "skills-unspecified" });
    return null;
  }

  // "Other" on its own says the request could not describe what it wants in
  // the form's vocabulary. Nobody is a demonstrated fit for that and nobody is
  // demonstrably wrong for it either, so it scores neutrally and says so.
  if (required.every((s) => norm(s) === "Other")) {
    cautions.push({ code: "skills-unspecified" });
    return 0.5;
  }

  const primary = norm(volunteer.primarySkill);
  if (primary && required.some((s) => norm(s) === primary)) {
    reasons.push({ code: "skill-exact", value: volunteer.primarySkill ?? undefined });
    return 1;
  }

  let best = 0.08;

  if (primary) {
    const related = SKILL_ADJACENCY[primary] ?? {};
    for (const wanted of required) {
      const closeness = related[norm(wanted)];
      if (closeness && closeness > best) {
        best = closeness;
        reasons.push({ code: "skill-related", value: `${volunteer.primarySkill} → ${wanted}` });
      }
    }
  }

  // The sub-skills box is where a nurse who also drives a truck says so.
  const sub = lower(volunteer.subSkills);
  if (sub) {
    for (const wanted of required) {
      if (best >= 0.55) break;
      if (skillWords(wanted).some((word) => sub.includes(word))) {
        best = 0.55;
        reasons.push({ code: "skill-secondary", value: wanted });
      }
    }
  }

  return best;
}

/**
 * The words in a skill label worth looking for in free text.
 *
 * Nobody types "Engineering (structural / civil)" into a sub-skills box; they
 * write "structural damage assessment". Matching on the label's leading word
 * alone missed exactly that, so every distinctive word counts, not just the
 * first.
 *
 * "Support" is excluded because it is the tail of two unrelated options —
 * "Education & child support" and "Psychosocial support" — and would match
 * "IT support" into both. Anything under five letters goes too: "wash" is a
 * verb before it is an acronym, and "data" and "and" are everywhere.
 */
const SKILL_WORD_STOPLIST = new Set(["support", "other"]);

function skillWords(label: string): string[] {
  return lower(label)
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 5 && !SKILL_WORD_STOPLIST.has(word));
}

/**
 * Location (weight 22).
 *
 * Remote work short-circuits the whole dimension: if the request can be done
 * from anywhere and the volunteer works that way, where they are is not a
 * fact about the match.
 *
 * Everything else is distance, banded, then held against what the volunteer
 * said about travelling. "Specific districts only" is the interesting case —
 * it is a preference, not a rule, so naming this district is a strong positive
 * and not naming it is a cap and a caution, never a gate.
 */
function locationDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[],
  cautions: Signal[]
): number | null {
  if (worksRemotely(need.workMode) && worksRemotely(volunteer.workMode)) {
    reasons.push({ code: "remote-work" });
    return 1;
  }

  if (!need.district || !volunteer.district) return null;

  if (isOutsideNepal(volunteer.district)) {
    cautions.push({ code: "outside-nepal" });
    return 0.05;
  }

  let ratio: number;
  const km = districtDistanceKm(volunteer.district, need.district);

  if (km === null) {
    // An unrecognised district name on either side. Province is the coarser
    // answer that is still true, and no answer at all is better than a
    // fabricated distance.
    const vp = provinceOf(volunteer.district);
    const np = provinceOf(need.district);
    if (!vp || !np) return null;
    ratio = vp === np ? 0.6 : 0.3;
    if (vp === np) reasons.push({ code: "same-province" });
  } else {
    const band = PROXIMITY_BANDS.find((b) => km <= b.maxKm) ?? PROXIMITY_BANDS[PROXIMITY_BANDS.length - 1];
    ratio = band.ratio;
    if (km === 0) reasons.push({ code: "same-district", value: need.district });
    else if (band.code === "nearby-district") {
      reasons.push({ code: "nearby-district", value: volunteer.district });
    } else if (provinceOf(volunteer.district) === provinceOf(need.district)) {
      reasons.push({ code: "same-province" });
    }
  }

  const travel = norm(volunteer.travel);
  const sameDistrict = norm(volunteer.district) === norm(need.district);

  if (travel === "Specific districts only" && !sameDistrict) {
    const preferred = lower(volunteer.preferredDistricts);
    if (preferred && need.district && preferred.includes(lower(need.district))) {
      reasons.push({ code: "named-this-district", value: need.district });
      ratio = Math.max(ratio, 0.9);
    } else {
      cautions.push({ code: "outside-preferred-districts", value: volunteer.preferredDistricts ?? undefined });
      ratio = Math.min(ratio, 0.25);
    }
  }

  return ratio;
}

/**
 * Availability (weight 16).
 *
 * Three questions where they were answered: can they start in time, can they
 * commit for as long as the work runs, and is a single stretch of the work
 * inside the longest deployment they will do.
 *
 * "Hours per week" is deliberately not scored. The need form has no hours
 * field to compare it against, so any use of it would be this engine deciding
 * what a request meant rather than reading what it said; it is shown to
 * coordinators as context instead.
 */
function availabilityDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[],
  cautions: Signal[]
): number | null {
  const parts = new Parts();

  const from = parseFormDate(volunteer.availableFrom);
  if (from.kind === "ambiguous-calendar") {
    cautions.push({ code: "date-maybe-bikram-sambat", value: volunteer.availableFrom ?? undefined });
  } else if (from.kind === "unreadable") {
    cautions.push({ code: "date-not-understood", value: volunteer.availableFrom ?? undefined });
  }

  const start = parseFormDate(need.startDate);
  if (from.kind === "date" && start.kind === "date") {
    if (from.date <= start.date) parts.add(1);
    else {
      // Late but before the deadline — the gate above has already removed the
      // pairings where they would arrive after the work must be finished.
      parts.add(0.5);
      cautions.push({ code: "starts-after-need", value: volunteer.availableFrom ?? undefined });
    }
  }

  const needDays = tableValue(NEED_DURATION_DAYS, need.duration);
  const commitDays = tableValue(COMMIT_DURATION_DAYS, volunteer.commitDuration);
  if (needDays !== null && commitDays !== null) {
    if (commitDays >= needDays) {
      parts.add(1);
      reasons.push({ code: "duration-covers", value: volunteer.commitDuration ?? undefined });
    } else if (commitDays >= needDays / 2) {
      parts.add(0.6);
      cautions.push({ code: "shorter-than-needed", value: volunteer.commitDuration ?? undefined });
    } else {
      parts.add(0.25);
      cautions.push({ code: "shorter-than-needed", value: volunteer.commitDuration ?? undefined });
    }
  }

  const maxDays = tableValue(MAX_DEPLOYMENT_DAYS, volunteer.maxDeployment);
  if (needDays !== null && maxDays !== null) {
    // Standing work is staffed in rotations, so a month is a full answer to an
    // ongoing project — comparing a single deployment against the whole
    // project's length would rule out everyone who is not moving there.
    const stretch = Math.min(needDays, 30);
    parts.add(maxDays >= stretch ? 1 : Math.max(0.25, maxDays / stretch));
  }

  return parts.value;
}

/**
 * Experience (weight 12).
 *
 * The two forms describe experience differently — years registered against a
 * level required — so both are read as years and compared on that scale.
 * Exceeding the bar is not scored above meeting it: an over-qualified
 * volunteer is a fine answer to a request, not a better one, and rewarding it
 * would push senior people to the top of every list including the ones that
 * asked for nothing in particular.
 */
function experienceDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[],
  cautions: Signal[]
): number | null {
  const requiredKey = norm(need.experienceRequired);
  if (!requiredKey) return null;

  const required = EXPERIENCE_REQUIRED_YEARS[requiredKey];
  if (required === undefined) return null;
  if (required === 0) return 1; // "Any" — the request said it does not mind.

  const held = tableValue(EXPERIENCE_YEARS, volunteer.yearsExperience);
  const certified = norm(volunteer.certifications) !== "";

  if (held === null) {
    // Nothing to compare. A licence on file still says something on its own.
    if (certified) {
      reasons.push({ code: "certified", value: volunteer.certifications ?? undefined });
      return 0.7;
    }
    return null;
  }

  let ratio = held >= required ? 1 : Math.max(0.05, held / required);
  if (held >= required) {
    reasons.push({ code: "experience-meets", value: volunteer.yearsExperience ?? undefined });
  } else {
    cautions.push({ code: "experience-below", value: volunteer.yearsExperience ?? undefined });
  }

  if (certified) {
    reasons.push({ code: "certified", value: volunteer.certifications ?? undefined });
    ratio = Math.min(1, ratio + 0.15);
  } else if (requiredKey === "Senior / licensed") {
    // The request asked for a licence in as many words. Nothing on file is not
    // proof there is none, so this caps rather than fails — but a coordinator
    // has to know before they send someone.
    cautions.push({ code: "no-certification-on-file" });
    ratio = Math.min(ratio, 0.75);
  }

  return ratio;
}

/**
 * Commitment and logistics (weight 10).
 *
 * "How you can contribute" is the closest thing the volunteer form has to a
 * statement of intent, so it is read against what this particular request
 * involves rather than counted as a total.
 *
 * The travel-support check does not try to decide whether someone can afford
 * the journey — the form never asks, and the tracker already refuses to guess
 * at that same split. It flags the combination for a human: far from home, and
 * a request that provides none of accommodation, food or transport.
 */
function commitmentDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[],
  cautions: Signal[]
): number | null {
  const offered = volunteer.contribution;
  if (offered.length === 0) return null;

  const parts = new Parts();
  const onSite = worksOnSite(need.workMode);

  if (onSite) {
    const travels = has(offered, "I can travel");
    parts.add(travels ? 1 : 0.4);
    if (travels) reasons.push({ code: "can-travel" });
  }
  if (worksRemotely(need.workMode)) {
    parts.add(has(offered, "I can help remotely") ? 1 : 0.4);
  }
  parts.add(has(offered, "I can contribute time") ? 1 : 0.5);

  if (need.resourcesRequired.length > 0) {
    const material =
      has(offered, "I can provide equipment") || has(offered, "I can contribute logistics");
    parts.add(material ? 1 : 0.5);
  }

  const supported =
    norm(need.accommodation) === "Provided" ||
    norm(need.food) === "Provided" ||
    norm(need.transport) === "Provided" ||
    norm(need.transport) === "Reimbursed";

  if (onSite) {
    const km = districtDistanceKm(volunteer.district, need.district);
    const farFromHome = isOutsideNepal(volunteer.district) || (km !== null && km > 60);
    if (supported) reasons.push({ code: "support-provided" });
    else if (farFromHome) cautions.push({ code: "unsupported-travel" });
  }

  return parts.value;
}

/**
 * Resources (weight 6).
 *
 * Small, because most requests are asking for people. It reports no data far
 * more often than it scores — see RESOURCE_MAP for the categories the
 * volunteer form has no way to offer, funding among them.
 */
function resourcesDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[]
): number | null {
  const wanted = need.resourcesRequired.filter((r) => RESOURCE_MAP[norm(r)]);
  if (wanted.length === 0) return null;

  let met = 0;
  const matched: string[] = [];
  for (const item of wanted) {
    const accepted = RESOURCE_MAP[norm(item)] ?? [];
    if (accepted.some((offer) => has(volunteer.resources, offer))) {
      met += 1;
      matched.push(item);
    }
  }

  if (matched.length > 0) reasons.push({ code: "brings-resources", value: matched.join(", ") });
  return met / wanted.length;
}

/**
 * Language (weight 4).
 *
 * Small and blunt on purpose. Nepali is the working language almost
 * everywhere, so listing it answers the question; a regional language spoken
 * in the province the work is in is worth as much again. English alone is not
 * a failure — plenty of coordination happens in it — but on a ward-level job
 * outside the valley it is worth a coordinator knowing before they call.
 */
function languageDimension(
  need: MatchableNeed,
  volunteer: MatchableVolunteer,
  reasons: Signal[],
  cautions: Signal[]
): number | null {
  if (volunteer.languages.length === 0) return null;

  if (has(volunteer.languages, "Nepali")) {
    reasons.push({ code: "speaks-nepali" });
    return 1;
  }

  const province = need.province
    ? lower(need.province)
    : (provinceOf(need.district) ?? "");
  for (const language of volunteer.languages) {
    const regions = LANGUAGE_REGIONS[norm(language)];
    if (regions && province && regions.some((r) => lower(r) === province)) {
      reasons.push({ code: "speaks-local-language", value: language });
      return 1;
    }
  }

  cautions.push({ code: "no-nepali-listed" });
  return 0.5;
}

/* ------------------------------------------------------------ Assessment */

/**
 * How well one volunteer fits one need, with the reasoning attached.
 *
 * Blockers are returned rather than turned into a null result, so a
 * coordinator asking "why isn't she on this list" gets an answer instead of a
 * silence. An ineligible pairing scores 0 and keeps its dimensions unrun —
 * there is nothing to rank, and a number beside a blocked pairing would only
 * invite someone to override it on the strength of the number.
 */
export function assessMatch(
  need: MatchableNeed,
  volunteer: MatchableVolunteer
): MatchAssessment {
  const blockers = gates(need, volunteer);
  if (blockers.length > 0) {
    return {
      needId: need.id,
      volunteerId: volunteer.id,
      eligible: false,
      blockers,
      score: 0,
      band: "ineligible",
      confidence: 0,
      dimensions: [],
      reasons: [],
      cautions: [],
    };
  }

  const reasons: Signal[] = [];
  const cautions: Signal[] = [];

  const ratios: Record<DimensionId, number | null> = {
    skill: skillDimension(need, volunteer, reasons, cautions),
    location: locationDimension(need, volunteer, reasons, cautions),
    availability: availabilityDimension(need, volunteer, reasons, cautions),
    experience: experienceDimension(need, volunteer, reasons, cautions),
    commitment: commitmentDimension(need, volunteer, reasons, cautions),
    resources: resourcesDimension(need, volunteer, reasons),
    language: languageDimension(need, volunteer, reasons, cautions),
  };

  const dimensions: DimensionResult[] = (Object.keys(DIMENSION_WEIGHTS) as DimensionId[]).map(
    (id) => ({ id, weight: DIMENSION_WEIGHTS[id], ratio: ratios[id] })
  );

  // The average is over answered weight only. A registration that skipped the
  // optional sections is scored on what it says, and what is missing is
  // reported as confidence rather than quietly dragging the score down.
  let answeredWeight = 0;
  let earned = 0;
  for (const dimension of dimensions) {
    if (dimension.ratio === null) continue;
    answeredWeight += dimension.weight;
    earned += dimension.weight * dimension.ratio;
  }

  const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
  const confidence = answeredWeight / totalWeight;
  const average = answeredWeight === 0 ? 0 : (earned / answeredWeight) * 100;

  // See skillCeiling: the dimensions are not independent, and no amount of
  // being nearby, free and experienced makes someone able to do work they have
  // no skill for. A need that listed no skills has no ceiling to impose.
  const ceiling = ratios.skill === null ? 100 : skillCeiling(ratios.skill);
  const score = Math.round(Math.min(average, ceiling));

  if (confidence < CONFIDENCE_FOR_STRONG) cautions.push({ code: "low-information" });
  if (volunteer.status !== "verified") cautions.push({ code: "not-verified" });

  const safeguarded = need.skills.some((s) => SAFEGUARDED_SKILLS.has(norm(s)));
  const unvetted = safeguarded && volunteer.status !== "verified";
  if (unvetted) cautions.push({ code: "safeguarding-vetting" });

  return {
    needId: need.id,
    volunteerId: volunteer.id,
    eligible: true,
    blockers: [],
    score,
    band: bandFor(score, confidence, unvetted),
    confidence,
    dimensions,
    reasons,
    cautions,
  };
}

/**
 * The word put on a score, with the two cases where arithmetic is not enough
 * to earn the top one: a pairing built out of too few answers, and an
 * unverified volunteer on work that puts them next to people at risk. Both cap
 * at "possible" — still on the list, still explained, not presented as settled.
 */
function bandFor(score: number, confidence: number, unvetted: boolean): Band {
  if (score >= STRONG_AT && confidence >= CONFIDENCE_FOR_STRONG && !unvetted) return "strong";
  if (score >= POSSIBLE_AT) return "possible";
  return "stretch";
}

/* -------------------------------------------------------------- Ranking */

export type RankedVolunteer = {
  volunteer: MatchableVolunteer;
  assessment: MatchAssessment;
  /** What the list is ordered by. See the workload note below. */
  rank: number;
};

export type RankedNeed = {
  need: MatchableNeed;
  assessment: MatchAssessment;
  rank: number;
};

/**
 * Everything that decides the ORDER of a list without belonging in the score.
 *
 * The distinction runs through this whole file: how well someone fits a
 * request is a fact about the pair, and it is what gets shown beside their
 * name. How useful it is to put them at the top of a particular list is a
 * different question, and these three are its answer.
 *
 *   WORKLOAD. Concentrating every suggestion on the same few well-filled
 *   registrations is the failure mode a plain top-K ranking has: those people
 *   get asked until they stop answering, while requests they cannot take sit
 *   empty next to a register full of people nobody contacted. Balancing
 *   workload is a standing objective in the volunteer-assignment literature;
 *   this is the cheapest form of it, a gentle divisor that reorders people who
 *   were close anyway without ever hiding a clearly better fit.
 *
 *   CONFIDENCE. A registration with two questions answered can score higher
 *   than one with fourteen, because the average only counts what was answered
 *   — which is the right way to score it and the wrong way to rank it. This
 *   settles the tie towards the person whose form actually says they are free,
 *   without pushing the thin one off the list: a promising blank registration
 *   is a registration someone should chase.
 *
 *   VERIFICATION. At an equal score, the person a verifier has already checked
 *   is the one a coordinator can act on today.
 *
 * All three are deliberately weak. They break ties; they do not reorder a
 * clearly better match below a worse one.
 */
const WORKLOAD_DAMPENING = 0.25;

function rankFactor(volunteer: MatchableVolunteer, confidence: number): number {
  const workload = 1 / (1 + WORKLOAD_DAMPENING * Math.max(0, volunteer.activeMatches));
  const known = 0.7 + 0.3 * confidence;
  const checked = volunteer.status === "verified" ? 1 : 0.97;
  return workload * known * checked;
}

/**
 * Volunteers for one need, best first.
 *
 * Ineligible pairings are kept and sorted to the end rather than dropped: the
 * admin screen shows them, collapsed, with the blocker named, because "nobody
 * matched" and "eleven people matched but all of them said they cannot travel"
 * call for completely different actions from a coordinator.
 */
export function rankVolunteersForNeed(
  need: MatchableNeed,
  volunteers: MatchableVolunteer[]
): RankedVolunteer[] {
  return volunteers
    .map((volunteer) => {
      const assessment = assessMatch(need, volunteer);
      return {
        volunteer,
        assessment,
        rank: assessment.eligible
          ? assessment.score * rankFactor(volunteer, assessment.confidence)
          : -1,
      };
    })
    .sort((a, b) => b.rank - a.rank || (a.volunteer.name ?? "").localeCompare(b.volunteer.name ?? ""));
}

/**
 * How much more attention an urgency level deserves.
 *
 * This multiplies the ORDER of needs shown to a volunteer and on the
 * coordination queue — never the fit score. A request being urgent does not
 * make anyone a better match for it; it makes it the one to look at first.
 * The vocabulary is the design's own, with the timeframes it states:
 * immediate is 0–72 hours, urgent is a week, upcoming is a month.
 */
export const URGENCY_WEIGHT: Record<string, number> = {
  Immediate: 1.6,
  Urgent: 1.3,
  Upcoming: 1.0,
  Reconstruction: 0.85,
};

/** The weight for a stored urgency answer; 1 for anything unrecognised. */
export function urgencyWeight(urgency: string | null | undefined): number {
  return URGENCY_WEIGHT[norm(urgency)] ?? 1;
}

/**
 * How far short of the people it asked for a request still is, 0–1.
 *
 * A request with no number given ("as many as can come") is treated as still
 * open at 0.6 rather than as filled: the form allows that answer and the
 * board renders it honestly elsewhere, so it must not fall silently off the
 * bottom of a queue here.
 */
export function shortfall(need: Pick<MatchableNeed, "peopleNeeded" | "committed">): number {
  if (need.peopleNeeded === null) return need.committed > 0 ? 0.4 : 0.6;
  if (need.peopleNeeded <= 0) return 0;
  return Math.max(0, (need.peopleNeeded - need.committed) / need.peopleNeeded);
}

/**
 * Needs for one volunteer, most worth their attention first.
 *
 * Fit decides whether a request belongs on the list at all; urgency and how
 * far short of its people it still is decide the order among the ones that do.
 * A perfectly-matched request that is already full should not sit above an
 * immediate one that is empty.
 */
export function rankNeedsForVolunteer(
  volunteer: MatchableVolunteer,
  needs: MatchableNeed[]
): RankedNeed[] {
  return needs
    .map((need) => {
      const assessment = assessMatch(need, volunteer);
      const urgency = urgencyWeight(need.urgency);
      // Never zero: a filled request that fits someone perfectly is still
      // worth showing them, just last.
      const openness = 0.25 + 0.75 * shortfall(need);
      return {
        need,
        assessment,
        rank: assessment.eligible ? assessment.score * urgency * openness : -1,
      };
    })
    .sort((a, b) => b.rank - a.rank);
}
