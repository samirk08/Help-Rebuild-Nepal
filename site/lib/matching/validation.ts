import { cleanTags, isoDate, SKILLS, validEmail } from "./catalog";
import type { Facts, RoleConfig } from "./types";

export type ActionState = { error?: string; success?: string };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function idFrom(form: FormData, key: string): string {
  const value = String(form.get(key) ?? "");
  if (!UUID.test(value)) throw new Error("Invalid record identifier.");
  return value;
}
export function textFrom(form: FormData, key: string, max = 500): string {
  const value = String(form.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${key} is too long.`);
  return value;
}
function numberFrom(form: FormData, key: string, max: number, required = false, min = 1): number | null {
  const raw = textFrom(form, key);
  if (!raw && !required) return null;
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < min || n > max) throw new Error(`${key} must be a whole number between ${min} and ${max}.`);
  return n;
}
function dateFrom(form: FormData, key: string, required = false): string | null {
  const raw = textFrom(form, key);
  if (!raw && !required) return null;
  const date = isoDate(raw);
  if (!date) throw new Error(`Enter a valid date for ${key}.`);
  return date;
}
function selectedSkills(form: FormData): string[] {
  const ids = [...new Set(form.getAll("skills").map(String))];
  if (ids.some(id => !SKILLS.some(([key]) => key === id))) throw new Error("Choose skills from the provided list.");
  return ids;
}
export function parseFacts(form: FormData): Facts {
  const skills = selectedSkills(form);
  const availableFrom = dateFrom(form, "availableFrom");
  const availableUntil = dateFrom(form, "availableUntil");
  if (availableFrom && availableUntil && availableFrom > availableUntil) throw new Error("Available until must follow available from.");
  const workMode = textFrom(form, "workMode");
  const travel = textFrom(form, "travel");
  if (workMode && !["remote", "onsite", "both"].includes(workMode)) throw new Error("Invalid work mode.");
  if (travel && !["anywhere", "local", "districts"].includes(travel)) throw new Error("Invalid travel area.");
  return {
    skills: skills.length ? skills : null,
    specialties: cleanTags(textFrom(form, "specialties", 1000)),
    workMode: workMode as Facts["workMode"] || null,
    district: textFrom(form, "district", 100) || null,
    travel: travel as Facts["travel"] || null,
    travelDistricts: cleanTags(textFrom(form, "travelDistricts")),
    availableFrom, availableUntil,
    hoursPerWeek: numberFrom(form, "hoursPerWeek", 168),
    maxDeploymentDays: numberFrom(form, "maxDeploymentDays", 366),
    experienceYears: numberFrom(form, "experienceYears", 80, false, 0),
  };
}
export function parseRole(form: FormData, missionIds: string[] = []) {
  const title = textFrom(form, "title", 160);
  const skills = selectedSkills(form);
  const workMode = textFrom(form, "workMode") as RoleConfig["workMode"];
  const district = textFrom(form, "district", 100) || null;
  const startDate = dateFrom(form, "startDate", true)!;
  const endDate = dateFrom(form, "endDate", true)!;
  if (!title || !skills.length) throw new Error("Give this role a title and at least one required skill.");
  if (!["remote", "onsite", "either", "hybrid"].includes(workMode)) throw new Error("Choose a work mode.");
  if (workMode !== "remote" && !district) throw new Error("Specify the district for on-site work.");
  if (endDate < startDate) throw new Error("End date must follow start date.");
  const config: RoleConfig = {
    skills, workMode, district, startDate, endDate,
    hoursPerWeek: numberFrom(form, "hoursPerWeek", 168, true)!,
    minExperienceYears: numberFrom(form, "minExperienceYears", 80),
    qualifications: cleanTags(textFrom(form, "qualifications", 1000)),
    preferredSpecialties: cleanTags(textFrom(form, "preferredSpecialties", 1000)),
    preferLocal: form.get("preferLocal") === "on", missionIds,
  };
  const requesterEmail = textFrom(form, "requesterEmail", 254);
  if (requesterEmail && !validEmail(requesterEmail)) throw new Error("Enter a valid requester email.");
  return { title, config, headcount: numberFrom(form, "headcount", 1000, true)!, requesterEmail };
}
