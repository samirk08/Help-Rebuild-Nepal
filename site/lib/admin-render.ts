import { fieldKey, type EnhancedSection } from "./form-schema";

export type RenderedField = { label: string; value: string };
export type RenderedSection = { title: string; rows: RenderedField[] };

/** The full status vocabulary, matching `submission_status` in schema.sql. */
export const SUBMISSION_STATUSES = [
  "submitted",
  "under_review",
  "verified",
  "recruiting",
  "filled",
  "completed",
  "rejected",
] as const;

/** Pledges only ever move through the verification subset of the above. */
export const PLEDGE_STATUSES = ["submitted", "under_review", "verified", "rejected"] as const;

/**
 * Postgres enum values are snake_case; screens should not be. Falls back to
 * de-underscoring anything the map hasn't caught up with rather than showing
 * a blank, so a new status added to the schema still renders legibly.
 */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under review",
    verified: "Verified",
    recruiting: "Recruiting",
    filled: "Filled",
    completed: "Completed",
    rejected: "Rejected",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

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
