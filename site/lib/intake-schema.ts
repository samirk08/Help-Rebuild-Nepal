import { NEED_SECTIONS, VOLUNTEER_SECTIONS, fieldKey, isSelectPlaceholder } from "./form-schema";
import type { SubmissionKind } from "./api";
import { applicableIntakeFields } from "./form-visibility";

/**
 * The single validation contract for everything that enters the system.
 *
 * The form and the API used to disagree about what a valid submission was: the
 * browser enforced `required` attributes the server never re-checked, and the
 * server enforced a consent rule the browser never showed. Anything that
 * bypassed the browser — a stale tab, a script, a retried fetch — landed
 * whatever it liked in `fields`.
 *
 * So the rules live here once, as data, and both sides read the same table.
 * `validateIntake` is pure and synchronous: no database, no network, no
 * `window`. That is what lets the API route and the React form share it, and
 * what lets the tests exercise every rule without a Supabase project.
 */

export type IntakeKind = Extract<SubmissionKind, "volunteer" | "need">;

/** One thing wrong with one field, in the language of the form. */
export type FieldError = {
  /** The control's `name`, so the form can focus it. */
  field: string;
  /** Machine-readable, for translation and tests. */
  code:
    | "required"
    | "too_long"
    | "too_short"
    | "invalid_email"
    | "invalid_phone"
    | "invalid_date"
    | "invalid_option"
    | "invalid_number"
    | "consent_required"
    | "not_meaningful"
    // Answers about the request rather than about what was typed: the offer is
    // well-formed, and the request cannot take it. Separate codes because
    // "check back if the arranged deliveries fall through" and "this is closed"
    // ask the donor to do different things.
    | "need_unavailable"
    | "need_closed"
    | "need_allocated"
    | "need_fully_offered";
  /** English fallback. The form maps `code` to a translated string. */
  message: string;
};

export type IntakeResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; errors: FieldError[] };

/** Bounds applied to every free-text answer, whatever the field. */
export const TEXT_LIMITS = { short: 200, line: 500, long: 4000 } as const;

/**
 * The largest intake body worth reading at all.
 *
 * Every field is bounded above, and the two forms have well under a hundred of
 * them, so a payload past this is not a long answer — it is someone probing how
 * much JSON the function will parse. Checked before `request.json()`, because
 * the point is to not buffer it.
 */
export const MAX_BODY_BYTES = 128 * 1024;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Digits, with the punctuation people actually type. At least 7 digits. */
const PHONE_PATTERN = /^[+()\-.\s0-9]{7,32}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fields that must carry a real answer, by kind, with the shape they must take.
 *
 * Keyed on the exact strings `fieldKey()` builds from the design's labels — the
 * same convention `COLUMN_FIELDS` in the submissions route uses, and for the
 * same reason: if the design renames a label, this table is the one place that
 * needs updating, and a missed rename shows up as a failing test rather than as
 * silently unvalidated data.
 */
type Rule = {
  key: string;
  as: "text" | "email" | "phone" | "date";
  max: number;
  min?: number;
  /** Refuse keyboard mashing — see `hasSubstance`. */
  meaningful?: boolean;
};

/**
 * Whether a value is writing rather than something typed to get past a form.
 *
 * A minimum length alone does not stop "aaaa", "...." or "asdfasdf" — and a
 * name field is where junk submissions land first, because it is the first box
 * on the page. Two distinct letters is a low bar deliberately: real names get
 * short ("Om", "ओम"), and refusing a real person's name is a far worse failure
 * than admitting one determined spammer.
 *
 * Unicode-aware, so Devanagari counts as letters. A check written with [a-z]
 * would reject every name written in Nepali, which is most of them.
 */
export function hasSubstance(value: string): boolean {
  const letters = value.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return false;
  return new Set(letters.map((c) => c.toLowerCase())).size >= 2;
}

const REQUIRED: Record<IntakeKind, Rule[]> = {
  volunteer: [
    { key: "s01-full-name", as: "text", max: TEXT_LIMITS.short, min: 2, meaningful: true },
    { key: "s01-email", as: "email", max: 254 },
    { key: "s01-phone-whatsapp", as: "phone", max: 32 },
    // Where they are, and what they can do. Both were optional, and a
    // registration missing either cannot be matched to anything: the engine
    // filters on skill and the travel checks need a location. A volunteer who
    // never hears from us because we could not place them is worse served than
    // one asked two more questions.
    { key: "s01-where-you-are-based", as: "text", max: TEXT_LIMITS.short },
    { key: "s03-primary-skill", as: "text", max: TEXT_LIMITS.short },
  ],
  need: [
    { key: "s01-organization-name", as: "text", max: TEXT_LIMITS.short, min: 2, meaningful: true },
    { key: "s01-phone-email", as: "text", max: TEXT_LIMITS.short, min: 5 },
    { key: "s02-district", as: "text", max: TEXT_LIMITS.short },
    {
      key: "s04-exactly-what-needs-to-be-done",
      as: "text",
      max: TEXT_LIMITS.long,
      min: 10,
      meaningful: true,
    },
  ],
};

/** Free-text fields that get the generous limit rather than the short one. */
const LONG_TEXT_KEYS = new Set([
  "s04-exactly-what-needs-to-be-done",
  "s04-objectives-what-success-looks-like",
  "s09-anything-else-volunteers-should-know",
  "s06-anything-else-we-should-know",
]);

/** Date fields, validated as calendar dates rather than as text. */
const DATE_KEYS = new Set(["s05-start-date", "s05-deadline"]);

function sections(kind: IntakeKind) {
  return kind === "volunteer" ? VOLUNTEER_SECTIONS : NEED_SECTIONS;
}

/**
 * Every option the design offers for each select/radio/chip field.
 *
 * Answers are checked against this rather than accepted as free text, so a
 * hand-rolled POST cannot write an arbitrary string into a column the board
 * filters on. Placeholder entries ("Select district") are not answers, so they
 * are excluded — picking one is the same as not answering.
 */
function allowedOptions(kind: IntakeKind): Map<string, Set<string>> {
  const allowed = new Map<string, Set<string>>();
  for (const section of sections(kind)) {
    for (const field of section.fields) {
      const options = field.options ?? field.rows?.map((row) => row.label);
      if (!options || options.length === 0) continue;
      // A district select is upgraded to the full 77-district widget, so its
      // ten design options are not the real answer set.
      if (field.widget === "district") continue;
      const values = options.filter((option) => !isSelectPlaceholder(option));
      allowed.set(fieldKey(section.n, field.label), new Set(values));
    }
  }
  return allowed;
}

const ALLOWED_OPTIONS: Record<IntakeKind, Map<string, Set<string>>> = {
  volunteer: allowedOptions("volunteer"),
  need: allowedOptions("need"),
};

/** Keys the schema knows about, plus the control fields the form adds itself. */
function knownKeys(kind: IntakeKind): Set<string> {
  const keys = new Set(["consent", "__form_version", "idempotencyKey"]);
  for (const section of sections(kind)) {
    for (const field of section.fields) keys.add(fieldKey(section.n, field.label));
  }
  return keys;
}

const KNOWN_KEYS: Record<IntakeKind, Set<string>> = {
  volunteer: knownKeys("volunteer"),
  need: knownKeys("need"),
};

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/** A real calendar date, not just four-two-two digits. */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function checkRule(rule: Rule, raw: unknown, errors: FieldError[]): void {
  const value = firstString(raw)?.trim() ?? "";

  if (value === "") {
    errors.push({ field: rule.key, code: "required", message: "This answer is required." });
    return;
  }
  if (value.length > rule.max) {
    errors.push({
      field: rule.key,
      code: "too_long",
      message: `Please keep this to ${rule.max} characters or fewer.`,
    });
    return;
  }
  if (rule.min !== undefined && value.length < rule.min) {
    errors.push({
      field: rule.key,
      code: "too_short",
      message: `Please give at least ${rule.min} characters.`,
    });
    return;
  }
  if (rule.meaningful && !hasSubstance(value)) {
    errors.push({
      field: rule.key,
      code: "not_meaningful",
      message: "Please write a real answer here.",
    });
    return;
  }
  if (rule.as === "email" && !EMAIL_PATTERN.test(value)) {
    errors.push({ field: rule.key, code: "invalid_email", message: "Enter a valid email address." });
  }
  if (rule.as === "phone" && !PHONE_PATTERN.test(value)) {
    errors.push({ field: rule.key, code: "invalid_phone", message: "Enter a valid phone number." });
  }
  if (rule.as === "date" && !isCalendarDate(value)) {
    errors.push({ field: rule.key, code: "invalid_date", message: "Enter a date as YYYY-MM-DD." });
  }
}

/**
 * The three-step need intake (form version 3).
 *
 * The old form asked nine sections of a person who is, by definition, in the
 * middle of something bad: exact coordinates, equipment on site, accommodation,
 * objectives, experience level required. Most of that is a coordinator's job to
 * establish during verification — `matching_roles` already exists for exactly
 * that — and asking for it up front is how a request gets abandoned halfway.
 *
 * So this collects what is needed to *triage* a request, and nothing else:
 * what and where, who to call, and confirm.
 *
 * Deliberately namespaced `n3-` rather than reusing the generated `s01-` keys.
 * Those come from the design file and can be regenerated; these are a stable
 * contract this form owns. Old submissions keep their own keys and still
 * render, because nothing rewrites them.
 */
export const NEED_TYPES = [
  "Skilled volunteers",
  "Relief items",
  "Assessment or survey",
  "Transport or logistics",
  "Something else",
] as const;

export const NEED_WORK_MODES = ["On site", "Remote", "Either"] as const;

/**
 * Stored verbatim in the `urgency` column, so these strings must keep matching
 * `URGENCY_OPTIONS` in lib/public-needs.ts or the board's filter silently
 * stops matching anything.
 */
export const NEED_URGENCY = ["Immediate", "Urgent", "Upcoming", "Reconstruction"] as const;

export const N3 = {
  type: "n3-type",
  title: "n3-title",
  detail: "n3-detail",
  district: "n3-district",
  municipality: "n3-municipality",
  workMode: "n3-work-mode",
  urgency: "n3-urgency",
  organization: "n3-organization",
  person: "n3-person",
  email: "n3-email",
  phone: "n3-phone",
  photos: "n3-photos",
  /** Set when the person asked to be called instead of finishing the form. */
  assist: "n3-assist",
} as const;

const N3_OPTIONS: Record<string, readonly string[]> = {
  [N3.type]: NEED_TYPES,
  [N3.workMode]: NEED_WORK_MODES,
  [N3.urgency]: NEED_URGENCY,
};

const N3_TEXT: Record<string, { max: number; min?: number; meaningful?: boolean }> = {
  [N3.title]: { max: TEXT_LIMITS.short, min: 6, meaningful: true },
  [N3.detail]: { max: TEXT_LIMITS.long, min: 20, meaningful: true },
  [N3.district]: { max: TEXT_LIMITS.short },
  [N3.municipality]: { max: TEXT_LIMITS.short },
  [N3.organization]: { max: TEXT_LIMITS.short, min: 2, meaningful: true },
  [N3.person]: { max: TEXT_LIMITS.short, min: 2, meaningful: true },
};

/** Whether this payload came from the three-step form. */
export function isNeedV3(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  return firstString((raw as Record<string, unknown>).__form_version) === "3";
}

/**
 * Validates a three-step need submission.
 *
 * The assisted path is the interesting case. Someone who asks to be called has
 * given us a name, a number and consent, and nothing else — that is the whole
 * point. Refusing it for a missing description would defeat the feature, so the
 * required set narrows to what a coordinator needs in order to ring them back.
 * It is still a `submissions` row with the same statuses, so it moves through
 * verification exactly like any other request.
 */
export function validateNeedV3(raw: unknown): IntakeResult {
  const errors: FieldError[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "", code: "required", message: "fields must be an object." }],
    };
  }

  const input = raw as Record<string, unknown>;
  const assisted = firstString(input[N3.assist]) === "on";
  const fields: Record<string, unknown> = {};

  const text = (key: string, required: boolean) => {
    const rule = N3_TEXT[key] ?? { max: TEXT_LIMITS.line };
    const value = firstString(input[key])?.trim() ?? "";

    if (value === "") {
      if (required) errors.push({ field: key, code: "required", message: "This answer is required." });
      return;
    }
    if (value.length > rule.max) {
      errors.push({
        field: key,
        code: "too_long",
        message: `Please keep this to ${rule.max} characters or fewer.`,
      });
      return;
    }
    if (rule.min !== undefined && value.length < rule.min) {
      errors.push({
        field: key,
        code: "too_short",
        message: `Please give at least ${rule.min} characters.`,
      });
      return;
    }
    // A length floor alone admits "aaaaaaaaaaaaaaaaaaaa". Only applied to the
    // fields that are meant to be prose or a name; a municipality can legitimately
    // be short and unusual.
    if (rule.meaningful && !hasSubstance(value)) {
      errors.push({
        field: key,
        code: "not_meaningful",
        message: "Please write a real answer here.",
      });
      return;
    }
    fields[key] = value;
  };

  const choice = (key: string, required: boolean) => {
    const value = firstString(input[key])?.trim() ?? "";
    if (value === "") {
      if (required) errors.push({ field: key, code: "required", message: "Choose one of these." });
      return;
    }
    if (!N3_OPTIONS[key].includes(value)) {
      errors.push({
        field: key,
        code: "invalid_option",
        message: "Choose one of the offered answers.",
      });
      return;
    }
    fields[key] = value;
  };

  // Step one. Skipped entirely on the assisted path — a coordinator fills it
  // in on the call, which is what the person asked for.
  choice(N3.type, !assisted);
  text(N3.title, !assisted);
  text(N3.detail, !assisted);
  text(N3.district, !assisted);
  text(N3.municipality, false);
  choice(N3.workMode, !assisted);
  choice(N3.urgency, !assisted);

  // Step two. Always required: without a way to reach the requester there is
  // no request, only a description of a problem.
  text(N3.organization, true);
  text(N3.person, false);

  const email = firstString(input[N3.email])?.trim() ?? "";
  const phone = firstString(input[N3.phone])?.trim() ?? "";

  if (email !== "") {
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      errors.push({ field: N3.email, code: "invalid_email", message: "Enter a valid email address." });
    } else {
      fields[N3.email] = email;
    }
  }
  if (phone !== "") {
    if (!PHONE_PATTERN.test(phone)) {
      errors.push({ field: N3.phone, code: "invalid_phone", message: "Enter a valid phone number." });
    } else {
      fields[N3.phone] = phone;
    }
  }

  // Email and phone are separate fields now — the old form ran them together
  // in one box, which is why no need ever had a usable `contact_email` and the
  // matching engine could never introduce a requester. At least one is needed;
  // a callback request obviously needs the phone.
  if (assisted && phone === "") {
    errors.push({
      field: N3.phone,
      code: "required",
      message: "A phone number is required so we can call you back.",
    });
  } else if (!assisted && email === "" && phone === "") {
    errors.push({
      field: N3.email,
      code: "required",
      message: "Give an email address or a phone number so we can reach you.",
    });
  }

  if (firstString(input.consent) !== "on") {
    errors.push({
      field: "consent",
      code: "consent_required",
      message: "Coordination consent is required.",
    });
  }

  if (assisted) fields[N3.assist] = "on";

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, fields };
}

/**
 * Validates one intake payload and returns the value that should be stored.
 *
 * Returns *every* problem rather than the first, because a form that reports
 * one error per round trip is how someone on a slow phone connection gives up
 * halfway through. The form focuses `errors[0].field` and shows the rest inline.
 *
 * Unknown keys are dropped rather than rejected: an older browser tab posting a
 * field that has since been renamed should still register the person, and the
 * full original payload is preserved upstream for provenance either way.
 */
export function validateIntake(kind: IntakeKind, raw: unknown): IntakeResult {
  // Version the payload rather than switching the rules under everyone. A tab
  // opened before this release still posts the old keys, and refusing it would
  // lose a request that the person believed they had filled in correctly.
  if (kind === "need" && isNeedV3(raw)) return validateNeedV3(raw);

  const errors: FieldError[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "", code: "required", message: "fields must be an object." }],
    };
  }

  const input = applicableIntakeFields(kind, raw as Record<string, unknown>);

  for (const rule of REQUIRED[kind]) checkRule(rule, input[rule.key], errors);

  if (firstString(input.consent) !== "on") {
    errors.push({
      field: "consent",
      code: "consent_required",
      message: "Coordination consent is required.",
    });
  }

  const allowed = ALLOWED_OPTIONS[kind];
  const known = KNOWN_KEYS[kind];
  const fields: Record<string, unknown> = {};

  // A required field that failed above is not reported again by the general
  // pass below. One field, one message: a list that says "too long" twice
  // about the same answer reads as two separate problems to fix.
  const reported = new Set(errors.map((problem) => problem.field));

  for (const [key, value] of Object.entries(input)) {
    if (!known.has(key)) continue;

    const values = Array.isArray(value) ? value : [value];
    const strings = values.filter((v): v is string => typeof v === "string");
    // Anything that is not a string or an array of strings never came from a
    // form control. Dropping it keeps nested objects out of `fields`, where a
    // jsonb `contains` query would later have to reason about them.
    if (strings.length !== values.length) continue;

    const options = allowed.get(key);
    if (options) {
      const picked = strings.map((s) => s.trim()).filter((s) => s !== "" && options.has(s));
      // An answer that is not on the list is an answer to a question this form
      // did not ask, so it is refused rather than stored.
      if (picked.length < strings.filter((s) => s.trim() !== "").length) {
        if (!reported.has(key)) {
          errors.push({
            field: key,
            code: "invalid_option",
            message: "Choose one of the offered answers.",
          });
          reported.add(key);
        }
        continue;
      }
      if (picked.length > 0) fields[key] = Array.isArray(value) ? picked : picked[0];
      continue;
    }

    const max = LONG_TEXT_KEYS.has(key) ? TEXT_LIMITS.long : TEXT_LIMITS.line;
    const trimmed = strings.map((s) => s.trim()).filter((s) => s !== "");
    if (trimmed.length === 0) continue;

    if (trimmed.some((s) => s.length > max)) {
      if (!reported.has(key)) {
        errors.push({
          field: key,
          code: "too_long",
          message: `Please keep this to ${max} characters or fewer.`,
        });
        reported.add(key);
      }
      continue;
    }
    if (DATE_KEYS.has(key) && trimmed.some((s) => !isCalendarDate(s))) {
      if (!reported.has(key)) {
        errors.push({ field: key, code: "invalid_date", message: "Enter a date as YYYY-MM-DD." });
        reported.add(key);
      }
      continue;
    }

    fields[key] = Array.isArray(value) ? trimmed : trimmed[0];
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, fields };
}

/**
 * The relief-offer payload, which is not a `submissions` row and so has its own
 * shape: it targets a published item need rather than describing one.
 */
export type ReliefResult =
  | {
      ok: true;
      pledge: {
        target: string | null;
        category: string | null;
        quantity: number;
        district: string | null;
        availableFrom: string | null;
        deliveryMethod: string | null;
        contact: string | null;
      };
    }
  | { ok: false; errors: FieldError[] };

export const UNMATCHED_SENTINEL = "__unmatched__"; // matches ReliefOfferForm.tsx

export function validateReliefOffer(raw: unknown): ReliefResult {
  const errors: FieldError[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ field: "", code: "required", message: "fields must be an object." }],
    };
  }

  const input = raw as Record<string, unknown>;
  const text = (key: string, max: number): string | null => {
    const value = firstString(input[key])?.trim() ?? "";
    if (value === "") return null;
    if (value.length > max) {
      errors.push({ field: key, code: "too_long", message: `Keep this to ${max} characters.` });
      return null;
    }
    return value;
  };

  const quantityRaw = firstString(input["relief-quantity"])?.trim() ?? "";
  const quantity = Number(quantityRaw);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    errors.push({
      field: "relief-quantity",
      code: "invalid_number",
      message: "Enter a quantity above zero.",
    });
  }

  const target = text("relief-target", 64);
  const category = text("relief-category", TEXT_LIMITS.short);
  const contact = text("relief-contact", TEXT_LIMITS.short);

  if (!contact) {
    errors.push({
      field: "relief-contact",
      code: "required",
      message: "A contact detail is required so the delivery can be arranged.",
    });
  } else if (!hasSubstance(contact)) {
    // A phone number is digits, so `hasSubstance` alone would refuse one. Any
    // answer with enough digits to dial, or enough letters to read, is real;
    // "aaaa" is neither.
    const digits = (contact.match(/\d/g) ?? []).length;
    if (digits < 6) {
      errors.push({
        field: "relief-contact",
        code: "not_meaningful",
        message: "Give a phone number or an email address we can actually reach you on.",
      });
    }
  }

  // Consent, checked here because the server is the only place it can be
  // enforced. The relief form relied on the browser's `required` attribute
  // until `noValidate` was added to make its own inline errors work — which
  // removed the only thing standing between a donor's contact details and
  // being shared without them agreeing to it.
  if (firstString(input.consent) !== "on") {
    errors.push({
      field: "consent",
      code: "consent_required",
      message: "Coordination consent is required.",
    });
  }

  const availableFrom = text("relief-available", 32);
  if (availableFrom && !isCalendarDate(availableFrom)) {
    errors.push({
      field: "relief-available",
      code: "invalid_date",
      message: "Enter a date as YYYY-MM-DD.",
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    pledge: {
      target,
      category,
      quantity,
      district: text("relief-where", TEXT_LIMITS.short),
      availableFrom,
      deliveryMethod: text("relief-delivery", TEXT_LIMITS.short),
      contact,
    },
  };
}
