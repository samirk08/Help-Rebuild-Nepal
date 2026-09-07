/** Only an explicit remote work-mode answer skips deployment questions.
 * Offering remote help alone does not rule out travel or equipment donations.
 * Shared with intake validation so a stale hidden answer cannot reach storage.
 */
export type FormKind = "volunteer" | "need";

export const WORK_MODE_FIELD: Record<FormKind, string> = {
  volunteer: "s05-where-you-can-work",
  need: "s07-where-the-work-happens",
};

const DEPLOYMENT_FIELDS: Record<FormKind, readonly string[]> = {
  volunteer: [
    "s04-maximum-single-deployment",
    "s05-travel",
    "s05-preferred-districts",
  ],
  need: [
    "s06-accommodation",
    "s06-food",
    "s06-transport",
    "s06-equipment-available-on-site",
  ],
};

export function hiddenIntakeFields(kind: FormKind, fields: Record<string, unknown>): ReadonlySet<string> {
  const raw = fields[WORK_MODE_FIELD[kind]];
  const mode = Array.isArray(raw) ? raw[0] : raw;
  return new Set(typeof mode === "string" && mode.trim() === "Remote" ? DEPLOYMENT_FIELDS[kind] : []);
}

export function applicableIntakeFields(kind: FormKind, fields: Record<string, unknown>): Record<string, unknown> {
  const hidden = hiddenIntakeFields(kind, fields);
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !hidden.has(key)));
}

/** Ask the mode before deployment questions; stored field keys stay stable. */
export const FORM_SECTION_ORDER: Record<FormKind, readonly string[]> = {
  volunteer: ["01", "05", "02", "03", "04", "06", "07"],
  need: ["01", "07", "02", "03", "04", "05", "06", "08", "09"],
};
