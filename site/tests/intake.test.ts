import { test } from "node:test";
import assert from "node:assert/strict";

import { validateIntake, validateReliefOffer } from "../lib/intake-schema";
import { INTAKE_BUDGET, consume, resetRateLimits } from "../lib/rate-limit";

function volunteerPayload(overrides: Record<string, unknown> = {}) {
  return {
    "s01-full-name": "Asha Rai",
    "s01-email": "asha@example.org",
    "s01-phone-whatsapp": "+977 9800000000",
    consent: "on",
    ...overrides,
  };
}

function needPayload(overrides: Record<string, unknown> = {}) {
  return {
    "s01-organization-name": "Sindhupalchok Rural Municipality",
    "s01-phone-email": "office@example.org",
    "s02-district": "Sindhupalchok",
    "s04-exactly-what-needs-to-be-done":
      "Assess twelve damaged homes and advise which can be repaired.",
    consent: "on",
    ...overrides,
  };
}

function codes(result: ReturnType<typeof validateIntake>): string[] {
  return result.ok ? [] : result.errors.map((e) => `${e.field}:${e.code}`);
}

test("a complete volunteer registration is accepted and normalised", () => {
  const result = validateIntake("volunteer", volunteerPayload({ "s01-full-name": "  Asha Rai  " }));
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(result.fields["s01-full-name"], "Asha Rai");
  assert.equal(result.fields["s01-email"], "asha@example.org");
});

test("every missing required answer is reported at once, not one per round trip", () => {
  const result = validateIntake("volunteer", { consent: "on" });
  assert.deepEqual(codes(result), [
    "s01-full-name:required",
    "s01-email:required",
    "s01-phone-whatsapp:required",
  ]);
});

test("consent is required on the server, not only by the checkbox", () => {
  const result = validateIntake("volunteer", volunteerPayload({ consent: undefined }));
  assert.deepEqual(codes(result), ["consent:consent_required"]);

  // A caller asserting some other value gets the same refusal.
  assert.deepEqual(
    codes(validateIntake("volunteer", volunteerPayload({ consent: "yes-please" }))),
    ["consent:consent_required"]
  );
});

test("malformed contact details are refused with the field that is wrong", () => {
  assert.deepEqual(
    codes(validateIntake("volunteer", volunteerPayload({ "s01-email": "asha[at]example.org" }))),
    ["s01-email:invalid_email"]
  );
  assert.deepEqual(
    codes(validateIntake("volunteer", volunteerPayload({ "s01-phone-whatsapp": "call me" }))),
    ["s01-phone-whatsapp:invalid_phone"]
  );
});

test("text is bounded, so a field cannot carry an arbitrary payload", () => {
  const long = "x".repeat(5000);
  assert.deepEqual(codes(validateIntake("volunteer", volunteerPayload({ "s01-full-name": long }))), [
    "s01-full-name:too_long",
  ]);

  // The long-text fields get a larger ceiling, but still a ceiling.
  const need = validateIntake(
    "need",
    needPayload({ "s04-exactly-what-needs-to-be-done": "y".repeat(5000) })
  );
  assert.deepEqual(codes(need), ["s04-exactly-what-needs-to-be-done:too_long"]);
});

test("an answer that is not on the offered list is refused, not stored", () => {
  const result = validateIntake(
    "need",
    needPayload({ "s08-how-urgent-is-this": "Drop everything" })
  );
  assert.deepEqual(codes(result), ["s08-how-urgent-is-this:invalid_option"]);

  const real = validateIntake("need", needPayload({ "s08-how-urgent-is-this": "Immediate" }));
  assert.ok(real.ok);
  assert.equal(real.fields["s08-how-urgent-is-this"], "Immediate");
});

test("dates must be real calendar dates", () => {
  assert.deepEqual(codes(validateIntake("need", needPayload({ "s05-start-date": "2026-02-30" }))), [
    "s05-start-date:invalid_date",
  ]);
  assert.deepEqual(codes(validateIntake("need", needPayload({ "s05-start-date": "31/03/2026" }))), [
    "s05-start-date:invalid_date",
  ]);

  const good = validateIntake("need", needPayload({ "s05-start-date": "2026-02-28" }));
  assert.ok(good.ok);
});

test("unknown keys are dropped rather than rejected, so an old tab still registers", () => {
  const result = validateIntake(
    "volunteer",
    volunteerPayload({ "s99-field-that-was-renamed": "something", injected: { nested: true } })
  );

  assert.ok(result.ok);
  assert.equal("s99-field-that-was-renamed" in result.fields, false);
  assert.equal("injected" in result.fields, false);
});

test("a non-object body is refused rather than treated as empty", () => {
  assert.equal(validateIntake("volunteer", null).ok, false);
  assert.equal(validateIntake("volunteer", "a string").ok, false);
  assert.equal(validateIntake("volunteer", [1, 2, 3]).ok, false);
});

test("a corrected resubmission is accepted after the first was refused", () => {
  const wrong = validateIntake("volunteer", volunteerPayload({ "s01-email": "not-an-email" }));
  assert.equal(wrong.ok, false);

  const fixed = validateIntake("volunteer", volunteerPayload({ "s01-email": "asha@example.org" }));
  assert.equal(fixed.ok, true);
});

test("a relief offer needs a positive quantity and a contact", () => {
  const bad = validateReliefOffer({ "relief-quantity": "0", "relief-contact": "x@example.org" });
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && bad.errors.some((e) => e.code === "invalid_number"));

  const noContact = validateReliefOffer({ "relief-quantity": "20" });
  assert.ok(!noContact.ok && noContact.errors.some((e) => e.field === "relief-contact"));

  const good = validateReliefOffer({
    "relief-quantity": "20",
    "relief-contact": "office@example.org",
    "relief-where": "Dolakha",
  });
  assert.ok(good.ok);
  assert.equal(good.pledge.quantity, 20);
  assert.equal(good.pledge.district, "Dolakha");
});

test("a deeply nested payload is refused at the boundary, not walked", () => {
  // An automated pull request proposed a recursion-depth guard inside
  // `stableStringify` in the submissions route, on the theory that a nested
  // payload could overflow the stack. The guard would have been the wrong
  // place: two different over-deep structures would both stringify to the same
  // sentinel, and identical keys mean the second submission is silently
  // discarded as a duplicate. Losing a registration is worse than the crash.
  //
  // The real defence is that nothing nested ever reaches it. The schema keeps
  // strings and arrays of strings and drops everything else, so what the
  // idempotency key is derived from is flat by construction.
  let nested: unknown = "bottom";
  for (let i = 0; i < 2000; i++) nested = { deeper: nested };

  const result = validateIntake("volunteer", volunteerPayload({ "s01-full-name": nested }));

  // The nested value is not a string, so the required-name rule rejects it.
  assert.deepEqual(codes(result), ["s01-full-name:required"]);

  // And when the nesting rides along on a key the schema does not know, it is
  // dropped rather than stored — so it never reaches the key derivation.
  const ignored = validateIntake("volunteer", volunteerPayload({ "s99-unknown": nested }));
  assert.ok(ignored.ok);
  for (const value of Object.values(ignored.fields)) {
    assert.ok(
      typeof value === "string" || (Array.isArray(value) && value.every((v) => typeof v === "string")),
      "every stored value must be a string or an array of strings"
    );
  }
});

test("the request budget refuses a caller past the limit and says when to retry", () => {
  resetRateLimits();
  const now = 1_000_000;

  for (let i = 0; i < INTAKE_BUDGET.limit; i++) {
    assert.equal(consume("intake:198.51.100.7", INTAKE_BUDGET, now).allowed, true, `call ${i}`);
  }

  const refused = consume("intake:198.51.100.7", INTAKE_BUDGET, now);
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds > 0);

  // A different caller is unaffected, and the window eventually reopens.
  assert.equal(consume("intake:203.0.113.9", INTAKE_BUDGET, now).allowed, true);
  assert.equal(
    consume("intake:198.51.100.7", INTAKE_BUDGET, now + INTAKE_BUDGET.windowMs + 1).allowed,
    true
  );
});
