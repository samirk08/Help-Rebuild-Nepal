import type { Lang } from "./content";

/**
 * Strings for controls that did not exist in the approved design.
 *
 * Everything in `content.ts` came from the design and its Nepali was written by
 * whoever wrote the design. These did not, so their Nepali is machine-supplied.
 *
 * TRANSLATION NOTE: review this file alongside the district names in
 * `districts.ts` before launch. It is short on purpose — one place to check.
 */

export type AddedStrings = {
  districtPlaceholder: string;
  districtEmpty: string;
  locRecognised: string;
  locOutside: string;
  locViewMap: string;
  locLandmark: string;
  uploadPrompt: string;
  uploadBrowse: string;
  uploadLimits: string;
  uploadRemove: string;
  uploadRejectedType: string;
  uploadRejectedSize: string;
  uploadRejectedCount: string;
  uploadNotStored: string;
  sectionFilled: string;

  notConnectedTitle: string;
  notConnectedBody: string;

  reliefNav: string;
  reliefTitle: string;
  reliefIntro: string;
  reliefEmptyTitle: string;
  reliefEmptyBody: string;
  reliefSeeExample: string;
  reliefBackToBoard: string;
  reliefOfferCta: string;
  reliefOfferTitle: string;
  reliefOfferIntro: string;
  reliefPledgeCta: string;
  reliefPledged: string;
  reliefNeededBy: string;
  reliefQuantity: string;
  reliefItem: string;
  reliefLocation: string;
  reliefRequester: string;
  reliefStatus: string;
  reliefUnrequested: string;
  reliefNewOnly: string;
  reliefNoCustodyTitle: string;
  reliefNoCustodyBody: string;
  reliefWhyNeedsFirstTitle: string;
  reliefWhyNeedsFirstBody: string;
  reliefPickNeed: string;
  reliefPickNeedNone: string;
  reliefUnmatchedWarning: string;
  reliefYourItems: string;
  reliefCanDeliver: string;
  reliefWhereGoods: string;
  reliefAvailableFrom: string;
  reliefContact: string;
  reliefShippingTitle: string;
  reliefShippingBody: string;
  reliefToastPledge: string;
  reliefToastOffer: string;
  reliefSubmitOffer: string;
  reliefFilterAll: string;
  reliefConsent: string;
};

const ADDED: Record<Lang, AddedStrings> = {
  en: {
    districtPlaceholder: "Search all 77 districts…",
    districtEmpty: "No district matches that search",
    locRecognised: "Coordinates recognised:",
    locOutside: "These coordinates are outside Nepal:",
    locViewMap: "View on map",
    locLandmark: "Saved as a landmark description.",
    uploadPrompt: "Drag photographs or documents here",
    uploadBrowse: "Choose files",
    uploadLimits: "Images or PDF · up to 10 MB each · 8 files maximum",
    uploadRemove: "Remove",
    uploadRejectedType: "not an image or PDF",
    uploadRejectedSize: "larger than 10 MB",
    uploadRejectedCount: "over the 8 file limit",
    uploadNotStored:
      "Files are listed with your request. Uploading is not connected yet, so they are not sent.",
    sectionFilled: "has entries",

    notConnectedTitle: "This form is not connected yet",
    notConnectedBody:
      "Nothing you enter is recorded, stored or sent. Registration opens once verification partners are in place. Do not rely on this as a submission.",

    reliefNav: "Relief items",
    reliefTitle: "Relief items",
    reliefIntro:
      "Verified requests for supplies: what is needed, how much, where and by when. Groups pledge against a published request, so what arrives is what was asked for.",
    reliefEmptyTitle: "No item requests have been verified yet",
    reliefEmptyBody:
      "Verified requests appear here with a quantity and a deadline. Until one is published, register what you can move and where you operate.",
    reliefSeeExample: "See an example request",
    reliefBackToBoard: "← Back to all relief items",
    reliefOfferCta: "Offer items",
    reliefOfferTitle: "Offer relief items",
    reliefOfferIntro:
      "Choose the request you can supply. Matching offers to published requests keeps the right things moving to the right places.",
    reliefPledgeCta: "Pledge items for this request →",
    reliefPledged: "pledged so far",
    reliefNeededBy: "Needed by",
    reliefQuantity: "Quantity needed",
    reliefItem: "Item",
    reliefLocation: "Location",
    reliefRequester: "Requested by",
    reliefStatus: "Status",
    reliefUnrequested: "UNREQUESTED · NOT MATCHED TO A VERIFIED NEED",
    reliefNewOnly: "New or unused only",
    reliefNoCustodyTitle: "This platform never handles your goods",
    reliefNoCustodyBody:
      "Help Rebuild Nepal does not collect, store, transport or own any items. It records who needs what and who can supply it. The two parties arrange the handover directly, just as money goes to the Prime Minister Disaster Relief Fund rather than to us.",
    reliefWhyNeedsFirstTitle: "Why requests come first",
    reliefWhyNeedsFirstBody:
      "Supplies nobody asked for fill warehouses, block roads and absorb volunteers needed elsewhere. Matching every offer to a published request prevents that. Used clothing and expired goods are never accepted.",
    reliefPickNeed: "Which request are you supplying?",
    reliefPickNeedNone: "I have items that no one has requested yet",
    reliefUnmatchedWarning:
      "Unmatched offers are listed and labelled unrequested. They are not distributed until a verifier matches them to a real need, so do not dispatch anything before you are contacted.",
    reliefYourItems: "What you can supply",
    reliefCanDeliver: "Can you deliver?",
    reliefWhereGoods: "Where the items are now",
    reliefAvailableFrom: "Available from",
    reliefContact: "How the requester reaches you",
    reliefShippingTitle: "Sending from outside Nepal?",
    reliefShippingBody:
      "Shipping from abroad usually costs more than buying the same items in Nepal, and consignments can sit in customs for weeks. Funding local purchase is faster and supports Nepali suppliers. Check current rules before shipping anything.",
    reliefToastPledge:
      "Design preview. No pledge was recorded.",
    reliefToastOffer:
      "Design preview. Nothing was submitted. A live offer would go to verification.",
    reliefSubmitOffer: "Submit offer for review",
    reliefFilterAll: "All items",
    reliefConsent:
      "I confirm these items are new or unused unless stated otherwise, that I have not dispatched them, and that I will wait to be contacted before sending anything.",
  },
  np: {
    districtPlaceholder: "सबै ७७ जिल्ला खोज्नुहोस्…",
    districtEmpty: "त्यो खोजसँग मिल्ने जिल्ला छैन",
    locRecognised: "निर्देशाङ्क पहिचान भयो:",
    locOutside: "यी निर्देशाङ्क नेपाल बाहिरका हुन्:",
    locViewMap: "नक्सामा हेर्नुहोस्",
    locLandmark: "चिनारी स्थानको विवरणका रूपमा राखियो।",
    uploadPrompt: "तस्बिर वा कागजात यहाँ तान्नुहोस्",
    uploadBrowse: "फाइल छान्नुहोस्",
    uploadLimits: "तस्बिर वा PDF · प्रति फाइल १० MB सम्म · बढीमा ८ फाइल",
    uploadRemove: "हटाउनुहोस्",
    uploadRejectedType: "तस्बिर वा PDF होइन",
    uploadRejectedSize: "१० MB भन्दा ठूलो",
    uploadRejectedCount: "८ फाइलको सीमा नाघ्यो",
    uploadNotStored:
      "फाइल तपाईंको अनुरोधसँग सूचीबद्ध हुन्छन्। अपलोड अझै जोडिएको छैन, त्यसैले ती पठाइँदैनन्।",
    sectionFilled: "मा प्रविष्टि छ",

    notConnectedTitle: "यो फारम अझै जोडिएको छैन",
    notConnectedBody:
      "तपाईंले भरेको कुरा अभिलेख हुँदैन, राखिँदैन र पठाइँदैन। प्रमाणीकरण साझेदार तयार भएपछि दर्ता खुल्नेछ। यसलाई पेश गरिएको नठान्नुहोस्।",

    reliefNav: "राहत सामग्री",
    reliefTitle: "राहत सामग्री",
    reliefIntro:
      "सामग्रीका प्रमाणित अनुरोध: के चाहिन्छ, कति, कहाँ र कहिलेसम्म। समूहले प्रकाशित अनुरोधमै प्रतिबद्धता जनाउँछन्, ताकि पुग्ने सामान माग गरिएकै होस्।",
    reliefEmptyTitle: "अझै कुनै सामग्री अनुरोध प्रमाणित भएको छैन",
    reliefEmptyBody:
      "प्रमाणित अनुरोध परिमाण र म्यादसहित यहाँ देखिनेछन्। त्यससम्म तपाईंले ओसार्न सक्ने सामान र काम गर्ने क्षेत्र दर्ता गर्नुहोस्।",
    reliefSeeExample: "नमुना अनुरोध हेर्नुहोस्",
    reliefBackToBoard: "← सबै राहत सामग्रीमा फर्कनु",
    reliefOfferCta: "सामग्री दिनुहोस्",
    reliefOfferTitle: "राहत सामग्री दिनुहोस्",
    reliefOfferIntro:
      "तपाईंले पूरा गर्न सक्ने अनुरोध छान्नुहोस्। प्रकाशित अनुरोधसँग जोडिएको सहयोगले सही सामान सही ठाउँमा पुर्‍याउँछ।",
    reliefPledgeCta: "यो अनुरोधका लागि सामग्री दिने प्रतिबद्धता →",
    reliefPledged: "अहिलेसम्म प्रतिबद्ध",
    reliefNeededBy: "कहिलेसम्म चाहिन्छ",
    reliefQuantity: "आवश्यक परिमाण",
    reliefItem: "सामग्री",
    reliefLocation: "स्थान",
    reliefRequester: "अनुरोध गर्ने",
    reliefStatus: "स्थिति",
    reliefUnrequested: "अनुरोध नगरिएको · प्रमाणित आवश्यकतासँग नमिलेको",
    reliefNewOnly: "नयाँ वा प्रयोग नगरिएको मात्र",
    reliefNoCustodyTitle: "यो प्लेटफर्मले तपाईंको सामान लिँदैन",
    reliefNoCustodyBody:
      "हेल्प रिबिल्ड नेपालले कुनै पनि सामग्री सङ्कलन, भण्डारण, ढुवानी वा स्वामित्व लिँदैन। कसलाई के चाहिएको छ र कसले दिन सक्छ भन्ने अभिलेख मात्र राख्छ। हस्तान्तरण दुवै पक्षले सिधै मिलाउँछन्, जसरी आर्थिक सहयोग हामीकहाँ नभई प्रधानमन्त्री विपद् राहत कोषमा जान्छ।",
    reliefWhyNeedsFirstTitle: "किन अनुरोध पहिले",
    reliefWhyNeedsFirstBody:
      "कसैले नमागेको सामानले गोदाम भरिन्छ, बाटो रोक्छ र अन्यत्र चाहिने स्वयंसेवक अल्झाउँछ। हरेक सहयोगलाई प्रकाशित अनुरोधसँग जोड्नुले त्यो रोक्छ। प्रयोग गरिएको लुगा र म्याद सकिएको सामान कहिल्यै लिइँदैन।",
    reliefPickNeed: "तपाईं कुन अनुरोध पूरा गर्दै हुनुहुन्छ?",
    reliefPickNeedNone: "मसँग कसैले नमागेको सामान छ",
    reliefUnmatchedWarning:
      "नमिलेका सहयोग सूचीबद्ध हुन्छन् र 'अनुरोध नगरिएको' भनी लेबल गरिन्छ। प्रमाणकले वास्तविक आवश्यकतासँग नजोडेसम्म वितरण हुँदैन, त्यसैले सम्पर्क नआएसम्म सामान नपठाउनुहोस्।",
    reliefYourItems: "तपाईंले दिन सक्ने सामग्री",
    reliefCanDeliver: "तपाईं पुर्‍याउन सक्नुहुन्छ?",
    reliefWhereGoods: "सामान अहिले कहाँ छ",
    reliefAvailableFrom: "कहिलेदेखि उपलब्ध",
    reliefContact: "अनुरोधकर्ताले तपाईंलाई कसरी सम्पर्क गर्ने",
    reliefShippingTitle: "नेपाल बाहिरबाट पठाउँदै हुनुहुन्छ?",
    reliefShippingBody:
      "विदेशबाट पठाउँदा प्रायः नेपालमै किन्नुभन्दा महँगो पर्छ, र सामान भन्सारमा हप्तौं अड्किन सक्छ। स्थानीय खरिदका लागि रकम दिनु छिटो हुन्छ र नेपाली आपूर्तिकर्तालाई सघाउँछ। पठाउनुअघि हालको नियम बुझ्नुहोस्।",
    reliefToastPledge:
      "डिजाइन नमुना। कुनै प्रतिबद्धता अभिलेख भएन।",
    reliefToastOffer:
      "डिजाइन नमुना। केही पेश भएको छैन। वास्तविक सहयोग प्रमाणीकरणमा जान्थ्यो।",
    reliefSubmitOffer: "समीक्षाका लागि पेश गर्नुहोस्",
    reliefFilterAll: "सबै सामग्री",
    reliefConsent:
      "म पुष्टि गर्दछु कि अन्यथा उल्लेख नगरिएसम्म यी सामान नयाँ वा प्रयोग नगरिएका हुन्, मैले कतै पठाएको छैन, र पठाउनुअघि सम्पर्क आउने प्रतीक्षा गर्नेछु।",
  },
};

export function added(lang: Lang): AddedStrings {
  return ADDED[lang];
}
