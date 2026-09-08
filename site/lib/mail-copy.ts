import type { EmailPayload } from "./matching/email";

/**
 * Every message this platform sends.
 *
 * English only, by decision. The site itself is bilingual and stays that way —
 * a volunteer who registered in Nepali reads Nepali pages, Nepali form errors
 * and Nepali confirmation screens. Outbound mail does not follow, so that
 * there is one wording of each message to review, correct and be accountable
 * for rather than two.
 *
 * The one place language still matters is the link: a message points at the
 * page in the language the recipient registered in, because that page is the
 * product and it genuinely exists in both. `langOf` and `mailPath` below are
 * for that, and for nothing else.
 *
 * Kept as one file so the whole of what this platform says to people can be
 * read in one sitting.
 */

const SIGN_OFF = "Help Rebuild Nepal";

export type InvitationCopy = {
  name: string;
  roleTitle: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
  workMode: string;
  district: string | null;
  /** The engine's own reasons for choosing this person, already prose. */
  reasons: string[];
  requesterEmail: string;
  responseUrl: string;
};

export function invitationMail(c: InvitationCopy): EmailPayload {
  const where = c.district ? ` · ${c.district}` : "";
  const reasons = c.reasons.filter(Boolean).join("\n");

  return {
    to: "",
    subject: `Help Rebuild Nepal: ${c.roleTitle}`,
    text:
      `Hello ${c.name},\n\n` +
      `We would like to invite you to consider: ${c.roleTitle}.\n\n` +
      `${c.startDate} to ${c.endDate}\n` +
      `${c.hoursPerWeek} hours per week · ${c.workMode}${where}\n\n` +
      `Why we contacted you:\n${reasons}\n\n` +
      `Requester contact: ${c.requesterEmail}\n\n` +
      `Review the full need, support arrangements, and choose Proceed or Decline:\n${c.responseUrl}\n\n` +
      `Proceed confirms your interest and availability; the coordination team confirms ` +
      `the place with both parties. For on-site work, confirm that you can reach the ` +
      `location by the start date. You can also pause future invitations on this page.\n\n` +
      SIGN_OFF,
  };
}

export type IntroductionCopy = {
  roleTitle: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
  /** Who the recipient is being introduced to, and how to reach them. */
  otherPartyLabel: string;
  otherPartyName: string;
  otherPartyEmail: string;
};

/**
 * The introduction, sent to both sides once a coordinator confirms.
 *
 * Each side is addressed separately rather than sharing one body, because the
 * useful line — who to contact — is different for each of them, and a single
 * message that lists both parties makes each recipient work out which half is
 * theirs.
 */
export function introductionMail(c: IntroductionCopy): EmailPayload {
  return {
    to: "",
    subject: `Your HRN connection: ${c.roleTitle}`,
    text:
      `${c.otherPartyLabel}: ${c.otherPartyName} — ${c.otherPartyEmail}\n\n` +
      `You have both agreed to connect for ${c.roleTitle}, ${c.startDate} to ` +
      `${c.endDate}, ${c.hoursPerWeek} hours per week.\n\n` +
      `Please contact each other to arrange the work.\n\n` +
      SIGN_OFF,
  };
}

/** The label naming who is on the other end of an introduction. */
export function otherPartyLabel(side: "volunteer" | "requester"): string {
  return side === "volunteer" ? "Volunteer" : "Requester";
}

/** The fallback name when a registration never gave one. */
export function anonymousParty(side: "volunteer" | "requester"): string {
  return side === "volunteer" ? "an HRN volunteer" : "an HRN requester";
}

export function clarificationMail(question: string, url: string): EmailPayload {
  return {
    to: "",
    subject: "A quick question about volunteering with Help Rebuild Nepal",
    text:
      `${question}\n\n` +
      `You can answer here:\n${url}\n\n` +
      `Answering helps a coordinator work out whether an opportunity suits you. ` +
      `It is not a commitment to anything.\n\n` +
      SIGN_OFF,
  };
}

/**
 * The language of the page a message links to.
 *
 * Not the language of the message — that is always English. This decides where
 * the link lands, and the site genuinely exists in both languages, so sending
 * someone who registered in Nepali to the English page would be throwing away
 * a translation that is already there.
 *
 * `submissions.lang` is a check-constrained 'en' | 'np', but this is called
 * with rows read as `unknown` from several places, and a message that fails to
 * send because a language string was unexpected would be worse than one whose
 * link points at the English page.
 */
export function langOf(row: { lang?: string | null } | null | undefined): "en" | "np" {
  return row?.lang === "np" ? "np" : "en";
}

/** The path prefix for a link inside a message. */
export function mailPath(lang: "en" | "np", path: string): string {
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}
