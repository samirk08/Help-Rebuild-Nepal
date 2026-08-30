import { NEED_FORM, VOL_FORM, type FormField, type FormSection } from "./content";

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
