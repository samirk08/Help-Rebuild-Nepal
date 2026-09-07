import { test } from "node:test";
import assert from "node:assert/strict";

import { N3, validateIntake, validateNeedV3, isNeedV3 } from "../lib/intake-schema";

/**
 * The three-step need intake.
 *
 * The form this replaces asked nine sections of someone in the middle of a
 * disaster. These tests pin the two properties that make the shorter one safe:
 * a request still cannot be filed without a way to reach the requester, and an
 * older browser tab posting the old shape is still accepted.
 */

function full(overrides: Record<string, string> = {}) {
  return {
    __form_version: "3",
    [N3.type]: "Skilled volunteers",
    [N3.title]: "Check twelve damaged homes",
    [N3.detail]:
      "Twelve houses in the ward have visible cracks and we need someone qualified to say which are safe to live in.",
    [N3.district]: "Sindhupalchok",
    [N3.workMode]: "On site",
    [N3.urgency]: "Immediate",
    [N3.organization]: "Ward 4 recovery group",
    [N3.email]: "ward4@example.org",
    consent: "on",
    ...overrides,
  };
}

function codes(result: ReturnType<typeof validateNeedV3>) {
  return result.ok ? [] : result.errors.map((e) => `${e.field}:${e.code}`);
}

test("a complete three-step request is accepted", () => {
  const result = validateNeedV3(full());
  assert.ok(result.ok);
  assert.equal(result.fields[N3.title], "Check twelve damaged homes");
  assert.equal(result.fields[N3.urgency], "Immediate");
});

test("email and phone are separate, and at least one is required", () => {
  // The old form ran them together in one "Phone / email" box, which is why no
  // need ever had a usable contact_email — and the matching engine will not
  // introduce a requester without one.
  const neither = validateNeedV3(full({ [N3.email]: "" }));
  assert.deepEqual(codes(neither), [`${N3.email}:required`]);

  const phoneOnly = validateNeedV3(full({ [N3.email]: "", [N3.phone]: "+977 9800000000" }));
  assert.ok(phoneOnly.ok);
  assert.equal(phoneOnly.fields[N3.phone], "+977 9800000000");
  assert.equal(N3.email in phoneOnly.fields, false);

  const both = validateNeedV3(full({ [N3.phone]: "+977 9800000000" }));
  assert.ok(both.ok);
  assert.equal(both.fields[N3.email], "ward4@example.org");
  assert.equal(both.fields[N3.phone], "+977 9800000000");
});

test("malformed contact details are refused on the field that is wrong", () => {
  assert.deepEqual(codes(validateNeedV3(full({ [N3.email]: "ward4[at]example.org" }))), [
    `${N3.email}:invalid_email`,
  ]);
  // A malformed phone reports only that. Adding "give us a contact detail" on
  // top would be a second complaint about an answer they did give, and the two
  // together read as though the form wants something else again.
  assert.deepEqual(
    codes(validateNeedV3(full({ [N3.email]: "", [N3.phone]: "ring the office" }))),
    [`${N3.phone}:invalid_phone`]
  );
});

test("consent is required, and an answer off the list is refused", () => {
  assert.deepEqual(codes(validateNeedV3(full({ consent: "" }))), ["consent:consent_required"]);
  assert.deepEqual(codes(validateNeedV3(full({ [N3.urgency]: "Drop everything" }))), [
    `${N3.urgency}:invalid_option`,
  ]);
  assert.deepEqual(codes(validateNeedV3(full({ [N3.type]: "Anything" }))), [
    `${N3.type}:invalid_option`,
  ]);
});

test("a one-line title and a real description are both required", () => {
  assert.deepEqual(codes(validateNeedV3(full({ [N3.title]: "" }))), [`${N3.title}:required`]);
  assert.deepEqual(codes(validateNeedV3(full({ [N3.title]: "roof" }))), [`${N3.title}:too_short`]);
  assert.deepEqual(codes(validateNeedV3(full({ [N3.detail]: "help" }))), [`${N3.detail}:too_short`]);
  assert.deepEqual(codes(validateNeedV3(full({ [N3.detail]: "x".repeat(5000) }))), [
    `${N3.detail}:too_long`,
  ]);
});

test("every missing step-one answer is reported at once", () => {
  const bare = {
    __form_version: "3",
    [N3.organization]: "Ward 4 recovery group",
    [N3.email]: "ward4@example.org",
    consent: "on",
  };
  assert.deepEqual(codes(validateNeedV3(bare)), [
    `${N3.type}:required`,
    `${N3.title}:required`,
    `${N3.detail}:required`,
    `${N3.district}:required`,
    `${N3.workMode}:required`,
    `${N3.urgency}:required`,
  ]);
});

test("asking for a call back needs a name, a number and consent — and nothing else", () => {
  // The whole point of the assisted path is that the person has not filled the
  // form in. Refusing it for a missing description would defeat the feature.
  const assisted = {
    __form_version: "3",
    [N3.assist]: "on",
    [N3.organization]: "Ward 4 recovery group",
    [N3.phone]: "+977 9800000000",
    consent: "on",
  };

  const result = validateNeedV3(assisted);
  assert.ok(result.ok);
  assert.equal(result.fields[N3.assist], "on");
  // It is still an ordinary submission, so it moves through verification like
  // any other request rather than sitting in a separate queue.
  assert.equal(result.fields[N3.organization], "Ward 4 recovery group");

  // A callback with no number to call is not a callback.
  assert.deepEqual(
    codes(validateNeedV3({ ...assisted, [N3.phone]: "" })),
    [`${N3.phone}:required`]
  );
  assert.deepEqual(
    codes(validateNeedV3({ ...assisted, consent: "" })),
    ["consent:consent_required"]
  );
});

test("an older tab posting the previous form is still accepted", () => {
  // A tab opened before this release posts the generated s01-/s02- keys.
  // Switching the rules under it would lose a request the person believed they
  // had filled in correctly.
  const legacy = {
    "s01-organization-name": "Sindhupalchok Rural Municipality",
    "s01-phone-email": "office@example.org",
    "s02-district": "Sindhupalchok",
    "s04-exactly-what-needs-to-be-done": "Assess twelve damaged homes and advise on repairs.",
    consent: "on",
  };

  assert.equal(isNeedV3(legacy), false);
  assert.equal(validateIntake("need", legacy).ok, true);

  // And the new shape routes to the new rules.
  assert.equal(isNeedV3(full()), true);
  assert.equal(validateIntake("need", full()).ok, true);
});

test("unknown keys never reach storage", () => {
  const result = validateNeedV3(full({ "n3-injected": "something", "s04-how-many-people": "40" }));
  assert.ok(result.ok);
  assert.equal("n3-injected" in result.fields, false);
  assert.equal("s04-how-many-people" in result.fields, false);
});
