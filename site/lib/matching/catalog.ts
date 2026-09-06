/** Stable IDs. Mission IDs are optional extension points, not inferred from skills. */
export const SKILLS = [
  ["engineering", "Engineering (structural / civil)"],
  ["architecture", "Architecture"],
  ["medical", "Health & medical"],
  ["wash", "Water & sanitation (WASH)"],
  ["project-management", "Project management"],
  ["logistics", "Logistics & transport"],
  ["construction", "Construction & trades"],
  ["education", "Education & child support"],
  ["psychosocial", "Psychosocial support"],
  ["translation", "Translation"],
  ["it-data", "IT & data"],
  ["communications", "Writing, photography & communications"],
  ["other", "Other"],
] as const;
export function skillLabel(id: string): string {
  return SKILLS.find(([key]) => key === id)?.[1] ?? id;
}
export function skillId(label: string): string | undefined {
  return SKILLS.find(([id, name]) => id === label || name === label)?.[0];
}
export const textList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === "string" ? [value] : [])
    .filter((x): x is string => typeof x === "string" && !!x.trim()).map(x => x.trim());
export const cleanTags = (value: string): string[] =>
  [...new Set(value.split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean))];
export const validEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Dates compare lexically only after validating a real ISO calendar date. */
export function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let date = value.trim();
  const dmy = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/.exec(date);
  if (dmy) date = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
