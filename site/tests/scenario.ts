import { rankNeedsForVolunteer, type MatchableNeed, type MatchableVolunteer } from "../lib/matching";

/**
 * A hand-run sanity check, not a test.
 *
 * `npm test` asserts the rules one at a time; this prints a whole ranking so a
 * person can look at it and say whether the order is sane. It is what caught
 * a doctor sitting sixth on a shortlist for structural engineering work, which
 * every individual rule passed. Run it with:
 *
 *   npx tsc -p tests/tsconfig.test.json && node .test-build/tests/scenario.js
 */

const volunteer: MatchableVolunteer = {
  id: "v", name: "Anita", status: "verified", district: "Kathmandu",
  primarySkill: "Health & medical", subSkills: "trauma nursing", certifications: "NNC 8891",
  yearsExperience: "5–10", contribution: ["I can travel", "I can contribute time"],
  availableFrom: "05/09/2026", commitDuration: "1–2 weeks", hoursPerWeek: "Full time",
  maxDeployment: "2 weeks", workMode: "Both", travel: "Anywhere in Nepal",
  preferredDistricts: "", resources: [], languages: ["Nepali", "English"], activeMatches: 0,
};

const base: Omit<MatchableNeed, "id" | "title"> = {
  status: "verified", district: "Kathmandu", province: "Bagmati", urgency: "Upcoming",
  skills: ["Health & medical"], resourcesRequired: [], experienceRequired: "Qualified professional",
  peopleNeeded: 4, committed: 0, startDate: "10/09/2026", duration: "1 week",
  deadline: "30/09/2026", workMode: "On the ground",
  accommodation: "Provided", food: "Provided", transport: "Provided",
};

const n = (id: string, title: string, o: Partial<MatchableNeed> = {}): MatchableNeed =>
  ({ ...base, id, title, ...o });

const board: MatchableNeed[] = [
  n("1", "Field clinic, immediate, empty", { urgency: "Immediate", district: "Sindhupalchok" }),
  n("2", "Field clinic, immediate, nearly full", { urgency: "Immediate", district: "Sindhupalchok", committed: 3 }),
  n("3", "Health post, Kathmandu, upcoming", {}),
  n("4", "Reconstruction survey, engineers", { skills: ["Engineering (structural / civil)"], urgency: "Reconstruction" }),
  n("5", "Remote triage line", { workMode: "Remote", district: "Kailali", urgency: "Urgent" }),
  n("6", "Trauma team, far west, urgent", { district: "Kailali", urgency: "Urgent" }),
  n("7", "Senior surgeon, licensed", { experienceRequired: "Senior / licensed", urgency: "Urgent" }),
  n("8", "Child support, Kathmandu", { skills: ["Education & child support"], urgency: "Urgent" }),
  n("9", "Six-month clinic, ongoing", { duration: "Longer / ongoing project", urgency: "Upcoming" }),
];

console.log("VOLUNTEER: Anita — health & medical, Kathmandu, free 1–2 weeks from 5 Sep\n");
console.log("score  order  band       need");
console.log("-----  -----  ---------  --------------------------------------------");
for (const r of rankNeedsForVolunteer(volunteer, board)) {
  const a = r.assessment;
  console.log(`${String(a.score).padStart(5)}  ${r.rank.toFixed(1).padStart(5)}  ${a.band.padEnd(9)}  ${r.need.title}`);
  const notes = [...a.reasons.map((x) => x.code), ...a.cautions.map((x) => `⚠${x.code}`)];
  console.log(`                          ↳ ${notes.join(", ") || "—"}`);
}
