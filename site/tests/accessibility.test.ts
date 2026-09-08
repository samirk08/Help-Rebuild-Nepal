import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The accessibility rules that can be checked without a browser.
 *
 * This exists because of a real defect, found by measuring rather than reading:
 * the district picker on every intake form on the site had no accessible name.
 * `FormField` rendered `<label htmlFor={key}>`, `ReliefOfferForm` rendered
 * `<label htmlFor="relief-where">`, and `Combobox` put that id on nothing at
 * all — the only element carrying the name was the hidden input holding the
 * value. A screen reader announced "edit text, blank" where the page plainly
 * showed "Where you are based".
 *
 * Typecheck passed. Every test passed. The build passed. A label pointing at an
 * id that does not exist is valid TypeScript and valid HTML.
 *
 * scripts/a11y-audit.mjs measures the rest — tap targets, real overflow,
 * computed accessible names — against a running browser. That cannot run in
 * CI, so everything statically decidable is held here instead.
 */

const COMPONENTS = "components";
const APP = "app";

function sources(dir: string, out: Array<[string, string]> = []): Array<[string, string]> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (full.endsWith(".tsx")) out.push([full, readFileSync(full, "utf8")]);
  }
  return out;
}

const all = [...sources(COMPONENTS), ...sources(APP)];

test("every htmlFor points at an id that exists in the same file", () => {
  const broken: string[] = [];

  for (const [file, source] of all) {
    // Only literal ids can be resolved statically. An expression may be
    // satisfied by a child component's own default, which is exactly the case
    // the Combobox test below pins down separately.
    const targets = [...source.matchAll(/htmlFor="([^"{]+)"/g)].map((m) => m[1]);
    for (const id of targets) {
      if (!source.includes(`id="${id}"`)) broken.push(`${file}: htmlFor="${id}"`);
    }
  }

  assert.deepEqual(broken, [], "a label pointing at nothing names nothing");
});

test("the combobox puts the label's id on the control a person interacts with", () => {
  const source = readFileSync(join(COMPONENTS, "Combobox.tsx"), "utf8");

  // Both branches: the plain <select> before hydration, and the enhanced text
  // input after. The unenhanced form is what someone with no JavaScript gets,
  // so it cannot be the unlabelled one either.
  assert.match(source, /controlId/, "the control needs an id derived from the label target");
  const select = source.slice(source.indexOf("<select"), source.indexOf("</select>"));
  assert.match(select, /id=\{controlId\}/, "the fallback select must carry the id");

  const input = source.slice(source.indexOf('role="combobox"') - 400, source.indexOf('role="combobox"'));
  assert.match(input, /id=\{controlId\}/, "the enhanced input must carry the id");

  // The hidden input holds the value and must NOT take the id: a label
  // pointing at a hidden control names something nobody can focus.
  const hidden = source.slice(source.indexOf('type="hidden"') - 60, source.indexOf('type="hidden"') + 60);
  assert.ok(!/id=/.test(hidden), "the hidden value input must not claim the label");
});

test("no component fights the natural tab order", () => {
  // A positive tabindex jumps the reader out of document order and is almost
  // always a bug rather than a decision.
  for (const [file, source] of all) {
    const positive = [...source.matchAll(/tabIndex=\{?(-?\d+)\}?/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n > 0);
    assert.deepEqual(positive, [], `${file} uses a positive tabIndex`);
  }
});

test("every image declares whether it carries meaning", () => {
  // A decorative image needs alt="", a meaningful one needs words. Missing
  // entirely means a screen reader reads the filename.
  const missing: string[] = [];
  for (const [file, source] of all) {
    for (const tag of source.match(/<img\b[^>]*>/g) ?? []) {
      if (!/\balt=/.test(tag)) missing.push(`${file}: ${tag.slice(0, 60)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("a keyboard user can skip the navigation", () => {
  // Without this, reaching the form on any page means tabbing through the
  // whole header every time.
  const layout = readFileSync(join(APP, "[lang]", "layout.tsx"), "utf8");
  const shell = all.find(([f]) => f.includes("SiteHeader") || f.includes("Header"));
  const source = layout + (shell?.[1] ?? "");
  assert.match(source, /skip/i, "a skip link must exist");
});

test("form errors are announced, not only coloured", () => {
  // Colour alone does not reach a screen reader, and `aria-describedby` is what
  // ties the message to the control that was refused.
  for (const file of ["RequestForm", "NeedIntakeForm", "ReliefOfferForm"]) {
    const source = readFileSync(join(COMPONENTS, `${file}.tsx`), "utf8");
    assert.match(source, /aria-invalid/, `${file} must mark the refused control`);
    assert.match(source, /aria-describedby|describedBy/, `${file} must point at the message`);
  }
});

test("the footer's links are big enough to hit", () => {
  // 13.5px text in a column is a ~16px tall target, under the 24px WCAG 2.5.8
  // minimum. Measured with scripts/a11y-audit.mjs; held here so the padding
  // cannot be tidied away later without the reason resurfacing.
  const css = readFileSync(join(APP, "globals.css"), "utf8");
  const rule = css.slice(css.indexOf(".footer__link {"), css.indexOf(".footer__link:hover"));
  assert.match(rule, /min-height:\s*24px/, "footer links need a 24px minimum target");
});
