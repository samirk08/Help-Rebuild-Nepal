import { fieldKey, type EnhancedSection } from "./form-schema";

export type RenderedField = { label: string; value: string };
export type RenderedSection = { title: string; rows: RenderedField[] };

/**
 * Turns a submission's raw `fields` jsonb back into labelled rows, in the
 * same order and grouping the public form used — so the admin detail view
 * reads like the form the person actually filled in, not a dump of
 * `s02-how-you-can-contribute` style keys.
 *
 * Fields with nothing in them are dropped: an empty "Optional" section
 * shouldn't take up space in a review view.
 */
export function renderSubmissionFields(
  fields: Record<string, unknown>,
  sections: EnhancedSection[]
): RenderedSection[] {
  const rendered: RenderedSection[] = [];

  for (const section of sections) {
    const rows: RenderedField[] = [];

    for (const field of section.fields) {
      const key = fieldKey(section.n, field.label);
      const value = formatValue(fields[key]);
      if (value) rows.push({ label: field.label, value });
    }

    if (rows.length > 0) rendered.push({ title: section.title, rows });
  }

  return rendered;
}

function formatValue(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const joined = value.filter((v) => typeof v === "string" && v.trim() !== "").join(", ");
    return joined || null;
  }
  if (typeof value === "string") return value.trim() || null;
  return String(value);
}
