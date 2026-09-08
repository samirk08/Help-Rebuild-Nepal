import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { added } from "../lib/added-strings";
import { TRANSLATED_CODES, messageFor } from "../lib/form-errors";
import {
  anonymousParty,
  clarificationMail,
  introductionMail,
  invitationMail,
  langOf,
  mailPath,
  otherPartyLabel,
} from "../lib/mail-copy";
import type { FieldError } from "../lib/intake-schema";

/**
 * Whether this platform speaks Nepali where it is supposed to, and English
 * where it is supposed to.
 *
 * Two rules, and they point in opposite directions on purpose:
 *
 * Outbound mail is English only. That is a decision — one wording of each
 * message to review, correct and be accountable for, rather than two.
 *
 * Everything a person reads on the site is not. One of the three intake forms
 * used to put the server's raw English validation text into a toast, so a
 * Nepali reader offering tarpaulins was told "That item need is already fully
 * allocated". Nothing caught it, because English is a perfectly valid string.
 */

const DEVANAGARI = /[ऀ-ॿ]/;

const invitation = {
  name: "Sita",
  roleTitle: "Structural survey",
  startDate: "2026-10-01",
  endDate: "2026-10-14",
  hoursPerWeek: 12,
  workMode: "on_site",
  district: "Sindhupalchok",
  reasons: ["• Engineering skills match", "Explicit interest in this need"],
  requesterEmail: "ward7@example.np",
  responseUrl: "https://example.org/np/opportunities/abc",
};

const introduction = {
  roleTitle: "Structural survey",
  startDate: "2026-10-01",
  endDate: "2026-10-14",
  hoursPerWeek: 12,
  otherPartyLabel: "Requester",
  otherPartyName: "Melamchi Ward 7",
  otherPartyEmail: "ward7@example.np",
};

test("every message this platform sends is in English", () => {
  // A decision, not an oversight: one wording of each message to review,
  // correct and be accountable for, rather than two. The site itself stays
  // bilingual — pages, form errors and confirmation screens all follow the
  // language someone registered in.
  const messages = [
    invitationMail(invitation),
    introductionMail(introduction),
    clarificationMail("Are you free 10-23 Sep?", "https://example.org/np/questions/abc"),
  ];

  for (const mail of messages) {
    assert.ok(!DEVANAGARI.test(mail.subject), `subject is not English: ${mail.subject}`);
    assert.ok(!DEVANAGARI.test(mail.text), `body is not English: ${mail.text.slice(0, 80)}`);
  }
});

test("an invitation carries the facts a person needs to decide", () => {
  const mail = invitationMail(invitation);
  for (const fact of [
    invitation.roleTitle,
    invitation.startDate,
    invitation.endDate,
    String(invitation.hoursPerWeek),
    invitation.district,
    invitation.requesterEmail,
    invitation.responseUrl,
    invitation.reasons[0],
  ]) {
    assert.ok(mail.text.includes(fact), `the invitation is missing ${fact}`);
  }
});

test("an introduction names the other party and how to reach them", () => {
  const mail = introductionMail(introduction);
  assert.ok(mail.text.includes(introduction.otherPartyEmail));
  assert.ok(mail.text.includes(introduction.otherPartyName));
  assert.equal(otherPartyLabel("requester"), "Requester");
  assert.equal(anonymousParty("volunteer"), "an HRN volunteer");
});

test("the link still lands on the page in the reader's own language", () => {
  // The message is English; the page it points at is not necessarily. Sending
  // a Nepali registrant to the English page would discard a translation that
  // already exists.
  assert.equal(langOf({ lang: "np" }), "np");
  assert.equal(langOf({ lang: "en" }), "en");
  // A row read as untyped JSON, a legacy row, a missing column: none of these
  // should stop a message being sent.
  assert.equal(langOf({ lang: null }), "en");
  assert.equal(langOf({}), "en");
  assert.equal(langOf(null), "en");
  assert.equal(langOf({ lang: "NP" }), "en");

  assert.equal(mailPath("np", "/questions/abc"), "/np/questions/abc");
  assert.equal(mailPath("en", "opportunities/abc"), "/en/opportunities/abc");
});

test("every validation code has a Nepali message", () => {
  const en = added("en");
  const npStrings = added("np");

  for (const code of TRANSLATED_CODES) {
    const problem = { field: "x", code, message: "ENGLISH FALLBACK" } as FieldError;

    const english = messageFor(problem, en);
    const nepali = messageFor(problem, npStrings);

    // Falling through to the server's English is the failure this list exists
    // to catch, and it is silent — the form renders a perfectly readable
    // sentence in the wrong language.
    assert.notEqual(english, "ENGLISH FALLBACK", `${code} has no English string`);
    assert.notEqual(nepali, "ENGLISH FALLBACK", `${code} has no Nepali string`);
    assert.ok(DEVANAGARI.test(nepali), `${code} is not translated: ${nepali}`);
  }
});

test("every code the server can emit is one the forms can translate", () => {
  // The union in lib/intake-schema.ts is the server's whole vocabulary. A code
  // added there without a case in lib/form-errors.ts reaches a person as
  // English, whichever form they are filling in.
  const schema = readFileSync("lib/intake-schema.ts", "utf8");
  const union = schema.slice(schema.indexOf("  code:"), schema.indexOf("  message: string;"));
  const declared = [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

  assert.ok(declared.length >= 9, "the code union was not found where expected");
  for (const code of declared) {
    assert.ok(
      (TRANSLATED_CODES as readonly string[]).includes(code),
      `${code} is emitted by the server but has no translation`
    );
  }
});

test("all three intake forms translate their errors rather than showing the server's", () => {
  // ReliefOfferForm used to put `err.errors[0].message` straight into a toast.
  for (const file of ["RequestForm", "NeedIntakeForm", "ReliefOfferForm"]) {
    const source = readFileSync(`components/${file}.tsx`, "utf8");
    assert.match(source, /messageFor/, `${file} must translate validation codes`);
    assert.ok(
      !/errors\[0\]\?\.message|problem\.message/.test(source),
      `${file} must not show the server's English directly`
    );
    // Being told something is wrong and left at the submit button, with the
    // failing control unannounced somewhere above, is not an error message.
    // NeedIntakeForm's version also switches step, hence the two names.
    assert.match(
      source,
      /focusFirstError|goToFirstError/,
      `${file} must move focus to the refused field`
    );
  }
});
