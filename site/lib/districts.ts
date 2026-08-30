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
  { name: "Bhojpur", nameNp: "भोजपुर", province: "koshi" },
  { name: "Dhankuta", nameNp: "धनकुटा", province: "koshi" },
  { name: "Ilam", nameNp: "इलाम", province: "koshi" },
  { name: "Jhapa", nameNp: "झापा", province: "koshi" },
  { name: "Khotang", nameNp: "खोटाङ", province: "koshi" },
  { name: "Morang", nameNp: "मोरङ", province: "koshi" },
  { name: "Okhaldhunga", nameNp: "ओखलढुङ्गा", province: "koshi" },
  { name: "Panchthar", nameNp: "पाँचथर", province: "koshi" },
  { name: "Sankhuwasabha", nameNp: "संखुवासभा", province: "koshi" },
  { name: "Solukhumbu", nameNp: "सोलुखुम्बु", province: "koshi" },
  { name: "Sunsari", nameNp: "सुनसरी", province: "koshi" },
  { name: "Taplejung", nameNp: "ताप्लेजुङ", province: "koshi" },
  { name: "Terhathum", nameNp: "तेह्रथुम", province: "koshi" },
  { name: "Udayapur", nameNp: "उदयपुर", province: "koshi" },

  // Madhesh — 8
  { name: "Bara", nameNp: "बारा", province: "madhesh" },
  { name: "Dhanusha", nameNp: "धनुषा", province: "madhesh" },
  { name: "Mahottari", nameNp: "महोत्तरी", province: "madhesh" },
  { name: "Parsa", nameNp: "पर्सा", province: "madhesh" },
  { name: "Rautahat", nameNp: "रौतहट", province: "madhesh" },
  { name: "Saptari", nameNp: "सप्तरी", province: "madhesh" },
  { name: "Sarlahi", nameNp: "सर्लाही", province: "madhesh" },
  { name: "Siraha", nameNp: "सिरहा", province: "madhesh" },

  // Bagmati — 13
  { name: "Bhaktapur", nameNp: "भक्तपुर", province: "bagmati" },
  { name: "Chitwan", nameNp: "चितवन", province: "bagmati" },
  { name: "Dhading", nameNp: "धादिङ", province: "bagmati" },
  { name: "Dolakha", nameNp: "दोलखा", province: "bagmati" },
  { name: "Kathmandu", nameNp: "काठमाडौं", province: "bagmati" },
  { name: "Kavrepalanchok", nameNp: "काभ्रेपलाञ्चोक", province: "bagmati" },
  { name: "Lalitpur", nameNp: "ललितपुर", province: "bagmati" },
  { name: "Makwanpur", nameNp: "मकवानपुर", province: "bagmati" },
  { name: "Nuwakot", nameNp: "नुवाकोट", province: "bagmati" },
  { name: "Ramechhap", nameNp: "रामेछाप", province: "bagmati" },
  { name: "Rasuwa", nameNp: "रसुवा", province: "bagmati" },
  { name: "Sindhuli", nameNp: "सिन्धुली", province: "bagmati" },
  { name: "Sindhupalchok", nameNp: "सिन्धुपाल्चोक", province: "bagmati" },

  // Gandaki — 11
  { name: "Baglung", nameNp: "बागलुङ", province: "gandaki" },
  { name: "Gorkha", nameNp: "गोरखा", province: "gandaki" },
  { name: "Kaski", nameNp: "कास्की", province: "gandaki" },
  { name: "Lamjung", nameNp: "लमजुङ", province: "gandaki" },
  { name: "Manang", nameNp: "मनाङ", province: "gandaki" },
  { name: "Mustang", nameNp: "मुस्ताङ", province: "gandaki" },
  { name: "Myagdi", nameNp: "म्याग्दी", province: "gandaki" },
  { name: "Nawalpur", nameNp: "नवलपुर", province: "gandaki" },
  { name: "Parbat", nameNp: "पर्वत", province: "gandaki" },
  { name: "Syangja", nameNp: "स्याङ्जा", province: "gandaki" },
  { name: "Tanahun", nameNp: "तनहुँ", province: "gandaki" },

  // Lumbini — 12
  { name: "Arghakhanchi", nameNp: "अर्घाखाँची", province: "lumbini" },
  { name: "Banke", nameNp: "बाँके", province: "lumbini" },
  { name: "Bardiya", nameNp: "बर्दिया", province: "lumbini" },
  { name: "Dang", nameNp: "दाङ", province: "lumbini" },
  { name: "Eastern Rukum", nameNp: "पूर्वी रुकुम", province: "lumbini" },
  { name: "Gulmi", nameNp: "गुल्मी", province: "lumbini" },
  { name: "Kapilvastu", nameNp: "कपिलवस्तु", province: "lumbini" },
  { name: "Palpa", nameNp: "पाल्पा", province: "lumbini" },
  { name: "Parasi", nameNp: "परासी", province: "lumbini" },
  { name: "Pyuthan", nameNp: "प्युठान", province: "lumbini" },
  { name: "Rolpa", nameNp: "रोल्पा", province: "lumbini" },
  { name: "Rupandehi", nameNp: "रुपन्देही", province: "lumbini" },

  // Karnali — 10
  { name: "Dailekh", nameNp: "दैलेख", province: "karnali" },
  { name: "Dolpa", nameNp: "डोल्पा", province: "karnali" },
  { name: "Humla", nameNp: "हुम्ला", province: "karnali" },
  { name: "Jajarkot", nameNp: "जाजरकोट", province: "karnali" },
  { name: "Jumla", nameNp: "जुम्ला", province: "karnali" },
  { name: "Kalikot", nameNp: "कालिकोट", province: "karnali" },
  { name: "Mugu", nameNp: "मुगु", province: "karnali" },
  { name: "Salyan", nameNp: "सल्यान", province: "karnali" },
  { name: "Surkhet", nameNp: "सुर्खेत", province: "karnali" },
  { name: "Western Rukum", nameNp: "पश्चिमी रुकुम", province: "karnali" },

  // Sudurpashchim — 9
  { name: "Achham", nameNp: "अछाम", province: "sudurpashchim" },
  { name: "Baitadi", nameNp: "बैतडी", province: "sudurpashchim" },
  { name: "Bajhang", nameNp: "बझाङ", province: "sudurpashchim" },
  { name: "Bajura", nameNp: "बाजुरा", province: "sudurpashchim" },
  { name: "Dadeldhura", nameNp: "डडेल्धुरा", province: "sudurpashchim" },
  { name: "Darchula", nameNp: "दार्चुला", province: "sudurpashchim" },
  { name: "Doti", nameNp: "डोटी", province: "sudurpashchim" },
  { name: "Kailali", nameNp: "कैलाली", province: "sudurpashchim" },
  { name: "Kanchanpur", nameNp: "कञ्चनपुर", province: "sudurpashchim" },
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
