const fs = require("fs");
const path = require("path");
const ROOT = "/Users/samirkadariya/Developer/HRN";

const src = fs.readFileSync(path.join(ROOT, "Help Rebuild Nepal.dc.html"), "utf8").split("\n");
const body = src.slice(712, 1106).join("\n");

const m = {};
new Function(
  "m",
  '"use strict";' +
    body +
    ";Object.assign(m,{NAV,LOOP_WORDS,LOOP_WORDS_NP,TRACKER_LABELS,DEMO_COUNTS,STR,DISTRICTS,SKILLS,VOL_FORM,NEED_FORM,NP_MAP});"
)(m);

// Verify both languages carry the same key set.
const enK = Object.keys(m.STR.en).sort();
const npK = Object.keys(m.STR.np).sort();
const missing = enK.filter((k) => !npK.includes(k)).concat(npK.filter((k) => !enK.includes(k)));
if (missing.length) throw new Error("STR key mismatch: " + missing.join(", "));

// Radio "dot" arrives as an inline style string; keep only the colour for the real stylesheet.
for (const sec of m.NEED_FORM) {
  for (const f of sec.fields) {
    if (!f.rows) continue;
    f.rows = f.rows.map((r) => {
      const c = /background:(#[0-9a-f]{6})/i.exec(r.dot);
      const { dot, ...rest } = r;
      return { ...rest, color: c ? c[1] : "#12171c" };
    });
  }
}

const j = (v) => JSON.stringify(v, null, 2);

const out = `// AUTO-GENERATED from "Help Rebuild Nepal.dc.html" by scripts/gen-content.js.
// Content tables lifted verbatim from the approved design. Re-run the script to refresh.
// Two notes on faithful transfer:
//   * STR.en/np each defined heroTitle and heroSub twice; JS last-wins, so only the
//     values the prototype actually rendered are kept here.
//   * NP_MAP had 3 duplicate keys, all with identical values — deduped, nothing lost.

export type Lang = "en" | "np";

export type NavItem = { id: ScreenId; en: string; np: string };

export type ScreenId =
  | "home"
  | "needs"
  | "projects"
  | "networks"
  | "tracker"
  | "profile"
  | "partners";

export type RadioRow = {
  group: string;
  label: string;
  note: string;
  color: string;
};

export type FormField = {
  label: string;
  span: string;
  ph?: string;
  note?: string;
  isText?: boolean;
  isSelect?: boolean;
  isArea?: boolean;
  isChips?: boolean;
  isRadio?: boolean;
  options?: string[];
  rows?: RadioRow[];
};

export type FormSection = {
  n: string;
  title: string;
  hint: string;
  fields: FormField[];
};

export const NAV: NavItem[] = ${j(m.NAV.map((n) => (n.id === "admin" ? { ...n, id: "partners" } : n)))};

export const LOOP_WORDS: string[] = ${j(m.LOOP_WORDS)};

export const LOOP_WORDS_NP: string[] = ${j(m.LOOP_WORDS_NP)};

export const TRACKER_LABELS: string[] = ${j(m.TRACKER_LABELS)};

export const DEMO_COUNTS: number[] = ${j(m.DEMO_COUNTS)};

export const DISTRICTS: string[] = ${j(m.DISTRICTS)};

export const SKILLS: string[] = ${j(m.SKILLS)};

export const VOL_FORM: FormSection[] = ${j(m.VOL_FORM)};

export const NEED_FORM: FormSection[] = ${j(m.NEED_FORM)};

export const STR = ${j(m.STR)} as const;

/** Every UI string key, widened to \`string\` so either language satisfies it. */
export type Dict = { readonly [K in keyof (typeof STR)["en"]]: string };

/** English -> Nepali lookup for data-table content held only in English. */
export const NP_MAP: Record<string, string> = ${j(m.NP_MAP)};
`;

fs.mkdirSync(path.join(ROOT, "site/lib"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "site/lib/content.ts"), out);
console.log("wrote site/lib/content.ts —", out.length, "chars");
console.log("STR keys:", enK.length, "| NP_MAP keys:", Object.keys(m.NP_MAP).length);
