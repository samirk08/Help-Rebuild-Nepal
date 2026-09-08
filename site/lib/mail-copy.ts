import type { Lang } from "./content";
import type { EmailPayload } from "./matching/email";

/**
 * Every message this platform sends, in the language the recipient registered
 * in.
 *
 * Until now all four were hard-coded English. A volunteer who filled in the
 * Nepali form, chose Nepali answers and read Nepali confirmation screens got an
 * invitation to real work — the one message in the whole system that asks them
 * to commit their time — written in a language the site had already been told
 * they did not pick. That is not a rough edge; it is the platform switching
 * languages at the exact moment it asks for something.
 *
 * One language per message, chosen from `submissions.lang`, rather than both
 * stacked in one email. Doubling every message makes the important part harder
 * to find, and the language someone filled the form in is the best evidence we
 * have of what they read comfortably. Where that datum is missing the copy
 * falls back to English, which is the status quo rather than a regression.
 *
 * TRANSLATION NOTE: the Nepali here is machine-supplied, like
 * `lib/added-strings.ts`. It should be read by a Nepali speaker before a
 * production rollout. It is kept in one file so that review is one file.
 */

const np = (lang: Lang) => lang === "np";

/** Plain-text emails, so the signature is a line rather than markup. */
const SIGN_OFF: Record<Lang, string> = {
  en: "Help Rebuild Nepal",
  np: "हेल्प रिबिल्ड नेपाल",
};

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

export function invitationMail(lang: Lang, c: InvitationCopy): EmailPayload {
  const where = c.district ? ` · ${c.district}` : "";
  const reasons = c.reasons.filter(Boolean).join("\n");

  if (np(lang)) {
    return {
      to: "",
      subject: `हेल्प रिबिल्ड नेपाल: ${c.roleTitle}`,
      text:
        `नमस्ते ${c.name},\n\n` +
        `हामी तपाईंलाई यो काममा सहभागी हुन निम्तो दिन चाहन्छौं: ${c.roleTitle}।\n\n` +
        `${c.startDate} देखि ${c.endDate} सम्म\n` +
        `हप्तामा ${c.hoursPerWeek} घण्टा · ${c.workMode}${where}\n\n` +
        `हामीले तपाईंलाई किन सम्पर्क गर्‍यौं:\n${reasons}\n\n` +
        `अनुरोधकर्ताको सम्पर्क: ${c.requesterEmail}\n\n` +
        `पूरा विवरण हेर्नुहोस् र स्वीकार गर्ने वा अस्वीकार गर्ने छान्नुहोस्:\n${c.responseUrl}\n\n` +
        `स्वीकार गर्नुले तपाईंको रुचि र उपलब्धता जनाउँछ; संयोजन टोलीले दुवै पक्षसँग पुष्टि गर्नेछ। ` +
        `स्थलगत कामको हकमा, सुरु हुने मितिसम्म त्यहाँ पुग्न सक्नुहुन्छ भन्ने निश्चित गर्नुहोस्। ` +
        `यही पृष्ठबाट भविष्यका निम्तोहरू रोक्न पनि सक्नुहुन्छ।\n\n` +
        SIGN_OFF.np,
    };
  }

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
      SIGN_OFF.en,
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
export function introductionMail(lang: Lang, c: IntroductionCopy): EmailPayload {
  if (np(lang)) {
    return {
      to: "",
      subject: `तपाईंको जोडी: ${c.roleTitle}`,
      text:
        `${c.otherPartyLabel}: ${c.otherPartyName} — ${c.otherPartyEmail}\n\n` +
        `${c.roleTitle} का लागि तपाईं दुवै जना सँगै काम गर्न सहमत हुनुभएको छ, ` +
        `${c.startDate} देखि ${c.endDate} सम्म, हप्तामा ${c.hoursPerWeek} घण्टा।\n\n` +
        `कृपया काम मिलाउन एकअर्कालाई सम्पर्क गर्नुहोस्।\n\n` +
        SIGN_OFF.np,
    };
  }

  return {
    to: "",
    subject: `Your HRN connection: ${c.roleTitle}`,
    text:
      `${c.otherPartyLabel}: ${c.otherPartyName} — ${c.otherPartyEmail}\n\n` +
      `You have both agreed to connect for ${c.roleTitle}, ${c.startDate} to ` +
      `${c.endDate}, ${c.hoursPerWeek} hours per week.\n\n` +
      `Please contact each other to arrange the work.\n\n` +
      SIGN_OFF.en,
  };
}

/** The label naming who is on the other end of an introduction. */
export function otherPartyLabel(lang: Lang, side: "volunteer" | "requester"): string {
  if (np(lang)) return side === "volunteer" ? "स्वयंसेवक" : "अनुरोधकर्ता";
  return side === "volunteer" ? "Volunteer" : "Requester";
}

/** The fallback name when a registration never gave one. */
export function anonymousParty(lang: Lang, side: "volunteer" | "requester"): string {
  if (np(lang)) return side === "volunteer" ? "एक स्वयंसेवक" : "एक अनुरोधकर्ता";
  return side === "volunteer" ? "an HRN volunteer" : "an HRN requester";
}

export function clarificationMail(lang: Lang, question: string, url: string): EmailPayload {
  if (np(lang)) {
    return {
      to: "",
      subject: "स्वयंसेवाबारे एउटा छोटो प्रश्न",
      text:
        `${question}\n\n` +
        `यहाँ जवाफ दिन सक्नुहुन्छ:\n${url}\n\n` +
        `जवाफ दिनुले संयोजकलाई कुन अवसर तपाईंलाई मिल्छ भनी बुझ्न मद्दत गर्छ। ` +
        `यो कुनै काम स्वीकार गर्नु होइन।\n\n` +
        SIGN_OFF.np,
    };
  }

  return {
    to: "",
    subject: "A quick question about volunteering with Help Rebuild Nepal",
    text:
      `${question}\n\n` +
      `You can answer here:\n${url}\n\n` +
      `Answering helps a coordinator work out whether an opportunity suits you. ` +
      `It is not a commitment to anything.\n\n` +
      SIGN_OFF.en,
  };
}

/**
 * The language a message to this person should be written in.
 *
 * `submissions.lang` is a check-constrained 'en' | 'np', but this is called
 * with rows read as `unknown` from several places, and a message that fails to
 * send because a language string was unexpected would be worse than one sent in
 * English.
 */
export function langOf(row: { lang?: string | null } | null | undefined): Lang {
  return row?.lang === "np" ? "np" : "en";
}

/** The path prefix for a link inside a message written in this language. */
export function mailPath(lang: Lang, path: string): string {
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}
