import test from "node:test";
import assert from "node:assert/strict";
import { screenPath, confirmationPath, navItems, navGroups, isActivePath } from "../lib/routes";

test("screenPath generates correct paths for screens", () => {
  assert.equal(screenPath("en", "home"), "/en");
  assert.equal(screenPath("np", "home"), "/np");

  assert.equal(screenPath("en", "volunteer"), "/en/volunteer");
  assert.equal(screenPath("np", "volunteer"), "/np/volunteer");

  assert.equal(screenPath("en", "reliefDetail"), "/en/relief/example");
  assert.equal(screenPath("np", "reliefDetail"), "/np/relief/example");
});

test("confirmationPath appends kind and optional reference ID", () => {
  assert.equal(
    confirmationPath("en", "volunteer"),
    "/en/thank-you?kind=volunteer"
  );

  assert.equal(
    confirmationPath("np", "post", "123e4567-e89b-12d3-a456-426614174000"),
    "/np/thank-you?kind=post&ref=123E4567"
  );

  assert.equal(
    confirmationPath("en", "other", "shortid"),
    "/en/thank-you?kind=other&ref=SHORTID"
  );
});

test("navItems builds navigation array and injects relief section", () => {
  const enNav = navItems("en");

  assert.ok(Array.isArray(enNav));
  assert.ok(enNav.length > 0);

  assert.equal(enNav[0].id, "home");
  assert.equal(enNav[0].label, "Home");
  assert.equal(enNav[0].href, "/en");

  const npNav = navItems("np");
  assert.equal(npNav[0].id, "home");
  assert.equal(npNav[0].label, "गृहपृष्ठ");
  assert.equal(npNav[0].href, "/np");

  const needsIndex = enNav.findIndex(i => i.id === "needs");
  assert.ok(needsIndex >= 0, "Needs item should exist in nav");

  const expectedReliefIndex = needsIndex + 1;
  assert.equal(enNav[expectedReliefIndex].id, "relief");
  assert.equal(enNav[expectedReliefIndex].href, "/en/relief");
});

test("isActivePath correctly identifies active routes", () => {
  // Home matching (isHome = true)
  assert.equal(isActivePath("/en", "/en", true), true);
  assert.equal(isActivePath("/en/", "/en", true), true);
  assert.equal(isActivePath("/en/volunteer", "/en", true), false);

  // Nested matching (isHome = false)
  assert.equal(isActivePath("/en/volunteer", "/en/volunteer", false), true);
  assert.equal(isActivePath("/en/volunteer/", "/en/volunteer", false), true);
  assert.equal(isActivePath("/en/volunteer/edit", "/en/volunteer", false), true);

  // Partial matches should fail
  assert.equal(isActivePath("/en/volunteers", "/en/volunteer", false), false);
  assert.equal(isActivePath("/np/volunteer", "/en/volunteer", false), false);
});

test("compact navigation keeps every grouped destination once in both languages", () => {
  for (const lang of ["en", "np"] as const) {
    const groups = navGroups(lang);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups.map((group) => group.items.map((item) => item.id)), [
      ["needs", "relief", "missions", "networks"], ["projects", "tracker"],
    ]);
    const original = navItems(lang);
    for (const item of groups.flatMap((group) => group.items)) {
      assert.equal(item.href, original.find((entry) => entry.id === item.id)?.href);
    }
    assert.equal(new Set(groups.flatMap((group) => group.items.map((item) => item.href))).size, 6);
  }
  assert.notEqual(navGroups("en")[0].label, navGroups("np")[0].label);
  assert.notEqual(navGroups("en")[1].label, navGroups("np")[1].label);
});
