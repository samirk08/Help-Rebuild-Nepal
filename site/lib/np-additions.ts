/**
 * Nepali for strings written after the approved design.
 *
 * `NP_MAP` in `lib/content.ts` is generated from the design file, so anything
 * added there by hand is lost the next time `scripts/gen-content.js` runs. The
 * three-step need form and the two consent sentences were written after that
 * file was frozen, and none of them had Nepali — so a Nepali reader picking
 * what kind of help they needed chose between "Skilled volunteers", "Relief
 * items" and "Assessment or survey", and then ticked a consent box written in
 * English. That is the whole point of the form failing quietly: every string is
 * a perfectly valid string.
 *
 * `translator()` consults this first, so entries here survive regeneration.
 *
 * TRANSLATION NOTE: machine-supplied, like `lib/added-strings.ts`. Both files
 * need a Nepali speaker before a production rollout.
 */
export const NP_ADDITIONS: Record<string, string> = {
  // What kind of help is needed — the first question on the form.
  "Skilled volunteers": "दक्ष स्वयंसेवक",
  "Relief items": "राहत सामग्री",
  "Assessment or survey": "मूल्याङ्कन वा सर्वेक्षण",
  "Transport or logistics": "यातायात वा ढुवानी",
  "Something else": "अन्य केही",

  // Where the work happens.
  "On site": "स्थलगत",
  Either: "दुवै",

  // Urgency is already covered by the design's own map; the options above are
  // the ones the three-step form introduced.

  // The consent sentences. Both are the moment someone agrees to their details
  // being shared, which is the last place an untranslated string belongs.
  "I agree to my details being shared with verified requesters, government agencies and partner organizations so they can coordinate relief and reconstruction.":
    "राहत र पुनर्निर्माण समन्वय गर्न सकून् भनी मेरो विवरण प्रमाणित अनुरोधकर्ता, सरकारी निकाय र साझेदार संस्थासँग बाँड्न म सहमत छु।",
  "I confirm this request is genuine and that I am authorised to make it on behalf of the organization named above.":
    "म पुष्टि गर्छु कि यो अनुरोध वास्तविक हो र माथि उल्लेखित संस्थाको तर्फबाट यो गर्न म अधिकारप्राप्त छु।",
};
