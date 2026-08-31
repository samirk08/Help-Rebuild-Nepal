import { NEED_FORM, VOL_FORM, type FormField, type FormSection } from "./content";
import type { SubmissionKind } from "./api";

/**
 * Upgrades specific fields of the generated form schema to richer controls.
 *
 * `content.ts` is regenerated from the design file, so it must stay untouched.
 * The swaps live here instead: one explicit, reviewable table keyed by the
 * design's own field labels. Re-running the generator cannot silently undo them.
 */

export type Widget = "district" | "location" | "files";

export type EnhancedField = FormField & { widget?: Widget };
export type EnhancedSection = Omit<FormSection, "fields"> & { fields: EnhancedField[] };

const WIDGET_BY_LABEL: Record<string, Widget> = {
  // Ten hard-coded districts became a searchable list of all 77.
  "Where you are based": "district",
  District: "district",
  // "Paste map coordinates" became parse-what-you-paste.
  "Exact location": "location",
  // "Paste a link to photos" became a real file picker.
  "Documents or photographs": "files",
};

function enhance(sections: FormSection[]): EnhancedSection[] {
  return sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      const widget = WIDGET_BY_LABEL[field.label];
      return widget ? { ...field, widget } : field;
    }),
  }));
}

export const VOLUNTEER_SECTIONS: EnhancedSection[] = enhance(VOL_FORM);
export const NEED_SECTIONS: EnhancedSection[] = enhance(NEED_FORM);

/** Stable, unique control name/id from the section number and label. */
export function fieldKey(sectionN: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `s${sectionN}-${slug}`;
}

/**
 * Every `fieldKey` in a submission kind's schema that renders as a checkbox
 * group (`isChips`). A chip group's FormData entries collapse to a single
 * string when only one box is checked and an array when several are — the
 * browser's FormData/URLSearchParams behaviour, not something this app
 * chose — so anything that reads these fields back (a jsonb `contains` query,
 * a CSV column, a detail view) needs them to arrive as arrays consistently.
 * `relief-offer` has no chip fields, so it isn't included here.
 */
export function chipFieldKeys(kind: Extract<SubmissionKind, "volunteer" | "need">): Set<string> {
  const sections = kind === "volunteer" ? VOLUNTEER_SECTIONS : NEED_SECTIONS;
  const keys = new Set<string>();
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.isChips) keys.add(fieldKey(section.n, field.label));
    }
  }
  return keys;
}

/**
 * Whether a select's first option is a "pick one" prompt rather than an answer.
 *
 * The design writes both kinds and marks neither. "Where you are based" opens
 * with "Select district"; "Primary skill" opens with a real skill, and
 * "Accommodation" with "Provided". Treating position zero as a prompt
 * unconditionally — which is what the form used to do, blanking that option's
 * value — threw away the answer of everyone who left a dropdown of the second
 * kind alone: an engineer was stored with no primary skill at all, and the
 * tracker counted them as having answered nothing.
 *
 * Every prompt the design writes is the word "Select", alone or followed by
 * the thing being selected, so that is the test. A future one worded
 * differently submits its own text as an answer, which shows up in the admin
 * detail view rather than disappearing.
 */
export function isSelectPlaceholder(option: string | undefined): boolean {
  return option === "Select" || option?.startsWith("Select ") === true;
}
