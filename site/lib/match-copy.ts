import type { Lang } from "./content";
import { districtLabel } from "./districts";
import { translator } from "./i18n";
import type { Band, DimensionId, Signal, SignalCode } from "./matching";

/**
 * The words for what the matching engine worked out.
 *
 * lib/matching.ts returns codes, never sentences, for two reasons: the admin
 * dashboard is English-only while the public site is bilingual, and a score
 * that carried its own prose could not be re-rendered in the other language
 * without re-running it. Phrasing lives here; judgement lives there.
 *
 * TRANSLATION NOTE: the Nepali below is machine-supplied and needs review by a
 * Nepali speaker, exactly like lib/added-strings.ts and the district names in
 * lib/districts.ts. Read it alongside those two — the three of them are the
 * whole review.
 */

type Phrase = (value: string) => string;

const EN: Record<SignalCode, Phrase> = {
  // ---------------------------------------------------------------- Gates
  "volunteer-rejected": () => "This registration was rejected",
  "already-matched": () => "Already matched to this need",
  "needs-on-site-help": () => "Registered for remote work only; this need is on the ground",
  "needs-remote-help": () => "Registered for on-the-ground work only; this need is remote",
  "district-locked": (v) => `Works within ${v || "their own district"} only`,
  "available-after-deadline": (v) => `Not available until ${v}, after this need's deadline`,

  // ------------------------------------------------------------ Positives
  "same-district": (v) => `Local — based in ${v}`,
  "named-this-district": (v) => `Named ${v} as a district they want to work in`,
  "nearby-district": (v) => `Based in ${v}, the next district over`,
  "same-province": () => "Same province",
  "remote-work": () => "Remote work — location does not matter",
  "skill-exact": (v) => `${v} is their primary skill`,
  "skill-related": (v) => `Related skill: ${v}`,
  "skill-secondary": (v) => `Lists ${v} among their sub-skills`,
  "experience-meets": (v) => `${v} years' experience meets what was asked`,
  certified: (v) => `Certifications on file: ${v}`,
  "duration-covers": (v) => `Can commit ${v} — covers the work`,
  "can-travel": () => "Said they can travel",
  "brings-resources": (v) => `Can bring: ${v}`,
  "speaks-nepali": () => "Speaks Nepali",
  "speaks-local-language": (v) => `Speaks ${v}, used in this province`,
  "support-provided": () => "This need provides accommodation, food or transport",

  // ------------------------------------------------------------- Cautions
  "not-verified": () => "Registration not verified yet",
  "safeguarding-vetting": () =>
    "Works with people at risk — verify this volunteer before making contact",
  "outside-nepal": () => "Based outside Nepal — travel and timing need checking",
  "outside-preferred-districts": (v) =>
    v ? `Asked for specific districts (${v}), and this is not one` : "Asked for specific districts, and this is not one",
  "experience-below": (v) => `${v} years' experience is below what was asked`,
  "no-certification-on-file": () => "A licensed professional was asked for; no certification on file",
  "shorter-than-needed": (v) => `Can commit ${v}, shorter than the work runs`,
  "starts-after-need": (v) => `Not available until ${v}, after the start date`,
  "unsupported-travel": () =>
    "Travelling from far, and this need provides no accommodation, food or transport",
  "no-nepali-listed": () => "Does not list Nepali among their languages",
  "skills-unspecified": () => "This need does not say which skills it wants",
  "date-not-understood": (v) => `Date not understood: “${v}”`,
  "date-maybe-bikram-sambat": (v) =>
    `Date “${v}” looks like Bikram Sambat — read it before relying on it`,
  "low-information": () => "Much of this registration is blank, so the score rests on little",
};

const NP: Record<SignalCode, Phrase> = {
  "volunteer-rejected": () => "यो दर्ता अस्वीकृत गरिएको छ",
  "already-matched": () => "यो आवश्यकतासँग पहिले नै मिलान भइसकेको",
  "needs-on-site-help": () => "दूरबाट मात्र काम गर्ने दर्ता; यो काम स्थलमा हुन्छ",
  "needs-remote-help": () => "स्थलमा मात्र काम गर्ने दर्ता; यो काम दूरबाट हुन्छ",
  "district-locked": (v) => `${v || "आफ्नै जिल्ला"} भित्र मात्र काम गर्ने`,
  "available-after-deadline": (v) => `${v} सम्म उपलब्ध छैन, जुन यो कामको अन्तिम मितिपछि हो`,

  "same-district": (v) => `स्थानीय — ${v} मा बस्ने`,
  "named-this-district": (v) => `${v} लाई काम गर्न चाहेको जिल्ला भनेका`,
  "nearby-district": (v) => `${v} मा बस्ने, छिमेकी जिल्ला`,
  "same-province": () => "एउटै प्रदेश",
  "remote-work": () => "दूरबाट गर्ने काम — ठाउँले फरक पार्दैन",
  "skill-exact": (v) => `${v} उहाँको मुख्य सीप हो`,
  "skill-related": (v) => `सम्बन्धित सीप: ${v}`,
  "skill-secondary": (v) => `${v} लाई उप-सीपमा उल्लेख गरेका`,
  "experience-meets": (v) => `${v} वर्षको अनुभव मागिएको स्तर पुग्छ`,
  certified: (v) => `प्रमाणपत्र दर्ता छ: ${v}`,
  "duration-covers": (v) => `${v} दिन सक्ने — काम पुग्छ`,
  "can-travel": () => "यात्रा गर्न सक्ने भनेका",
  "brings-resources": (v) => `ल्याउन सक्ने: ${v}`,
  "speaks-nepali": () => "नेपाली बोल्ने",
  "speaks-local-language": (v) => `${v} बोल्ने, यो प्रदेशमा चल्ने भाषा`,
  "support-provided": () => "यो आवश्यकताले बास, खाना वा यातायात दिन्छ",

  "not-verified": () => "दर्ता अझै प्रमाणित भएको छैन",
  "safeguarding-vetting": () =>
    "जोखिममा रहेका मानिससँगको काम — सम्पर्क गर्नुअघि यो स्वयंसेवक प्रमाणित गर्नुहोस्",
  "outside-nepal": () => "नेपाल बाहिर बस्ने — यात्रा र समय जाँच्नुपर्छ",
  "outside-preferred-districts": (v) =>
    v ? `निश्चित जिल्ला (${v}) मागेका, यो त्यसमा पर्दैन` : "निश्चित जिल्ला मात्र मागेका, यो त्यसमा पर्दैन",
  "experience-below": (v) => `${v} वर्षको अनुभव मागिएको भन्दा कम छ`,
  "no-certification-on-file": () => "इजाजतपत्र भएको व्यक्ति मागिएको; प्रमाणपत्र दर्ता छैन",
  "shorter-than-needed": (v) => `${v} मात्र दिन सक्ने, काम चल्ने अवधिभन्दा छोटो`,
  "starts-after-need": (v) => `${v} सम्म उपलब्ध छैन, सुरु मितिपछि`,
  "unsupported-travel": () => "टाढाबाट आउनुपर्ने, र यो आवश्यकताले बास, खाना वा यातायात दिँदैन",
  "no-nepali-listed": () => "भाषामा नेपाली उल्लेख गरेका छैनन्",
  "skills-unspecified": () => "यो आवश्यकताले कुन सीप चाहिन्छ भनेको छैन",
  "date-not-understood": (v) => `मिति बुझिएन: “${v}”`,
  "date-maybe-bikram-sambat": (v) => `मिति “${v}” विक्रम सम्वत् जस्तो देखिन्छ — भर पर्नुअघि पढ्नुहोस्`,
  "low-information": () => "यो दर्ताको धेरै भाग खाली छ, त्यसैले अंक थोरै जानकारीमा आधारित छ",
};

const COPY: Record<Lang, Record<SignalCode, Phrase>> = { en: EN, np: NP };

/**
 * Codes whose value is a district name. Districts are translated from a table
 * of their own, not from the design's NP_MAP, so they have to be told apart
 * from skill names and free text.
 */
const DISTRICT_VALUED = new Set<SignalCode>([
  "same-district",
  "named-this-district",
  "nearby-district",
  "district-locked",
]);

/**
 * A signal as a sentence.
 *
 * Values are data the person typed or picked, so they are localised the same
 * way the rest of the site localises stored data: districts through
 * `districtLabel`, everything else through `translator`, both of which fall
 * back to the English source rather than rendering blank.
 */
export function signalText(lang: Lang, signal: Signal): string {
  const raw = signal.value ?? "";
  const value = !raw
    ? ""
    : DISTRICT_VALUED.has(signal.code)
      ? districtLabel(lang, raw)
      : translator(lang)(raw);
  return COPY[lang][signal.code](value);
}

const BANDS: Record<Lang, Record<Band, string>> = {
  en: {
    strong: "Strong fit",
    possible: "Possible fit",
    stretch: "Long shot",
    ineligible: "Ruled out",
  },
  np: {
    strong: "बलियो मेल",
    possible: "सम्भावित मेल",
    stretch: "टाढाको सम्भावना",
    ineligible: "मिल्दैन",
  },
};

export function bandLabel(lang: Lang, band: Band): string {
  return BANDS[lang][band];
}

const DIMENSIONS: Record<Lang, Record<DimensionId, string>> = {
  en: {
    skill: "Skill",
    location: "Location",
    availability: "Availability",
    experience: "Experience",
    commitment: "Commitment",
    resources: "Resources",
    language: "Language",
  },
  np: {
    skill: "सीप",
    location: "स्थान",
    availability: "उपलब्धता",
    experience: "अनुभव",
    commitment: "प्रतिबद्धता",
    resources: "स्रोत",
    language: "भाषा",
  },
};

export function dimensionLabel(lang: Lang, id: DimensionId): string {
  return DIMENSIONS[lang][id];
}

/** Colour token for a band, reusing the status palette in globals.css. */
export function bandColor(band: Band): string {
  if (band === "strong") return "var(--green)";
  if (band === "possible") return "var(--blue)";
  if (band === "stretch") return "var(--faint-2)";
  return "var(--red-2)";
}
