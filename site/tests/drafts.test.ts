import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A half-finished form, kept on the device.
 *
 * The volunteer registration is nine sections long and the need form is three
 * steps. Someone filling either in on a phone with a bad connection should not
 * lose it to a dropped tab — and a half-written registration is not something
 * to store on our side without being asked, because nobody has consented to
 * anything at that point.
 *
 * Verified end to end in a real browser during development: type, reload, the
 * field is empty, the restore is offered, and the answer comes back. These
 * assertions hold the properties that make that true, so the behaviour cannot
 * be refactored away silently.
 */

const forms = ["RequestForm", "NeedIntakeForm"] as const;

for (const form of forms) {
  test(`${form} keeps a draft on the device and never sends it`, () => {
    const source = readFileSync(join("components", `${form}.tsx`), "utf8");

    assert.match(source, /localStorage/, "a draft lives on the device");
    // The draft must never travel. If it did, an abandoned form would become a
    // record of someone's half-answered questions that they never submitted.
    const submitted = source.slice(source.indexOf("submitRequest"), source.indexOf("submitRequest") + 400);
    assert.ok(!/localStorage/.test(submitted), "a draft must not be sent with the submission");

    // Cleared once the submission is safely recorded, or the next person to
    // open the form on a shared phone is offered someone else's answers.
    assert.match(source, /clearDraft\(\)/, "a saved submission clears its draft");

    // Every storage call is guarded: private browsing throws on setItem, and
    // losing a draft is not worth an error on top of whatever the person is
    // already dealing with.
    const calls = [...source.matchAll(/window\.localStorage\.\w+\(/g)];
    assert.ok(calls.length >= 3, "expected save, read and clear");
    for (const call of calls) {
      const before = source.slice(Math.max(0, call.index - 200), call.index);
      assert.match(before, /try\s*\{/, `unguarded localStorage call in ${form}`);
    }
  });

  test(`${form} offers a draft rather than applying it`, () => {
    const source = readFileSync(join("components", `${form}.tsx`), "utf8");
    // Someone returning to start a different registration must not silently
    // inherit the last one.
    assert.match(source, /draftOffer/, "the draft is offered, not auto-applied");
    assert.match(source, /DraftRestore|DraftFound/, "the offer is worded, not implicit");
    assert.match(source, /DraftDiscard/, "declining must be possible");
  });
}

test("a restored draft carries every answer, not just the last one of each", () => {
  // A chip group holds several answers. Storing one value per field would
  // silently drop every skill but the last, which is worse than not restoring
  // at all: the form would look complete and be wrong.
  const source = readFileSync(join("components", "RequestForm.tsx"), "utf8");
  assert.match(source, /Record<string, string\[\]>/, "draft values are lists");
  assert.match(source, /\(draft\[key\] \?\?= \[\]\)\.push\(value\)/);
});

test("restoring seeds the controls rather than writing into them afterwards", () => {
  // These forms are uncontrolled, so a restored answer has to arrive as a
  // defaultValue when the control is created. Writing it in afterwards is what
  // left the district box visibly empty while its hidden input held a value.
  const form = readFileSync(join("components", "RequestForm.tsx"), "utf8");
  assert.match(form, /key=\{formKey\}/, "the form remounts so defaults are read");
  assert.match(form, /defaultValue=\{seed\?\.\[fieldName\]\}/);

  const field = readFileSync(join("components", "FormField.tsx"), "utf8");
  assert.match(field, /defaultChecked=\{seededSet\.has\(option\)\}/, "chips restore");
  assert.match(field, /defaultChecked=\{seededSet\.has\(row\.label\)\}/, "radios restore");

  const combobox = readFileSync(join("components", "Combobox.tsx"), "utf8");
  assert.match(combobox, /defaultValue/, "the district picker restores too");
  assert.match(combobox, /initial\?\.label/, "and shows the label, not a blank box");
});
