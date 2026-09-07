import test from "node:test";
import assert from "node:assert/strict";
import { isLang, toLang, dict, translator, localePath, swapLangPath, HTML_LANG, LANGS, DEFAULT_LANG } from "../lib/i18n";
import { STR, NP_MAP } from "../lib/content";

test("isLang correctly identifies supported languages", () => {
  assert.equal(isLang("en"), true);
  assert.equal(isLang("np"), true);
  assert.equal(isLang("fr"), false);
  assert.equal(isLang(""), false);
});

test("toLang coerces string to supported language or default", () => {
  assert.equal(toLang("en"), "en");
  assert.equal(toLang("np"), "np");
  assert.equal(toLang("fr"), "en"); // falls back to default
  assert.equal(toLang(""), "en");
  assert.equal(toLang(undefined), "en");
});

test("dict returns the correct string table for a language", () => {
  const enDict = dict("en");
  const npDict = dict("np");
  assert.equal(enDict, STR.en);
  assert.equal(npDict, STR.np);
  assert.ok(enDict.heroTitle);
  assert.ok(npDict.heroTitle);
  assert.notEqual(enDict.heroTitle, npDict.heroTitle);
});

test("translator returns identity function for 'en'", () => {
  const t = translator("en");
  assert.equal(t("Find the need"), "Find the need");
  assert.equal(t("Unknown string"), "Unknown string");
});

test("translator translates English keys to Nepali using NP_MAP", () => {
  const t = translator("np");
  assert.equal(t("Find the need"), NP_MAP["Find the need"]);
  assert.equal(t("Unknown string"), "Unknown string");
});

test("localePath builds a language-prefixed href", () => {
  assert.equal(localePath("en"), "/en");
  assert.equal(localePath("np", ""), "/np");
  assert.equal(localePath("en", "about"), "/en/about");
  assert.equal(localePath("np", "/about"), "/np/about");
  assert.equal(localePath("en", "/about/team"), "/en/about/team");
});

test("swapLangPath swaps the language segment on a pathname", () => {
  assert.equal(swapLangPath("/en/about", "np"), "/np/about");
  assert.equal(swapLangPath("/np/about/team", "en"), "/en/about/team");
  assert.equal(swapLangPath("/en", "np"), "/np");
  assert.equal(swapLangPath("/np/", "en"), "/en");

  // Path without language segment
  assert.equal(swapLangPath("/about", "np"), "/np/about");
  assert.equal(swapLangPath("", "en"), "/en");
  assert.equal(swapLangPath("/", "np"), "/np/");
});
