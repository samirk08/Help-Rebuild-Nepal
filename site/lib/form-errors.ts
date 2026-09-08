import type { added } from "./added-strings";
import type { FieldError } from "./intake-schema";

/**
 * One translation of a validation failure, for every form.
 *
 * There were three copies of this. Two were near-identical `switch` statements
 * in RequestForm and NeedIntakeForm that had already drifted — one handled
 * `invalid_date` and `invalid_number`, the other silently fell through to the
 * server's English on both. The third was ReliefOfferForm, which showed the raw
 * server string in a toast, so a Nepali reader offering tarpaulins was told
 * "That item need is already fully allocated and is not taking new offers."
 *
 * The `code` is what carries across languages; `message` is the English the
 * server happened to write, kept as a last resort so a code added on the server
 * before it is added here degrades to something readable rather than blank.
 */

export type Strings = ReturnType<typeof added>;

export function messageFor(problem: FieldError, t: Strings): string {
  switch (problem.code) {
    case "required":
      return t.errRequired;
    case "too_long":
      return t.errTooLong;
    case "too_short":
      return t.errTooShort;
    case "invalid_email":
      return t.errInvalidEmail;
    case "invalid_phone":
      return t.errInvalidPhone;
    case "invalid_date":
      return t.errInvalidDate;
    case "invalid_option":
      return t.errInvalidOption;
    case "invalid_number":
      return t.errInvalidNumber;
    case "consent_required":
      return t.errConsent;

    // Relief-specific refusals. These are answers about the request, not
    // complaints about what was typed, and collapsing them into "that is not a
    // valid choice" would throw away the only sentence that tells the donor
    // what to do next.
    case "need_unavailable":
      return t.errNeedUnavailable;
    case "need_closed":
      return t.errNeedClosed;
    case "need_allocated":
      return t.errNeedAllocated;
    case "need_fully_offered":
      return t.errNeedFullyOffered;

    default:
      return problem.message;
  }
}

/**
 * Every code this module translates.
 *
 * Exported so a test can assert the server never emits one that has no Nepali
 * behind it. A code with no case above falls through to English, which is
 * exactly the failure this file exists to remove — and it is invisible unless
 * something enumerates them.
 */
export const TRANSLATED_CODES = [
  "required",
  "too_long",
  "too_short",
  "invalid_email",
  "invalid_phone",
  "invalid_date",
  "invalid_option",
  "invalid_number",
  "consent_required",
  "need_unavailable",
  "need_closed",
  "need_allocated",
  "need_fully_offered",
] as const;
