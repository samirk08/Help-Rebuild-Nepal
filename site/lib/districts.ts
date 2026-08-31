import type { Lang } from "./content";

/**
 * All 77 districts of Nepal, grouped by the seven provinces of the federal
 * structure.
 *
 * The design shipped a 10-district placeholder list, which meant a municipality
 * outside those ten could not state where it was. This is the full set.
 *
 * TRANSLATION NOTE: the Devanagari names below need review by a Nepali speaker
 * before launch. They follow standard spellings, but orthographic variants
 * exist (ओखलढुङ्गा / ओखलढुंगा) and a wrong place name on a disaster site is
 * worse than an English one. This is the single block to review — nothing else
 * depends on it.
 *
 * COORDINATE NOTE: each district carries the approximate position of its
 * headquarters town, to one or two decimal places — roughly a kilometre. It is
 * there so `districtDistanceKm` can tell "the next district over" from "the
 * other end of the country" for lib/matching.ts, and for nothing else. It is
 * not a boundary, not a centroid, and not survey data: a district is not a
 * point, and in a country this mountainous a straight line between two towns
 * can be a day's drive apart from the road between them. Everything that reads
 * these treats them as coarse bands, never as a travel estimate — see
 * PROXIMITY_BANDS in lib/matching.ts.
 */

export type Province = {
  id: string;
  name: string;
  nameNp: string;
};

export type District = {
  name: string;
  nameNp: string;
  province: string;
  /** District headquarters, approximate — see the coordinate note above. */
  lat: number;
  lon: number;
};

export const PROVINCES: Province[] = [
  { id: "koshi", name: "Koshi", nameNp: "कोशी" },
  { id: "madhesh", name: "Madhesh", nameNp: "मधेश" },
  { id: "bagmati", name: "Bagmati", nameNp: "बागमती" },
  { id: "gandaki", name: "Gandaki", nameNp: "गण्डकी" },
  { id: "lumbini", name: "Lumbini", nameNp: "लुम्बिनी" },
  { id: "karnali", name: "Karnali", nameNp: "कर्णाली" },
  { id: "sudurpashchim", name: "Sudurpashchim", nameNp: "सुदूरपश्चिम" },
];

export const DISTRICTS_FULL: District[] = [
  // Koshi — 14
  { name: "Bhojpur", nameNp: "भोजपुर", province: "koshi", lat: 27.17, lon: 87.05 },
  { name: "Dhankuta", nameNp: "धनकुटा", province: "koshi", lat: 26.98, lon: 87.34 },
  { name: "Ilam", nameNp: "इलाम", province: "koshi", lat: 26.91, lon: 87.93 },
  { name: "Jhapa", nameNp: "झापा", province: "koshi", lat: 26.55, lon: 88.08 },
  { name: "Khotang", nameNp: "खोटाङ", province: "koshi", lat: 27.21, lon: 86.80 },
  { name: "Morang", nameNp: "मोरङ", province: "koshi", lat: 26.45, lon: 87.28 },
  { name: "Okhaldhunga", nameNp: "ओखलढुङ्गा", province: "koshi", lat: 27.32, lon: 86.50 },
  { name: "Panchthar", nameNp: "पाँचथर", province: "koshi", lat: 27.15, lon: 87.76 },
  { name: "Sankhuwasabha", nameNp: "संखुवासभा", province: "koshi", lat: 27.37, lon: 87.21 },
  { name: "Solukhumbu", nameNp: "सोलुखुम्बु", province: "koshi", lat: 27.51, lon: 86.59 },
  { name: "Sunsari", nameNp: "सुनसरी", province: "koshi", lat: 26.60, lon: 87.15 },
  { name: "Taplejung", nameNp: "ताप्लेजुङ", province: "koshi", lat: 27.35, lon: 87.67 },
  { name: "Terhathum", nameNp: "तेह्रथुम", province: "koshi", lat: 27.13, lon: 87.50 },
  { name: "Udayapur", nameNp: "उदयपुर", province: "koshi", lat: 26.80, lon: 86.71 },

  // Madhesh — 8
  { name: "Bara", nameNp: "बारा", province: "madhesh", lat: 27.03, lon: 85.00 },
  { name: "Dhanusha", nameNp: "धनुषा", province: "madhesh", lat: 26.73, lon: 85.93 },
  { name: "Mahottari", nameNp: "महोत्तरी", province: "madhesh", lat: 26.64, lon: 85.80 },
  { name: "Parsa", nameNp: "पर्सा", province: "madhesh", lat: 27.00, lon: 84.87 },
  { name: "Rautahat", nameNp: "रौतहट", province: "madhesh", lat: 26.77, lon: 85.28 },
  { name: "Saptari", nameNp: "सप्तरी", province: "madhesh", lat: 26.54, lon: 86.75 },
  { name: "Sarlahi", nameNp: "सर्लाही", province: "madhesh", lat: 26.86, lon: 85.56 },
  { name: "Siraha", nameNp: "सिरहा", province: "madhesh", lat: 26.65, lon: 86.21 },

  // Bagmati — 13
  { name: "Bhaktapur", nameNp: "भक्तपुर", province: "bagmati", lat: 27.67, lon: 85.43 },
  { name: "Chitwan", nameNp: "चितवन", province: "bagmati", lat: 27.68, lon: 84.43 },
  { name: "Dhading", nameNp: "धादिङ", province: "bagmati", lat: 27.87, lon: 84.90 },
  { name: "Dolakha", nameNp: "दोलखा", province: "bagmati", lat: 27.67, lon: 86.05 },
  { name: "Kathmandu", nameNp: "काठमाडौं", province: "bagmati", lat: 27.72, lon: 85.32 },
  { name: "Kavrepalanchok", nameNp: "काभ्रेपलाञ्चोक", province: "bagmati", lat: 27.62, lon: 85.55 },
  { name: "Lalitpur", nameNp: "ललितपुर", province: "bagmati", lat: 27.67, lon: 85.32 },
  { name: "Makwanpur", nameNp: "मकवानपुर", province: "bagmati", lat: 27.43, lon: 85.03 },
  { name: "Nuwakot", nameNp: "नुवाकोट", province: "bagmati", lat: 27.87, lon: 85.16 },
  { name: "Ramechhap", nameNp: "रामेछाप", province: "bagmati", lat: 27.42, lon: 86.08 },
  { name: "Rasuwa", nameNp: "रसुवा", province: "bagmati", lat: 28.11, lon: 85.30 },
  { name: "Sindhuli", nameNp: "सिन्धुली", province: "bagmati", lat: 27.26, lon: 85.91 },
  { name: "Sindhupalchok", nameNp: "सिन्धुपाल्चोक", province: "bagmati", lat: 27.79, lon: 85.71 },

  // Gandaki — 11
  { name: "Baglung", nameNp: "बागलुङ", province: "gandaki", lat: 28.27, lon: 83.59 },
  { name: "Gorkha", nameNp: "गोरखा", province: "gandaki", lat: 28.00, lon: 84.63 },
  { name: "Kaski", nameNp: "कास्की", province: "gandaki", lat: 28.21, lon: 83.99 },
  { name: "Lamjung", nameNp: "लमजुङ", province: "gandaki", lat: 28.23, lon: 84.38 },
  { name: "Manang", nameNp: "मनाङ", province: "gandaki", lat: 28.55, lon: 84.24 },
  { name: "Mustang", nameNp: "मुस्ताङ", province: "gandaki", lat: 28.78, lon: 83.73 },
  { name: "Myagdi", nameNp: "म्याग्दी", province: "gandaki", lat: 28.35, lon: 83.56 },
  { name: "Nawalpur", nameNp: "नवलपुर", province: "gandaki", lat: 27.64, lon: 84.13 },
  { name: "Parbat", nameNp: "पर्वत", province: "gandaki", lat: 28.23, lon: 83.69 },
  { name: "Syangja", nameNp: "स्याङ्जा", province: "gandaki", lat: 28.10, lon: 83.88 },
  { name: "Tanahun", nameNp: "तनहुँ", province: "gandaki", lat: 27.99, lon: 84.28 },

  // Lumbini — 12
  { name: "Arghakhanchi", nameNp: "अर्घाखाँची", province: "lumbini", lat: 27.94, lon: 83.12 },
  { name: "Banke", nameNp: "बाँके", province: "lumbini", lat: 28.05, lon: 81.62 },
  { name: "Bardiya", nameNp: "बर्दिया", province: "lumbini", lat: 28.21, lon: 81.34 },
  { name: "Dang", nameNp: "दाङ", province: "lumbini", lat: 28.05, lon: 82.49 },
  { name: "Eastern Rukum", nameNp: "पूर्वी रुकुम", province: "lumbini", lat: 28.62, lon: 82.63 },
  { name: "Gulmi", nameNp: "गुल्मी", province: "lumbini", lat: 28.07, lon: 83.25 },
  { name: "Kapilvastu", nameNp: "कपिलवस्तु", province: "lumbini", lat: 27.55, lon: 83.06 },
  { name: "Palpa", nameNp: "पाल्पा", province: "lumbini", lat: 27.87, lon: 83.55 },
  { name: "Parasi", nameNp: "परासी", province: "lumbini", lat: 27.55, lon: 83.68 },
  { name: "Pyuthan", nameNp: "प्युठान", province: "lumbini", lat: 28.10, lon: 82.87 },
  { name: "Rolpa", nameNp: "रोल्पा", province: "lumbini", lat: 28.29, lon: 82.63 },
  { name: "Rupandehi", nameNp: "रुपन्देही", province: "lumbini", lat: 27.63, lon: 83.45 },

  // Karnali — 10
  { name: "Dailekh", nameNp: "दैलेख", province: "karnali", lat: 28.84, lon: 81.71 },
  { name: "Dolpa", nameNp: "डोल्पा", province: "karnali", lat: 28.94, lon: 82.92 },
  { name: "Humla", nameNp: "हुम्ला", province: "karnali", lat: 29.97, lon: 81.82 },
  { name: "Jajarkot", nameNp: "जाजरकोट", province: "karnali", lat: 28.70, lon: 82.19 },
  { name: "Jumla", nameNp: "जुम्ला", province: "karnali", lat: 29.27, lon: 82.18 },
  { name: "Kalikot", nameNp: "कालिकोट", province: "karnali", lat: 29.16, lon: 81.62 },
  { name: "Mugu", nameNp: "मुगु", province: "karnali", lat: 29.55, lon: 82.30 },
  { name: "Salyan", nameNp: "सल्यान", province: "karnali", lat: 28.38, lon: 82.17 },
  { name: "Surkhet", nameNp: "सुर्खेत", province: "karnali", lat: 28.60, lon: 81.63 },
  { name: "Western Rukum", nameNp: "पश्चिमी रुकुम", province: "karnali", lat: 28.63, lon: 82.49 },

  // Sudurpashchim — 9
  { name: "Achham", nameNp: "अछाम", province: "sudurpashchim", lat: 29.14, lon: 81.29 },
  { name: "Baitadi", nameNp: "बैतडी", province: "sudurpashchim", lat: 29.53, lon: 80.47 },
  { name: "Bajhang", nameNp: "बझाङ", province: "sudurpashchim", lat: 29.54, lon: 81.21 },
  { name: "Bajura", nameNp: "बाजुरा", province: "sudurpashchim", lat: 29.44, lon: 81.53 },
  { name: "Dadeldhura", nameNp: "डडेल्धुरा", province: "sudurpashchim", lat: 29.30, lon: 80.58 },
  { name: "Darchula", nameNp: "दार्चुला", province: "sudurpashchim", lat: 29.84, lon: 80.55 },
  { name: "Doti", nameNp: "डोटी", province: "sudurpashchim", lat: 29.26, lon: 80.93 },
  { name: "Kailali", nameNp: "कैलाली", province: "sudurpashchim", lat: 28.70, lon: 80.60 },
  { name: "Kanchanpur", nameNp: "कञ्चनपुर", province: "sudurpashchim", lat: 28.96, lon: 80.18 },
];

/** Volunteers register from outside Nepal too — the diaspora is a stated audience. */
export const OUTSIDE_NEPAL = { name: "Outside Nepal", nameNp: "नेपाल बाहिर" };

export type Option = { value: string; label: string; group?: string };

/** District options for a language, grouped by province, with the diaspora entry last. */
export function districtOptions(lang: Lang): Option[] {
  const provinceLabel = new Map(
    PROVINCES.map((p) => [p.id, lang === "np" ? p.nameNp : p.name])
  );

  const options: Option[] = DISTRICTS_FULL.map((d) => ({
    value: d.name,
    label: lang === "np" ? d.nameNp : d.name,
    group: provinceLabel.get(d.province),
  }));

  options.push({
    value: OUTSIDE_NEPAL.name,
    label: lang === "np" ? OUTSIDE_NEPAL.nameNp : OUTSIDE_NEPAL.name,
  });

  return options;
}

/**
 * The Nepali name for a stored district value, for anywhere a district is read
 * back out of the database rather than picked from `districtOptions`.
 *
 * Submissions store the English name (that is the option's value), so the
 * translation has to happen on the way out. Anything unrecognised — a district
 * renamed upstream, a value written by hand — falls back to what is stored
 * rather than rendering blank.
 */
export function districtLabel(lang: Lang, name: string): string {
  if (lang !== "np") return name;
  if (name === OUTSIDE_NEPAL.name) return OUTSIDE_NEPAL.nameNp;
  return DISTRICTS_FULL.find((d) => d.name === name)?.nameNp ?? name;
}

/**
 * Index by district name, built once. `districtDistanceKm` is called for every
 * candidate in a matching run, and a linear `find` over 77 entries inside a
 * loop over the whole volunteer register is the kind of thing that only shows
 * up as slowness once the register is big enough to matter.
 */
const BY_NAME = new Map(DISTRICTS_FULL.map((d) => [d.name, d] as const));

export function findDistrict(name: string | null | undefined): District | null {
  return name ? (BY_NAME.get(name) ?? null) : null;
}

/** The province id a district sits in, or null for an unrecognised name. */
export function provinceOf(name: string | null | undefined): string | null {
  return findDistrict(name)?.province ?? null;
}

/**
 * Whether a stored district value is the diaspora entry rather than a district.
 *
 * `Outside Nepal` is a legitimate answer to "where are you based" and has no
 * position, so anything reasoning about distance has to branch on it rather
 * than treat it as a district it failed to recognise.
 */
export function isOutsideNepal(name: string | null | undefined): boolean {
  return name === OUTSIDE_NEPAL.name;
}

/**
 * Great-circle kilometres between two districts' headquarters.
 *
 * Null when either name is unknown or is "Outside Nepal" — the honest answer
 * for a pair with no distance rather than a large number that would read as a
 * measurement. Callers band the result; see the coordinate note above for why
 * this must not be presented to anyone as a travel distance.
 */
export function districtDistanceKm(a: string | null | undefined, b: string | null | undefined): number | null {
  const from = findDistrict(a);
  const to = findDistrict(b);
  if (!from || !to) return null;
  if (from.name === to.name) return 0;

  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
