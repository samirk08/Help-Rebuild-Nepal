import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { N3, validateNeedV3 } from "../lib/intake-schema";

/**
 * Whether the three-step need form can actually be completed.
 *
 * It could not. `STEP_FIELDS` said step two owned `consent`; the consent
 * checkbox was rendered only on step three. Advancing from step two refused to
 * continue until consent was ticked, and the only checkbox was on the step you
 * could not reach — so the form deadlocked and nobody could post a need at all.
 * It shipped that way and stayed broken until a coordinator, trying to file a
 * real request that had come in by phone, reported being told to tick a box
 * that was not on the page.
 *
 * Every existing test passed throughout. They all called `validateNeedV3`
 * directly with a complete payload, which is a fine way to test validation and
 * no way at all to test a form. Nothing walked the steps.
 *
 * These are the cheap structural checks. `scripts/form-walk.mjs` does the real
 * thing in a browser.
 */

const source = readFileSync(join("components", "NeedIntakeForm.tsx"), "utf8");

type Field = {
  /** How the source refers to it — `N3.type`, or a bare "consent". */
  ref: string;
  /** The submitted field name it resolves to. */
  name: string;
};

/** The fields listed for each step in STEP_FIELDS, in order. */
function declaredSteps(): Field[][] {
  const table = source.slice(
    source.indexOf("const STEP_FIELDS"),
    source.indexOf("];", source.indexOf("const STEP_FIELDS")) + 2
  );
  // `string[][]` in the type annotation contributes two empty pairs; the real
  // rows are the ones with something in them.
  const rows = (table.match(/\[[^[\]]*\]/g) ?? []).filter((row) => row.length > 2);
  return rows.map((row) =>
    [...row.matchAll(/N3\.(\w+)|"([\w-]+)"/g)].map((m) =>
      m[1]
        ? { ref: `N3.${m[1]}`, name: (N3 as Record<string, string>)[m[1]] }
        : { ref: `"${m[2]}"`, name: m[2] }
    )
  );
}

/** The JSX rendered under each `step === n` guard. */
function renderedStep(n: number): string {
  const start = source.indexOf(`{step === ${n} ? (`);
  assert.notEqual(start, -1, `no render block for step ${n}`);
  const next = source.indexOf(`{step === ${n + 1} ? (`, start);
  return source.slice(start, next === -1 ? source.indexOf("form-footer", start) : next);
}

test("every field a step blocks on is rendered on that step", () => {
  // The invariant that was violated. A step that refuses to continue over a
  // control it does not show is a dead end with no way out of it.
  const steps = declaredSteps();
  assert.equal(steps.length, 3, "expected three steps");

  for (const [index, fields] of steps.entries()) {
    const rendered = renderedStep(index);
    for (const field of fields) {
      // The JSX may name the control either way: `name={N3.title}` or
      // `name="consent"`.
      assert.ok(
        rendered.includes(field.ref) || rendered.includes(`"${field.name}"`),
        `step ${index + 1} blocks on "${field.name}" but does not render it`
      );
    }
  }
});

test("consent is owned by the step that shows the checkbox", () => {
  // Named separately because this is the exact bug, and a regression here is
  // not a cosmetic one — it takes the whole form down.
  const steps = declaredSteps();
  const owning = steps.findIndex((fields) => fields.some((f) => f.name === "consent"));
  assert.notEqual(owning, -1, "consent must be owned by some step");
  assert.ok(
    renderedStep(owning).includes('name="consent"'),
    `consent is owned by step ${owning + 1}, which does not render the checkbox`
  );
});

test("a step cannot block on a control that is not on screen", () => {
  // Belt and braces on top of the table above: `advance` checks the live DOM,
  // so even a wrong entry in STEP_FIELDS can no longer deadlock the form.
  const advance = source.slice(source.indexOf("function advance()"), source.indexOf("async function send"));
  assert.match(advance, /querySelector/, "advance must confirm the control is rendered");
});

test("the payload a completed form produces is accepted", () => {
  // What the browser walk submits, asserted here so a validation change that
  // would break the form fails fast rather than in a browser.
  const result = validateNeedV3({
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
  });
  assert.equal(result.ok, true, JSON.stringify(result.ok ? {} : result.errors));
});

test("the volunteer form opens every section it complains about", () => {
  // Same failure in miniature: an error summary naming a field inside a panel
  // that stayed closed is a message about a control you cannot see.
  const request = readFileSync(join("components", "RequestForm.tsx"), "utf8");
  const focus = request.slice(
    request.indexOf("function focusFirstError"),
    request.indexOf("async function handleSubmit")
  );
  assert.match(focus, /for \(const problem of list\)/, "every failing section must be opened");
});
