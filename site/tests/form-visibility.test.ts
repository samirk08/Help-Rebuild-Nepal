import test from "node:test";
import assert from "node:assert/strict";
import { FORM_SECTION_ORDER, WORK_MODE_FIELD, applicableIntakeFields, hiddenIntakeFields } from "../lib/form-visibility";
import { NEED_SECTIONS, VOLUNTEER_SECTIONS, fieldKey } from "../lib/form-schema";
import { validateIntake } from "../lib/intake-schema";

test("only explicit remote work hides deployment: mixed, blank and remote contribution stay eligible", () => {
  for (const kind of ["volunteer", "need"] as const) {
    for (const value of ["Both", "On the ground", "", undefined]) {
      assert.equal(hiddenIntakeFields(kind, { [WORK_MODE_FIELD[kind]]: value }).size, 0);
    }
    assert.ok(hiddenIntakeFields(kind, { [WORK_MODE_FIELD[kind]]: "Remote" }).size > 0);
    assert.ok(hiddenIntakeFields(kind, { [WORK_MODE_FIELD[kind]]: [" Remote "] }).size > 0);
  }
  assert.equal(hiddenIntakeFields("volunteer", { "s02-how-you-can-contribute": ["I can help remotely", "I can travel"] }).size, 0);
});

test("remote volunteers keep resources, availability and their base; stale deployment answers are dropped", () => {
  const fields = {
    "s01-full-name": "Test Volunteer", "s01-email": "test@example.org",
    "s01-phone-whatsapp": "+977 9800000000", consent: "on",
    "s05-where-you-can-work": "Remote", "s05-travel": "Anywhere in Nepal",
    "s05-preferred-districts": "Kathmandu", "s04-maximum-single-deployment": "2 weeks",
    "s04-hours-per-week": "5–15", "s06-resources": ["Equipment", "Vehicle"],
    "s06-details": "Equipment delivery can be arranged.", "s01-where-you-are-based": "Kathmandu",
    "s03-primary-skill": "Engineering (structural / civil)",
  };
  const result = validateIntake("volunteer", fields);
  assert.ok(result.ok);
  for (const field of hiddenIntakeFields("volunteer", fields)) assert.equal(field in result.fields, false);
  assert.deepEqual(result.fields["s06-resources"], ["Equipment", "Vehicle"]);
  assert.equal(result.fields["s04-hours-per-week"], "5–15");
  assert.equal(result.fields["s01-where-you-are-based"], "Kathmandu");
  assert.equal(fields["s05-travel"], "Anywhere in Nepal", "filtering must not erase browser answers");
  assert.equal(applicableIntakeFields("volunteer", { ...fields, "s05-where-you-can-work": "Both" })["s05-travel"], "Anywhere in Nepal");
});

test("remote needs keep the community location and resource requests, omit on-site support", () => {
  const fields = {
    "s01-organization-name": "Test Municipality", "s01-phone-email": "test@example.org",
    "s02-district": "Kathmandu", "s04-exactly-what-needs-to-be-done": "Review building plans remotely.",
    "s07-where-the-work-happens": "Remote", "s06-accommodation": "stale answer",
    "s06-food": "stale answer", "s06-transport": "stale answer",
    "s06-equipment-available-on-site": "stale answer", consent: "on",
  };
  const result = validateIntake("need", fields);
  assert.ok(result.ok, "irrelevant legacy answers should not block submission");
  assert.equal(result.fields["s02-district"], "Kathmandu");
  for (const field of hiddenIntakeFields("need", fields)) assert.equal(field in result.fields, false);
  assert.equal(hiddenIntakeFields("need", fields).has("s03-resources-required"), false);
});

test("every schema section appears once after reordering, and every conditional field exists", () => {
  for (const [kind, sections] of [["volunteer", VOLUNTEER_SECTIONS], ["need", NEED_SECTIONS]] as const) {
    assert.deepEqual([...FORM_SECTION_ORDER[kind]].sort(), sections.map((section) => section.n).sort());
    const keys = new Set(sections.flatMap((section) => section.fields.map((field) => fieldKey(section.n, field.label))));
    for (const field of hiddenIntakeFields(kind, { [WORK_MODE_FIELD[kind]]: "Remote" })) assert.ok(keys.has(field), field);
    assert.ok(keys.has(WORK_MODE_FIELD[kind]));
  }
});
