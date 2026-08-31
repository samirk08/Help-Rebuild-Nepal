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
  sectionFilled: string;

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
  submitError: string;
  submitSuccessVolunteer: string;
  submitSuccessNeed: string;

  footerNote: string;
  headerTagline: string;
  loopWords: string[];

  thanksVolunteerTitle: string;
  thanksVolunteerBody: string;
  thanksNeedTitle: string;
  thanksNeedBody: string;
  thanksOfferTitle: string;
  thanksOfferBody: string;
  thanksNextTitle: string;
  thanksReference: string;
  thanksReferenceNote: string;
  thanksBrowseNeeds: string;
  thanksHome: string;
  thanksNoDuplicate: string;

  needsPeopleNeeded: string;
  needsCountOne: string;
  needsCountMany: string;
  needsClearFilters: string;
  needsCommunityReported: string;
  needsViewNeed: string;
  interestTitle: string;
  interestIntro: string;
  interestName: string;
  interestContact: string;
  interestContactHint: string;
  interestMessage: string;
  interestMessageHint: string;
  interestSubmit: string;
  interestSending: string;
  interestSuccess: string;
  interestError: string;
  interestCount: string;
  interestCountOne: string;
  networksMembers: string;
  networksEmpty: string;
  projectsCoordinator: string;
  projectsNoCoordinator: string;

  profileSignedOutTitle: string;
  profileSignedOutBody: string;
  profileSignIn: string;
  profileNotRegistered: string;
  profileNoRegTitle: string;
  profileNoRegBody: string;
  profileSignedInAs: string;
  profileStatusTitle: string;
  profileStatusNote: string;
  profileStatusRejected: string;
  profileRejectedNote: string;
  profileRegisteredOn: string;
  profileVerifiedOn: string;
  profileInterestsTitle: string;
  profileInterestsEmpty: string;
  trackerNoOrigins: string;
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
    sectionFilled: "has entries",

    reliefNav: "Relief items",
    reliefTitle: "Relief items",
    reliefIntro:
      "Verified requests for supplies: what is needed, how much, where and by when. Groups pledge against a verified request, so what arrives is what was asked for.",
    reliefEmptyTitle: "No item requests have been verified yet",
    reliefEmptyBody:
      "Verified requests appear here with a quantity and a deadline. Until one does, register what you can move and where you operate.",
    reliefSeeExample: "See an example request",
    reliefBackToBoard: "← Back to all relief items",
    reliefOfferCta: "Offer items",
    reliefOfferTitle: "Offer relief items",
    reliefOfferIntro:
      "Choose the request you can supply. Offers tied to a verified request are the ones that get through, and they stop unwanted goods piling up.",
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
    reliefNoCustodyTitle: "We never handle your goods",
    reliefNoCustodyBody:
      "Help Rebuild Nepal does not collect, store, transport or own any items. It records who needs what and who can supply it. The two parties arrange the handover directly, just as money goes to the Prime Minister Disaster Relief Fund rather than to us.",
    reliefWhyNeedsFirstTitle: "Why requests come first",
    reliefWhyNeedsFirstBody:
      "Supplies nobody asked for fill warehouses, block roads and absorb volunteers needed elsewhere. Tying every offer to a verified request prevents that. Used clothing and expired goods are never accepted.",
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
      "Your offer has been received. A verifier will match it against a published request before anyone acts on it.",
    reliefSubmitOffer: "Submit offer for review",
    reliefFilterAll: "All items",
    reliefConsent:
      "I confirm these items are new or unused unless stated otherwise, that I have not dispatched them, and that I will wait to be contacted before sending anything.",
    submitError: "Something went wrong and this was not submitted. Please try again in a moment.",
    submitSuccessVolunteer: "You're registered. A verifier will review your details before you're matched to anything.",
    submitSuccessNeed: "Your request has been received and will be reviewed before it appears on the board.",

    // Overrides the generated footerNote, which still said the forms were not
    // connected. They have persisted to the database since the backend
    // shipped, and telling people otherwise both loses registrations and
    // misleads them about what is being stored.
    footerNote:
      "Submissions are stored securely and reviewed by a person before anything is published.",

    // The lockup line from the project's own infographic. Replaced "Verified
    // needs, matched to people who can help", which wrapped to five lines in
    // the header's narrow column.
    headerTagline: "Volunteer. Connect. Rebuild.",

    // Overrides the generated LOOP_WORDS. Every word here must map to a real
    // "Primary skill" option, or the headline invites people the form has
    // nowhere to put: "surveyors" did exactly that, so it became "architects".
    loopWords: [
      "engineers",
      "architects",
      "nurses",
      "translators",
      "drivers",
      "coordinators",
      "electricians",
      "teachers",
    ],

    thanksVolunteerTitle: "You're registered",
    thanksVolunteerBody:
      "Your details are with the coordination team. A verifier reviews every registration before anyone is matched to work, so there is nothing more for you to do right now.",
    thanksNeedTitle: "Your request has been received",
    thanksNeedBody:
      "A verifier will check the details before your request appears on the public board. This is what stops unverified requests pulling volunteers away from real ones.",
    thanksOfferTitle: "Your offer has been received",
    thanksOfferBody:
      "A verifier will match your offer against a published request before anyone acts on it. Please do not dispatch anything until you have been contacted.",
    thanksNextTitle: "What happens next",
    thanksReference: "Your reference",
    thanksReferenceNote:
      "Quote this if you contact the team about this submission. You do not need to keep it otherwise.",
    thanksBrowseNeeds: "See what is needed now",
    thanksHome: "Back to home",
    thanksNoDuplicate:
      "There is no need to submit the form again — doing so creates a second record for the team to reconcile.",

    needsPeopleNeeded: "people needed",
    needsCountOne: "1 verified request",
    needsCountMany: "verified requests",
    needsClearFilters: "Clear filters",
    needsCommunityReported: "Community-reported",
    needsViewNeed: "View request",
    interestTitle: "Express interest",
    interestIntro:
      "The requester contacts you. Nothing is shared with anyone else, and this is not a commitment.",
    interestName: "Your name",
    interestContact: "Phone or email",
    interestContactHint: "Only the requester and the verification team see this.",
    interestMessage: "Anything they should know (optional)",
    interestMessageHint: "Relevant experience, when you could start, what you can bring.",
    interestSubmit: "Send to the requester",
    interestSending: "Sending…",
    interestSuccess:
      "Your interest has been recorded. The requester will be in touch — you do not need to do anything else.",
    interestError: "That did not send. Please try again in a moment.",
    interestCount: "people have expressed interest",
    interestCountOne: "1 person has expressed interest",
    networksMembers: "members",
    networksEmpty: "No one has registered with this skill yet.",
    projectsCoordinator: "Coordinator",
    projectsNoCoordinator: "Not yet assigned",

    profileSignedOutTitle: "Your volunteer profile",
    profileSignedOutBody:
      "Sign in to follow your registration through review, see the details you submitted, and keep track of the needs you have offered to help with.",
    profileSignIn: "Sign in",
    profileNotRegistered: "Not registered yet?",
    profileNoRegTitle: "No registration is linked to this account",
    profileNoRegBody:
      "You are signed in, but no volunteer registration is linked to this account yet. If you registered before accounts existed, your registration is still safe with the coordination team. To start a new one, use the volunteer form.",
    profileSignedInAs: "Signed in as",
    profileStatusTitle: "Verification status",
    profileStatusNote:
      "Every registration is reviewed by a person. Once yours is verified you can be matched to work, and the team contacts you when that happens.",
    profileStatusRejected: "Rejected",
    profileRejectedNote:
      "This registration was not approved. If you believe that is a mistake, you can register again with more detail.",
    profileRegisteredOn: "Registered",
    profileVerifiedOn: "Verified",
    profileInterestsTitle: "Needs you have offered to help with",
    profileInterestsEmpty: "You have not expressed interest in any needs yet.",
    trackerNoOrigins: "No one has registered yet, so there is nowhere to show.",
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
    sectionFilled: "मा प्रविष्टि छ",

    reliefNav: "राहत सामग्री",
    reliefTitle: "राहत सामग्री",
    reliefIntro:
      "सामग्रीका प्रमाणित अनुरोध: के चाहिन्छ, कति, कहाँ र कहिलेसम्म। समूहले प्रमाणित अनुरोधमै प्रतिबद्धता जनाउँछन्, ताकि पुग्ने सामान माग गरिएकै होस्।",
    reliefEmptyTitle: "अझै कुनै सामग्री अनुरोध प्रमाणित भएको छैन",
    reliefEmptyBody:
      "प्रमाणित अनुरोध परिमाण र म्यादसहित यहाँ देखिनेछन्। नदेखिँदासम्म तपाईंले ओसार्न सक्ने सामान र काम गर्ने क्षेत्र दर्ता गर्नुहोस्।",
    reliefSeeExample: "नमुना अनुरोध हेर्नुहोस्",
    reliefBackToBoard: "← सबै राहत सामग्रीमा फर्कनु",
    reliefOfferCta: "सामग्री दिनुहोस्",
    reliefOfferTitle: "राहत सामग्री दिनुहोस्",
    reliefOfferIntro:
      "तपाईंले पूरा गर्न सक्ने अनुरोध छान्नुहोस्। प्रमाणित अनुरोधसँग जोडिएको सहयोग नै पुग्छ, र नचाहिने सामान थुप्रिनबाट जोगिन्छ।",
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
    reliefNoCustodyTitle: "हामी तपाईंको सामान लिँदैनौं",
    reliefNoCustodyBody:
      "हेल्प रिबिल्ड नेपालले कुनै पनि सामग्री सङ्कलन, भण्डारण, ढुवानी वा स्वामित्व लिँदैन। कसलाई के चाहिएको छ र कसले दिन सक्छ भन्ने अभिलेख मात्र राख्छ। हस्तान्तरण दुवै पक्षले सिधै मिलाउँछन्, जसरी आर्थिक सहयोग हामीकहाँ नभई प्रधानमन्त्री विपद् राहत कोषमा जान्छ।",
    reliefWhyNeedsFirstTitle: "किन अनुरोध पहिले",
    reliefWhyNeedsFirstBody:
      "कसैले नमागेको सामानले गोदाम भरिन्छ, बाटो रोक्छ र अन्यत्र चाहिने स्वयंसेवक अल्झाउँछ। हरेक सहयोगलाई प्रमाणित अनुरोधसँग जोड्नुले त्यो रोक्छ। प्रयोग गरिएको लुगा र म्याद सकिएको सामान कहिल्यै लिइँदैन।",
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
      "तपाईंको सहयोग प्राप्त भयो। कोही कारबाही गर्नुअघि प्रमाणकले यसलाई प्रकाशित अनुरोधसँग मिलाउनेछ।",
    reliefSubmitOffer: "समीक्षाका लागि पेश गर्नुहोस्",
    reliefFilterAll: "सबै सामग्री",
    reliefConsent:
      "म पुष्टि गर्दछु कि अन्यथा उल्लेख नगरिएसम्म यी सामान नयाँ वा प्रयोग नगरिएका हुन्, मैले कतै पठाएको छैन, र पठाउनुअघि सम्पर्क आउने प्रतीक्षा गर्नेछु।",
    submitError: "केही गडबड भयो, यो पेश भएन। कृपया केही बेरमा फेरि प्रयास गर्नुहोस्।",
    submitSuccessVolunteer: "तपाईं दर्ता हुनुभयो। मिलान हुनुअघि प्रमाणकले तपाईंको विवरण समीक्षा गर्नेछ।",
    submitSuccessNeed: "तपाईंको अनुरोध प्राप्त भयो र बोर्डमा देखिनुअघि समीक्षा हुनेछ।",

    footerNote:
      "पेश गरिएको विवरण सुरक्षित रूपमा राखिन्छ र प्रकाशित हुनुअघि व्यक्तिले समीक्षा गर्छ।",

    headerTagline: "स्वयंसेवा। जोड्नुहोस्। पुनर्निर्माण।",

    loopWords: [
      "इन्जिनियर",
      "आर्किटेक्ट",
      "नर्स",
      "अनुवादक",
      "चालक",
      "संयोजक",
      "इलेक्ट्रिसियन",
      "शिक्षक",
    ],

    thanksVolunteerTitle: "तपाईं दर्ता हुनुभयो",
    thanksVolunteerBody:
      "तपाईंको विवरण समन्वय टोलीसँग पुग्यो। कसैलाई काममा मिलाउनुअघि प्रमाणकले हरेक दर्ता समीक्षा गर्छ, त्यसैले अहिले तपाईंले अरू केही गर्नुपर्दैन।",
    thanksNeedTitle: "तपाईंको अनुरोध प्राप्त भयो",
    thanksNeedBody:
      "सार्वजनिक बोर्डमा देखिनुअघि प्रमाणकले विवरण जाँच्नेछ। यसैले प्रमाणित नभएका अनुरोधले वास्तविक अनुरोधबाट स्वयंसेवक तान्न पाउँदैनन्।",
    thanksOfferTitle: "तपाईंको सहयोग प्राप्त भयो",
    thanksOfferBody:
      "कोही कारबाही गर्नुअघि प्रमाणकले तपाईंको सहयोगलाई प्रकाशित अनुरोधसँग मिलाउनेछ। सम्पर्क नआएसम्म कृपया कुनै सामान नपठाउनुहोस्।",
    thanksNextTitle: "अब के हुन्छ",
    thanksReference: "तपाईंको सन्दर्भ",
    thanksReferenceNote:
      "यस विषयमा टोलीलाई सम्पर्क गर्नुभयो भने यो उल्लेख गर्नुहोस्। अन्यथा राख्नु आवश्यक छैन।",
    thanksBrowseNeeds: "अहिले के चाहिएको छ हेर्नुहोस्",
    thanksHome: "गृहपृष्ठमा फर्कनुहोस्",
    thanksNoDuplicate:
      "फारम फेरि पेश गर्नु आवश्यक छैन — त्यसो गर्दा टोलीले मिलाउनुपर्ने दोस्रो अभिलेख बन्छ।",

    needsPeopleNeeded: "जना चाहिन्छ",
    needsCountOne: "१ प्रमाणित अनुरोध",
    needsCountMany: "प्रमाणित अनुरोध",
    needsClearFilters: "फिल्टर हटाउनुहोस्",
    needsCommunityReported: "समुदायबाट रिपोर्ट गरिएको",
    needsViewNeed: "अनुरोध हेर्नुहोस्",
    interestTitle: "इच्छा जनाउनुहोस्",
    interestIntro:
      "अनुरोधकर्ताले तपाईंलाई सम्पर्क गर्नेछ। अरू कसैलाई देखाइँदैन, र यो प्रतिबद्धता होइन।",
    interestName: "तपाईंको नाम",
    interestContact: "फोन वा इमेल",
    interestContactHint: "अनुरोधकर्ता र प्रमाणीकरण टोलीले मात्र देख्छन्।",
    interestMessage: "थाहा दिनुपर्ने कुरा (वैकल्पिक)",
    interestMessageHint: "सम्बन्धित अनुभव, कहिलेदेखि सुरु गर्न सक्नुहुन्छ, के ल्याउन सक्नुहुन्छ।",
    interestSubmit: "अनुरोधकर्तालाई पठाउनुहोस्",
    interestSending: "पठाउँदै…",
    interestSuccess:
      "तपाईंको इच्छा अभिलेख भयो। अनुरोधकर्ताले सम्पर्क गर्नेछ — तपाईंले अरू केही गर्नुपर्दैन।",
    interestError: "पठाउन सकिएन। कृपया केही बेरमा फेरि प्रयास गर्नुहोस्।",
    interestCount: "जनाले इच्छा जनाएका छन्",
    interestCountOne: "१ जनाले इच्छा जनाएका छन्",
    networksMembers: "सदस्य",
    networksEmpty: "यो सीपमा अझै कसैले दर्ता गरेको छैन।",
    projectsCoordinator: "संयोजक",
    projectsNoCoordinator: "अझै तोकिएको छैन",

    profileSignedOutTitle: "तपाईंको स्वयंसेवक प्रोफाइल",
    profileSignedOutBody:
      "साइन इन गरेर आफ्नो दर्ता समीक्षाका क्रममा कहाँ पुग्यो हेर्नुहोस्, पेश गरेको विवरण हेर्नुहोस्, र आफूले सहयोग गर्न इच्छा जनाएका आवश्यकताको जानकारी राख्नुहोस्।",
    profileSignIn: "साइन इन गर्नुहोस्",
    profileNotRegistered: "अझै दर्ता गर्नुभएको छैन?",
    profileNoRegTitle: "यो खातासँग कुनै दर्ता जोडिएको छैन",
    profileNoRegBody:
      "तपाईं साइन इन हुनुहुन्छ, तर यो खातासँग अझै कुनै स्वयंसेवक दर्ता जोडिएको छैन। खाता बन्नुअघि दर्ता गर्नुभएको भए तपाईंको दर्ता समन्वय टोलीसँग सुरक्षित छ। नयाँ दर्ता सुरु गर्न स्वयंसेवक फारम प्रयोग गर्नुहोस्।",
    profileSignedInAs: "साइन इन गरिएको खाता:",
    profileStatusTitle: "प्रमाणीकरण स्थिति",
    profileStatusNote:
      "हरेक दर्ता व्यक्तिले समीक्षा गर्छ। तपाईंको दर्ता प्रमाणित भएपछि काममा मिलाउन सकिन्छ, र त्यसो हुँदा टोलीले तपाईंलाई सम्पर्क गर्छ।",
    profileStatusRejected: "अस्वीकृत",
    profileRejectedNote:
      "यो दर्ता स्वीकृत भएन। भूल भएको लाग्छ भने थप विवरणसहित फेरि दर्ता गर्न सक्नुहुन्छ।",
    profileRegisteredOn: "दर्ता भएको",
    profileVerifiedOn: "प्रमाणित भएको",
    profileInterestsTitle: "तपाईंले सहयोगका लागि इच्छा जनाएका आवश्यकता",
    profileInterestsEmpty: "तपाईंले अझै कुनै आवश्यकतामा इच्छा जनाउनुभएको छैन।",
    trackerNoOrigins: "अझै कसैले दर्ता गरेको छैन, त्यसैले देखाउने ठाउँ छैन।",
  },
};

export function added(lang: Lang): AddedStrings {
  return ADDED[lang];
}
