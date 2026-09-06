import { isoDate, skillId, textList, cleanTags } from "./catalog";
import type { Facts, Submission } from "./types";

export function legacyFacts(row: Submission): Facts {
  const f = row.fields ?? {};
  const explicit = f.__form_version === 2;
  const primary = textList(f["s03-primary-skill"])[0];
  const skill = primary && (explicit || primary !== "Engineering (structural / civil)") ? skillId(primary) : undefined;
  const mode = textList(f["s05-where-you-can-work"])[0];
  const remote = textList(f["s02-how-you-can-contribute"]).includes("I can help remotely");
  // A remote checkbox establishes willingness, not remote-only. Keep conflicting
  // or potentially defaulted modes unknown until someone explicitly confirms.
  const workMode = mode === "Remote" ? "remote" : mode === "Both" ? "both"
    : mode === "On the ground" && explicit && !remote ? "onsite" : null;
  const travel = textList(f["s05-travel"])[0];
  return {
    skills: skill ? [skill] : null,
    specialties: cleanTags(textList(f["s03-sub-skills"]).join(",")),
    workMode, district: row.district,
    travel: travel === "Within my district only" ? "local" : travel === "Specific districts only" ? "districts"
      : travel === "Anywhere in Nepal" && explicit ? "anywhere" : null,
    travelDistricts: cleanTags(textList(f["s05-preferred-districts"]).join(",")),
    availableFrom: isoDate(f["s04-available-from"]),
    // Free-text duration and hour bands cannot establish an exact commitment.
    availableUntil: null, hoursPerWeek: null, maxDeploymentDays: null, experienceYears: null,
  };
}
