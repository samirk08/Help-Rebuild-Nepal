import type { Lang } from "./content";

/**
 * Physical relief items.
 *
 * Built needs-first on purpose. Humanitarian logistics has a name for the
 * alternative — the "second disaster": unsolicited goods arrive, fill the
 * warehouses and the roads, absorb the volunteer labour needed elsewhere, and
 * physically displace the cargo people actually asked for. Used clothing is the
 * classic case, which is why every clothing category here is new-only.
 *
 * So the primary flow is: a verified need is published with a quantity, and
 * donors pledge against it. Offering items nobody requested is still possible —
 * refusing it would just push the offer off-platform — but it is labelled
 * unrequested wherever it appears, the same way the design already labels
 * community-reported needs as unverified.
 *
 * The platform never takes custody of goods, exactly as it never takes custody
 * of money. It records who has what and who needs it, and gets out of the way.
 */

export type ReliefCategory = {
  id: string;
  name: string;
  nameNp: string;
  /** The unit that makes a quantity matchable. "Some blankets" cannot be matched. */
  unit: string;
  unitNp: string;
  /** Set where condition matters enough to state on the form. */
  newOnly?: boolean;
};

export const RELIEF_CATEGORIES: ReliefCategory[] = [
  { id: "tarpaulin", name: "Tarpaulin / shelter sheet", nameNp: "त्रिपाल / छाना पाल", unit: "pieces", unitNp: "थान" },
  { id: "tent", name: "Tent", nameNp: "पाल", unit: "pieces", unitNp: "थान" },
  { id: "cgi-sheet", name: "Corrugated roofing sheet", nameNp: "जस्तापाता", unit: "sheets", unitNp: "पाता" },
  { id: "blanket", name: "Blanket", nameNp: "कम्बल", unit: "pieces", unitNp: "थान", newOnly: true },
  { id: "sleeping-mat", name: "Sleeping mat", nameNp: "सुत्ने गुन्द्री", unit: "pieces", unitNp: "थान" },
  { id: "warm-clothing", name: "Warm clothing", nameNp: "न्यानो लुगा", unit: "sets", unitNp: "सेट", newOnly: true },
  { id: "rice", name: "Rice", nameNp: "चामल", unit: "kg", unitNp: "के.जी." },
  { id: "lentils", name: "Lentils / dal", nameNp: "दाल", unit: "kg", unitNp: "के.जी." },
  { id: "cooking-oil", name: "Cooking oil", nameNp: "खाने तेल", unit: "litres", unitNp: "लिटर" },
  { id: "salt", name: "Salt", nameNp: "नुन", unit: "kg", unitNp: "के.जी." },
  { id: "drinking-water", name: "Drinking water", nameNp: "खानेपानी", unit: "litres", unitNp: "लिटर" },
  { id: "water-purification", name: "Water purification tablets", nameNp: "पानी शुद्धीकरण चक्की", unit: "packs", unitNp: "प्याकेट" },
  { id: "jerrycan", name: "Bucket / jerrycan", nameNp: "बाल्टिन / ज्यारिकेन", unit: "pieces", unitNp: "थान" },
  { id: "hygiene-kit", name: "Hygiene kit", nameNp: "सरसफाइ किट", unit: "kits", unitNp: "किट" },
  { id: "sanitary-pads", name: "Sanitary pads", nameNp: "स्यानिटरी प्याड", unit: "packs", unitNp: "प्याकेट" },
  { id: "soap", name: "Soap", nameNp: "साबुन", unit: "pieces", unitNp: "थान" },
  { id: "first-aid", name: "First aid kit", nameNp: "प्राथमिक उपचार किट", unit: "kits", unitNp: "किट" },
  { id: "solar-lamp", name: "Solar lamp / torch", nameNp: "सोलार बत्ती / टर्च", unit: "pieces", unitNp: "थान" },
  { id: "cooking-set", name: "Cooking utensil set", nameNp: "भाँडाकुँडा सेट", unit: "sets", unitNp: "सेट" },
  { id: "rope", name: "Rope", nameNp: "डोरी", unit: "metres", unitNp: "मिटर" },
];

export function categoryById(id: string): ReliefCategory | undefined {
  return RELIEF_CATEGORIES.find((c) => c.id === id);
}

export function categoryLabel(category: ReliefCategory, lang: Lang): string {
  return lang === "np" ? category.nameNp : category.name;
}

export function unitLabel(category: ReliefCategory, lang: Lang): string {
  return lang === "np" ? category.unitNp : category.unit;
}

export type ItemNeed = {
  id: string;
  category: string;
  quantity: number;
  pledged: number;
  district: string;
  municipality: string;
  ward?: string;
  /** ISO date. Winter and monsoon make timing part of whether an item helps at all. */
  neededBy: string;
  requester: string;
  verified: boolean;
  detail: string;
  detailNp: string;
};

/**
 * No item need has been verified yet, the same as every other board here.
 * Counts stay at zero until real requests arrive.
 */
export const ITEM_NEEDS: ItemNeed[] = [];

/** The one worked example, so the shape of a good request is visible. */
export const EXAMPLE_ITEM_NEED: ItemNeed = {
  id: "example",
  category: "tarpaulin",
  quantity: 200,
  pledged: 0,
  district: "Sindhupalchok",
  municipality: "Melamchi Municipality",
  ward: "7",
  neededBy: "2026-09-15",
  requester: "Melamchi Municipality",
  verified: true,
  detail:
    "Ward 7 has 96 households without intact roofing before the next rains. Tarpaulins of 4×6m or larger are usable; smaller sheets are not. The ward office will store and distribute, and can receive deliveries on any weekday morning.",
  detailNp:
    "वडा ७ का ९६ घरधुरीको छाना अर्को वर्षा अघि मर्मत हुनुपर्नेछ। ४×६ मिटर वा सोभन्दा ठूलो त्रिपाल उपयोगी हुन्छ; सानो पाल हुँदैन। वडा कार्यालयले भण्डारण र वितरण गर्नेछ, र कुनै पनि कार्यदिनको बिहान डेलिभरी लिन सक्छ।",
};

export function itemNeedById(id: string): ItemNeed | undefined {
  if (id === EXAMPLE_ITEM_NEED.id) return EXAMPLE_ITEM_NEED;
  return ITEM_NEEDS.find((n) => n.id === id);
}

/** Formats a quantity with its unit in the reader's language. */
export function formatQuantity(need: ItemNeed, lang: Lang): string {
  const category = categoryById(need.category);
  if (!category) return String(need.quantity);
  return `${need.quantity.toLocaleString()} ${unitLabel(category, lang)}`;
}
