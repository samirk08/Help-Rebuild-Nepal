import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DISTRICTS_FULL, districtDistanceKm, provinceOf } from "../lib/districts";
import {
  assessMatch,
  parseFormDate,
  rankNeedsForVolunteer,
  rankVolunteersForNeed,
  shortfall,
  DIMENSION_WEIGHTS,
  type MatchableNeed,
  type MatchableVolunteer,
  type SignalCode,
} from "../lib/matching";

/**
 * Tests for the matching engine.
 *
 * Run with `npm test`. They need no database and no test framework: the engine
 * is a pure function of two objects, which is the whole reason it was written
 * that way. Everything below builds those objects by hand, so a failure points
 * at a rule rather than at a fixture.
 */

/** A volunteer who answered everything, as a base to vary one thing from. */
function volunteer(over: Partial<MatchableVolunteer> = {}): MatchableVolunteer {
  return {
    id: "v1",
    name: "Test Volunteer",
    status: "verified",
    district: "Sindhupalchok",
    primarySkill: "Engineering (structural / civil)",
    subSkills: "seismic retrofitting",
    certifications: "NEC 12345",
    yearsExperience: "5–10",
    contribution: ["I can travel", "I can contribute time"],
    availableFrom: "01/09/2026",
    commitDuration: "1 month",
    hoursPerWeek: "Full time",
    maxDeployment: "1 month or more",
    workMode: "On the ground",
    travel: "Anywhere in Nepal",
    preferredDistricts: "",
    resources: ["Equipment"],
    languages: ["Nepali", "English"],
    activeMatches: 0,
    ...over,
  };
}

function need(over: Partial<MatchableNeed> = {}): MatchableNeed {
  return {
    id: "n1",
    title: "Chautara Ward Office",
    status: "verified",
    district: "Sindhupalchok",
    province: "Bagmati",
    urgency: "Urgent",
    skills: ["Engineering (structural / civil)"],
    resourcesRequired: [],
    experienceRequired: "Qualified professional",
    peopleNeeded: 4,
    committed: 0,
    startDate: "10/09/2026",
    duration: "2 weeks",
    deadline: "30/09/2026",
    workMode: "On the ground",
    accommodation: "Provided",
    food: "Provided",
    transport: "Reimbursed",
    ...over,
  };
}

function codes(signals: Array<{ code: SignalCode }>): SignalCode[] {
  return signals.map((s) => s.code);
}

describe("weights", () => {
  it("sum to 100, so a score is readable as a percentage", () => {
    const total = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(total, 100);
  });
});

describe("hard gates", () => {
  it("rules out a volunteer who works only in their own district", () => {
    const result = assessMatch(
      need({ district: "Kathmandu" }),
      volunteer({ travel: "Within my district only" })
    );
    assert.equal(result.eligible, false);
    assert.equal(result.score, 0);
    assert.equal(result.band, "ineligible");
    assert.ok(codes(result.blockers).includes("district-locked"));
  });

  it("does not rule that volunteer out of remote work", () => {
    const result = assessMatch(
      need({ district: "Kathmandu", workMode: "Remote" }),
      volunteer({ travel: "Within my district only", workMode: "Both" })
    );
    assert.equal(result.eligible, true);
  });

  it("rules out a remote-only volunteer for on-the-ground work", () => {
    const result = assessMatch(need({ workMode: "On the ground" }), volunteer({ workMode: "Remote" }));
    assert.ok(codes(result.blockers).includes("needs-on-site-help"));
  });

  it("rules out someone who becomes available after the deadline", () => {
    const result = assessMatch(
      need({ deadline: "30/09/2026" }),
      volunteer({ availableFrom: "15/10/2026" })
    );
    assert.ok(codes(result.blockers).includes("available-after-deadline"));
  });

  it("does not gate on dates it could not read", () => {
    const result = assessMatch(
      need({ deadline: "as soon as possible" }),
      volunteer({ availableFrom: "next month sometime" })
    );
    assert.equal(result.eligible, true);
    assert.ok(codes(result.cautions).includes("date-not-understood"));
  });

  it("rules out a rejected registration and one already matched", () => {
    assert.ok(codes(assessMatch(need(), volunteer({ status: "rejected" })).blockers).includes("volunteer-rejected"));
    assert.ok(codes(assessMatch(need(), volunteer({ alreadyMatched: true })).blockers).includes("already-matched"));
  });
});

describe("skill", () => {
  it("scores an exact primary skill highest", () => {
    const exact = assessMatch(need(), volunteer());
    const unrelated = assessMatch(need(), volunteer({ primarySkill: "Health & medical", subSkills: "" }));
    assert.ok(exact.score > unrelated.score);
    assert.ok(codes(exact.reasons).includes("skill-exact"));
  });

  it("ranks a related skill above an unrelated one, below an exact one", () => {
    const related = assessMatch(need(), volunteer({ primarySkill: "Architecture", subSkills: "" }));
    const unrelated = assessMatch(need(), volunteer({ primarySkill: "Translation", subSkills: "" }));
    const exact = assessMatch(need(), volunteer());
    assert.ok(related.score > unrelated.score);
    assert.ok(related.score < exact.score);
    assert.ok(codes(related.reasons).includes("skill-related"));
  });

  it("never bridges an unrelated skill into safeguarded work", () => {
    const result = assessMatch(
      need({ skills: ["Psychosocial support"], experienceRequired: "Any" }),
      volunteer({ primarySkill: "Engineering (structural / civil)", subSkills: "" })
    );
    // Eligible — nothing stops a coordinator considering them — but the skill
    // dimension must be at its floor, not a partial credit for being close.
    const skill = result.dimensions.find((d) => d.id === "skill");
    assert.ok(skill && skill.ratio !== null && skill.ratio < 0.1);
  });

  it("caps the whole score on a skill mismatch, however good the rest is", () => {
    // Everything except the skill is perfect: local, free, experienced,
    // Nepali-speaking, willing to travel. That used to reach the middle of the
    // shortlist. It must not — see skillCeiling.
    const result = assessMatch(
      need({ skills: ["Engineering (structural / civil)"] }),
      volunteer({ primarySkill: "Health & medical", subSkills: "", certifications: "" })
    );
    assert.equal(result.band, "stretch");
    assert.ok(result.score < 45, `wrong skill scored ${result.score}`);
  });

  it("credits a skill named in the sub-skills box", () => {
    const result = assessMatch(
      need({ skills: ["Water & sanitation (WASH)"] }),
      volunteer({ primarySkill: "Translation", subSkills: "water systems, borehole repair" })
    );
    assert.ok(codes(result.reasons).includes("skill-secondary"));
  });

  it("finds a skill word that is not the first word of its label", () => {
    // "Engineering (structural / civil)" written the way people actually write
    // it. Matching on the leading word alone missed this.
    const result = assessMatch(
      need({ skills: ["Engineering (structural / civil)"] }),
      volunteer({ primarySkill: "Project management", subSkills: "structural damage assessment" })
    );
    assert.ok(codes(result.reasons).includes("skill-secondary"));
  });

  it("does not match the generic tail of a skill label", () => {
    // "IT support" must not read as "Education & child support".
    const result = assessMatch(
      need({ skills: ["Education & child support"], experienceRequired: "Any" }),
      volunteer({ primarySkill: "IT & data", subSkills: "IT support, networking" })
    );
    assert.ok(!codes(result.reasons).includes("skill-secondary"));
  });

  it("reports a need with no skills listed rather than scoring it", () => {
    const result = assessMatch(need({ skills: [] }), volunteer());
    const skill = result.dimensions.find((d) => d.id === "skill");
    assert.equal(skill?.ratio, null);
    assert.ok(codes(result.cautions).includes("skills-unspecified"));
  });
});

describe("location", () => {
  it("prefers local, then neighbouring, then distant", () => {
    const local = assessMatch(need(), volunteer({ district: "Sindhupalchok" })).score;
    const near = assessMatch(need(), volunteer({ district: "Kathmandu" })).score;
    const far = assessMatch(need(), volunteer({ district: "Kailali" })).score;
    assert.ok(local > near, `local ${local} should beat neighbouring ${near}`);
    assert.ok(near > far, `neighbouring ${near} should beat distant ${far}`);
  });

  it("ignores location entirely for remote work", () => {
    const here = assessMatch(need({ workMode: "Remote" }), volunteer({ district: "Sindhupalchok", workMode: "Both" }));
    const away = assessMatch(need({ workMode: "Remote" }), volunteer({ district: "Kailali", workMode: "Both" }));
    assert.equal(here.score, away.score);
    assert.ok(codes(here.reasons).includes("remote-work"));
  });

  it("lifts a volunteer who named this district and caps one who did not", () => {
    const named = assessMatch(
      need({ district: "Gorkha" }),
      volunteer({ district: "Kathmandu", travel: "Specific districts only", preferredDistricts: "Gorkha, Dhading" })
    );
    const notNamed = assessMatch(
      need({ district: "Gorkha" }),
      volunteer({ district: "Kathmandu", travel: "Specific districts only", preferredDistricts: "Jhapa, Ilam" })
    );
    assert.ok(named.score > notNamed.score);
    assert.ok(codes(named.reasons).includes("named-this-district"));
    assert.ok(codes(notNamed.cautions).includes("outside-preferred-districts"));
    // A preference, never a gate: they stay on the list.
    assert.equal(notNamed.eligible, true);
  });

  it("flags a volunteer based outside Nepal without excluding them", () => {
    const result = assessMatch(need(), volunteer({ district: "Outside Nepal" }));
    assert.equal(result.eligible, true);
    assert.ok(codes(result.cautions).includes("outside-nepal"));
  });
});

describe("experience", () => {
  it("treats \"Any\" as satisfied by anyone", () => {
    const junior = assessMatch(need({ experienceRequired: "Any" }), volunteer({ yearsExperience: "Under 2" }));
    const experience = junior.dimensions.find((d) => d.id === "experience");
    assert.equal(experience?.ratio, 1);
  });

  it("does not reward exceeding the bar over meeting it", () => {
    const meets = assessMatch(need({ experienceRequired: "Some experience" }), volunteer({ yearsExperience: "2–5" }));
    const exceeds = assessMatch(need({ experienceRequired: "Some experience" }), volunteer({ yearsExperience: "20+" }));
    assert.equal(meets.score, exceeds.score);
  });

  it("caps a senior request when no certification is on file", () => {
    const result = assessMatch(
      need({ experienceRequired: "Senior / licensed" }),
      volunteer({ yearsExperience: "20+", certifications: "" })
    );
    const experience = result.dimensions.find((d) => d.id === "experience");
    assert.ok(experience && experience.ratio !== null && experience.ratio <= 0.75);
    assert.ok(codes(result.cautions).includes("no-certification-on-file"));
  });
});

describe("resources", () => {
  it("reports no data for a request the volunteer form cannot answer", () => {
    // Funding is deliberately unmappable: this site never handles money.
    const result = assessMatch(need({ resourcesRequired: ["Funding"] }), volunteer());
    const resources = result.dimensions.find((d) => d.id === "resources");
    assert.equal(resources?.ratio, null);
  });

  it("credits equipment and tools against an equipment request", () => {
    const result = assessMatch(
      need({ resourcesRequired: ["Equipment"] }),
      volunteer({ resources: ["Tools"] })
    );
    const resources = result.dimensions.find((d) => d.id === "resources");
    assert.equal(resources?.ratio, 1);
  });
});

describe("unanswered questions", () => {
  it("scores what was answered instead of counting blanks as zero", () => {
    const sparse = volunteer({
      subSkills: null,
      certifications: null,
      yearsExperience: null,
      contribution: [],
      availableFrom: null,
      commitDuration: null,
      hoursPerWeek: null,
      maxDeployment: null,
      resources: [],
      languages: [],
    });
    const result = assessMatch(need({ experienceRequired: "Any" }), sparse);
    assert.ok(result.score > 80, `a right-skill local volunteer should score well, got ${result.score}`);
    assert.ok(result.confidence < 1);
  });

  it("will not call a thinly-answered registration a strong fit", () => {
    const sparse = volunteer({
      subSkills: null,
      certifications: null,
      yearsExperience: null,
      contribution: [],
      availableFrom: null,
      commitDuration: null,
      maxDeployment: null,
      resources: [],
      languages: [],
      workMode: null,
      travel: null,
    });
    const result = assessMatch(need({ experienceRequired: null, duration: null, startDate: null, deadline: null }), sparse);
    // Skill and location answered and nothing else — 0.52 of the weight, which
    // is under the bar for "strong" on purpose. See CONFIDENCE_FOR_STRONG.
    assert.ok(result.confidence < 0.6, `confidence was ${result.confidence}`);
    assert.notEqual(result.band, "strong");
    assert.ok(codes(result.cautions).includes("low-information"));
  });
});

describe("safeguarding", () => {
  it("never calls an unverified volunteer a strong fit for work with people at risk", () => {
    const result = assessMatch(
      need({ skills: ["Education & child support"], experienceRequired: "Any" }),
      volunteer({ status: "submitted", primarySkill: "Education & child support" })
    );
    assert.equal(result.eligible, true);
    assert.ok(result.score >= 70, "the arithmetic alone would have made this strong");
    assert.notEqual(result.band, "strong");
    assert.ok(codes(result.cautions).includes("safeguarding-vetting"));
  });

  it("still calls it strong once a person has verified them", () => {
    const result = assessMatch(
      need({ skills: ["Education & child support"], experienceRequired: "Any" }),
      volunteer({ status: "verified", primarySkill: "Education & child support" })
    );
    assert.equal(result.band, "strong");
  });

  it("does not cap ordinary work on verification alone", () => {
    const result = assessMatch(need({ experienceRequired: "Any" }), volunteer({ status: "under_review" }));
    assert.equal(result.band, "strong");
    assert.ok(codes(result.cautions).includes("not-verified"));
  });
});

describe("dates", () => {
  it("reads the forms' own placeholder format", () => {
    const parsed = parseFormDate("09/09/2026");
    assert.equal(parsed.kind, "date");
    if (parsed.kind === "date") assert.equal(parsed.date.toISOString().slice(0, 10), "2026-09-09");
  });

  it("reads an ISO date too", () => {
    const parsed = parseFormDate("2026-09-09");
    assert.equal(parsed.kind, "date");
    if (parsed.kind === "date") assert.equal(parsed.date.toISOString().slice(0, 10), "2026-09-09");
  });

  it("flags a Bikram Sambat year rather than converting it", () => {
    assert.equal(parseFormDate("15/05/2082").kind, "ambiguous-calendar");
  });

  it("rejects a day that does not exist rather than rolling it forward", () => {
    assert.equal(parseFormDate("31/09/2026").kind, "unreadable");
  });

  it("treats an empty answer as unanswered, not wrong", () => {
    assert.equal(parseFormDate("").kind, "none");
    assert.equal(parseFormDate(null).kind, "none");
  });
});

describe("dash variants", () => {
  it("scores an en dash and a hyphen identically", () => {
    const enDash = assessMatch(need(), volunteer({ yearsExperience: "5–10" }));
    const hyphen = assessMatch(need(), volunteer({ yearsExperience: "5-10" }));
    assert.equal(enDash.score, hyphen.score);
  });
});

describe("ranking", () => {
  it("pushes a busy volunteer down the order without changing their score", () => {
    const free = volunteer({ id: "free", name: "A", activeMatches: 0 });
    const busy = volunteer({ id: "busy", name: "B", activeMatches: 4 });
    const ranked = rankVolunteersForNeed(need(), [busy, free]);

    assert.equal(ranked[0].volunteer.id, "free");
    assert.equal(
      ranked[0].assessment.score,
      ranked[1].assessment.score,
      "workload must not change the fit score itself"
    );
  });

  it("ranks a fully-answered registration above a thin one at a similar score", () => {
    const complete = volunteer({ id: "complete", name: "A" });
    const thin = volunteer({
      id: "thin",
      name: "B",
      yearsExperience: null,
      contribution: [],
      availableFrom: null,
      commitDuration: null,
      maxDeployment: null,
      languages: [],
      certifications: null,
    });
    const ranked = rankVolunteersForNeed(need({ experienceRequired: "Any" }), [thin, complete]);
    assert.equal(ranked[0].volunteer.id, "complete");
    assert.ok(
      ranked[1].assessment.confidence < ranked[0].assessment.confidence,
      "the thin registration should be the less confident one"
    );
  });

  it("ranks a verified volunteer above an unverified one at the same score", () => {
    const checked = volunteer({ id: "checked", name: "Z", status: "verified" });
    const unchecked = volunteer({ id: "unchecked", name: "A", status: "submitted" });
    const ranked = rankVolunteersForNeed(need(), [unchecked, checked]);

    assert.equal(ranked[0].assessment.score, ranked[1].assessment.score);
    assert.equal(ranked[0].volunteer.id, "checked");
  });

  it("sorts ineligible pairings to the end rather than dropping them", () => {
    const blocked = volunteer({ id: "blocked", name: "Z", status: "rejected" });
    const ranked = rankVolunteersForNeed(need(), [blocked, volunteer()]);
    assert.equal(ranked.length, 2);
    assert.equal(ranked[ranked.length - 1].volunteer.id, "blocked");
  });

  it("puts an urgent, empty need above an equally-fitting filled one", () => {
    const urgent = need({ id: "urgent", urgency: "Immediate", peopleNeeded: 4, committed: 0 });
    const settled = need({ id: "settled", urgency: "Reconstruction", peopleNeeded: 4, committed: 4 });
    const ranked = rankNeedsForVolunteer(volunteer(), [settled, urgent]);

    assert.equal(ranked[0].need.id, "urgent");
    assert.equal(
      ranked[0].assessment.score,
      ranked[1].assessment.score,
      "urgency must not change how well someone fits"
    );
  });

  it("measures shortfall honestly, including when no number was given", () => {
    assert.equal(shortfall({ peopleNeeded: 4, committed: 1 }), 0.75);
    assert.equal(shortfall({ peopleNeeded: 4, committed: 4 }), 0);
    assert.equal(shortfall({ peopleNeeded: 4, committed: 9 }), 0);
    // "As many as can come" stays open rather than falling off the queue.
    assert.ok(shortfall({ peopleNeeded: null, committed: 0 }) > 0);
  });
});

describe("determinism", () => {
  it("returns the same result for the same inputs", () => {
    const a = assessMatch(need(), volunteer());
    const b = assessMatch(need(), volunteer());
    assert.deepEqual(a, b);
  });
});

describe("district data", () => {
  it("knows every district's province and can measure between them", () => {
    assert.equal(provinceOf("Sindhupalchok"), "bagmati");
    assert.equal(districtDistanceKm("Kathmandu", "Kathmandu"), 0);

    const near = districtDistanceKm("Kathmandu", "Bhaktapur");
    const far = districtDistanceKm("Kathmandu", "Kanchanpur");
    assert.ok(near !== null && far !== null && near < far);
    // Sanity check against the real country rather than the maths alone:
    // Kathmandu to the far west is roughly 500km as the crow flies.
    assert.ok(far! > 400 && far! < 700, `Kathmandu to Kanchanpur measured ${far}km`);
  });

  it("has no distance to or from outside Nepal", () => {
    assert.equal(districtDistanceKm("Outside Nepal", "Kathmandu"), null);
  });

  it("holds all 77 districts, in the right provinces", () => {
    assert.equal(DISTRICTS_FULL.length, 77);

    const perProvince: Record<string, number> = {};
    for (const d of DISTRICTS_FULL) perProvince[d.province] = (perProvince[d.province] ?? 0) + 1;

    // The federal structure's own counts. A district filed under the wrong
    // province would move it hundreds of kilometres in the fallback path
    // `districtDistanceKm` takes when a name is unrecognised.
    assert.deepEqual(perProvince, {
      koshi: 14,
      madhesh: 8,
      bagmati: 13,
      gandaki: 11,
      lumbini: 12,
      karnali: 10,
      sudurpashchim: 9,
    });
  });

  it("places every district inside Nepal", () => {
    // Same bounds lib/geo.ts warns pasted coordinates against. A transposed
    // lat/lon or a stray digit lands outside and would quietly distort every
    // distance measured from that district.
    const stray = DISTRICTS_FULL.filter(
      (d) => d.lat < 26.34 || d.lat > 30.45 || d.lon < 80.05 || d.lon > 88.21
    );
    assert.deepEqual(stray.map((d) => d.name), []);
  });

  it("measures known distances to about the right size", () => {
    // Checked against the real country, not against the maths: these are the
    // distances that would be wrong first if a coordinate were mistyped.
    const within = (a: string, b: string, expected: number, tolerance: number) => {
      const km = districtDistanceKm(a, b);
      assert.ok(
        km !== null && Math.abs(km - expected) <= tolerance,
        `${a} to ${b} measured ${km}km, expected about ${expected}km`
      );
    };

    within("Kathmandu", "Lalitpur", 6, 8);
    within("Kathmandu", "Kaski", 140, 25); // Pokhara
    within("Kathmandu", "Morang", 240, 40); // Biratnagar
    within("Kathmandu", "Kanchanpur", 520, 60); // the far west
  });
});
