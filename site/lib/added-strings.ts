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
  formRemoteVolunteer: string;
  formRemoteNeed: string;
  formVolunteerIntro: string;
  formNeedIntro: string;
  formConsentLabel: string;
  needsSortBy: string;
  needsAscending: string;
  needsDescending: string;
  needsNewest: string;
  needsWorkMode: string;
  needsTiming: string;
  needsPeople: string;
  needsConfirmed: string;

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
  navGetInvolved: string;
  navProgress: string;
  navMenu: string;
  navMain: string;
  navLanguage: string;
  navHome: string;
  navSkillNetworks: string;
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
  networkMemberBadge: string;
  networkJoining: string;
  networkJoinToast: string;
  networkJoinError: string;
  networkSignInToJoin: string;
  networkSignInLink: string;
  projectsCoordinator: string;
  projectsNoCoordinator: string;
  projectsLead: string;
  projectsMilestones: string;
  projectsLatestUpdate: string;
  projectsNoUpdate: string;
  projectsOutcome: string;
  projectsOutcomeConfirmed: string;
  projectsOutcomeUnconfirmed: string;
  projectsHouseholds: string;
  reliefReceived: string;
  reliefArranged: string;
  reliefStillNeeded: string;
  reliefClosed: string;
  reliefClosedBody: string;
  reliefDeliveryWindow: string;
  reliefDeliveryAddress: string;
  reliefNothingArrived: string;

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

  claimTitle: string;
  claimIntro: string;
  claimEmail: string;
  claimEmailHint: string;
  claimPassword: string;
  claimPasswordHint: string;
  claimConfirmPassword: string;
  claimSubmit: string;
  claimSubmitting: string;
  claimPasswordTooShort: string;
  claimPasswordMismatch: string;
  claimEmailMismatch: string;
  claimUnavailable: string;
  claimAlreadyUsed: string;
  claimAccountExists: string;
  claimError: string;
  claimCreatedSignInFailed: string;
  claimLoginLink: string;
  loginTitle: string;
  loginIntro: string;
  loginEmail: string;
  loginPassword: string;
  loginSubmit: string;
  loginSubmitting: string;
  loginError: string;
  loginNoAccount: string;
  loginRegister: string;

  /** Field-level validation, keyed to the codes in lib/intake-schema.ts. */
  errorSummaryTitle: string;
  errRequired: string;
  errTooLong: string;
  errTooShort: string;
  errInvalidEmail: string;
  errInvalidPhone: string;
  errInvalidDate: string;
  errInvalidOption: string;
  errInvalidNumber: string;
  errConsent: string;

  /** The panel shown when a submission saved but an attachment did not. */
  attachTitle: string;
  attachIntro: string;
  attachRetry: string;
  attachRetrying: string;
  attachContinue: string;
  attachUploaded: string;
  attachFailed: string;

  /** The two-step, mailbox-verified account claim. */
  claimCodeStepTitle: string;
  claimCodeSent: string;
  claimCodeLabel: string;
  claimCodeHint: string;
  claimSendCode: string;
  claimSendingCode: string;
  claimCodeInvalid: string;
  claimStartHint: string;
  claimUseAnotherEmail: string;
  recoverTitle: string;
  recoverIntro: string;
  recoverSubmit: string;
  recoverSubmitting: string;
  recoverSent: string;
  recoverLink: string;

  /**
   * States that must never be shown as a zero or as an invented value.
   * See lib/publication.ts for why these three are kept apart.
   */
  boardUnavailable: string;
  boardUnavailableTitle: string;
  boardUnavailableCount: string;
  boardLastUpdated: string;
  valueNotSpecified: string;
  valueNotCollected: string;
  needClosedTitle: string;
  needClosedBody: string;

  /** Mission teams (migration 013). */
  missionsNav: string;
  missionsTitle: string;
  missionsIntro: string;
  missionsPickLimit: string;
  missionsSelected: string;
  missionJoin: string;
  missionLeave: string;
  missionOpen: string;
  missionMembers: string;
  missionLead: string;
  missionNextCheckIn: string;
  missionPurpose: string;
  missionCurrentTask: string;
  missionNotSetYet: string;
  missionOnlyLabel: string;
  missionOnlyHint: string;
  missionRegisterFirst: string;
  missionSignInToJoin: string;
  missionBack: string;
  missionCapReached: string;
  missionSourceEmail: string;
  missionSourceAdmin: string;
  missionPaused: string;
  missionClosed: string;
  missionYourMissions: string;
  missionNoneChosen: string;
  missionSaveScope: string;
  missionsUnavailable: string;

  /** The volunteer workspace (Phase 2.1). */
  profileUnavailableTitle: string;
  profileUnavailableBody: string;
  readyTitle: string;
  readyYes: string;
  readyPausedNote: string;
  readyMissingTitle: string;
  readyFixMatching: string;
  readyFixRegistration: string;
  readyFixCoordinator: string;
  wsInvitationsTitle: string;
  wsInvitationsEmpty: string;
  wsInvitationExpires: string;
  wsInvitationLapsed: string;
  wsInvitationAccepted: string;
  wsInvitationWaiting: string;
  wsCommitmentsTitle: string;
  wsCommitmentsEmpty: string;
  wsCommittedHours: string;

  /** The three-step need intake (Phase 3.1). */
  n3StepNeed: string;
  n3StepContact: string;
  n3StepReview: string;
  n3Intro: string;
  n3Type: string;
  n3TypeHint: string;
  n3Title: string;
  n3TitleHint: string;
  n3Detail: string;
  n3DetailHint: string;
  n3District: string;
  n3Municipality: string;
  n3MunicipalityHint: string;
  n3WorkMode: string;
  n3Urgency: string;
  n3Organization: string;
  n3OrganizationHint: string;
  n3Person: string;
  n3Email: string;
  n3Phone: string;
  n3ContactHint: string;
  n3Photos: string;
  n3Consent: string;
  n3ReviewTitle: string;
  n3ReviewIntro: string;
  n3NotAnswered: string;
  n3Back: string;
  n3Next: string;
  n3Submit: string;
  n3SaveDraft: string;
  n3DraftSaved: string;
  n3DraftFound: string;
  n3DraftRestore: string;
  n3DraftDiscard: string;
  n3AssistTitle: string;
  n3AssistBody: string;
  n3AssistCta: string;
  n3AssistBack: string;
  n3AssistSubmit: string;
  n3AssistConsent: string;
  n3RoleNote: string;

  /** The requester workspace (Phase 3.2). */
  rqNav: string;
  rqTitle: string;
  rqIntro: string;
  rqSignedOut: string;
  rqSignIn: string;
  rqNoRequest: string;
  rqNoRequestBody: string;
  rqUnavailable: string;
  rqReference: string;
  rqStatus: string;
  rqCoordinator: string;
  rqNoCoordinator: string;
  rqFiledOn: string;
  rqAssisted: string;
  rqEditTitle: string;
  rqEditWarning: string;
  rqEditSave: string;
  rqSummaryLabel: string;
  rqDetailLabel: string;
  rqProposedTitle: string;
  rqProposedEmpty: string;
  rqProposedNote: string;
  rqConfirm: string;
  rqDecline: string;
  rqOutcomeTitle: string;
  rqOutcomeIntro: string;
  rqOutcomeYes: string;
  rqOutcomePartly: string;
  rqOutcomeNo: string;
  rqOutcomeNote: string;
  rqOutcomeSave: string;
  rqCloseTitle: string;
  rqCloseBody: string;
  rqCloseReason: string;
  rqClose: string;
  rqReopen: string;
  rqReopenBody: string;
  rqHistoryTitle: string;
  rqHistoryEmpty: string;
  rqClaimTitle: string;
  rqClaimIntro: string;
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
    formRemoteVolunteer: "Remote work selected. Travel and deployment questions are hidden. You can still offer equipment, resources or logistics support.",
    formRemoteNeed: "Remote work selected. On-site accommodation, food, transport and equipment questions are hidden. Keep the location of the community receiving support.",
    formVolunteerIntro: "Share your skills and availability so the coordination team can find suitable requests. Your name, email, phone number and consent are required; other details are optional.",
    formNeedIntro: "Describe the task and who it will help. The coordination team reviews your request before it appears on the needs board.",
    formConsentLabel: "Consent",
    needsSortBy: "Sort by",
    needsAscending: "Ascending",
    needsDescending: "Descending",
    needsNewest: "Date posted",
    needsWorkMode: "Work mode",
    needsTiming: "Start / duration",
    needsPeople: "People needed",
    needsConfirmed: "confirmed",

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
      "We never collect, store or transport anything. We record who needs what and who can supply it — you arrange the handover directly.",
    reliefWhyNeedsFirstTitle: "Why requests come first",
    reliefWhyNeedsFirstBody:
      "Unrequested supplies clog warehouses and roads. Every offer must match a verified request. No used clothing or expired goods.",
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
    navGetInvolved: "Get involved",
    navProgress: "Our progress",
    navMenu: "Menu",
    navMain: "Main navigation",
    navLanguage: "Language",
    navHome: "Help Rebuild Nepal home",
    navSkillNetworks: "Skill networks",

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
    networkMemberBadge: "You're a member",
    networkJoining: "Joining…",
    networkJoinToast:
      "You've joined. The coordination team sees network members first when assembling teams.",
    networkJoinError: "That did not work. Please try again in a moment.",
    networkSignInToJoin: "Already registered?",
    networkSignInLink: "Sign in to join with one click",
    projectsCoordinator: "Coordinator",
    projectsNoCoordinator: "Not yet assigned",
    projectsLead: "Lead",
    projectsMilestones: "Milestones",
    projectsLatestUpdate: "Latest update",
    projectsNoUpdate: "No update posted yet",
    projectsOutcome: "What came of it",
    projectsOutcomeConfirmed: "Confirmed by the organisation that asked",
    projectsOutcomeUnconfirmed: "Not yet confirmed by the requester",
    projectsHouseholds: "Households reached",
    reliefReceived: "Received",
    reliefArranged: "Arranged",
    reliefStillNeeded: "Still needed",
    reliefClosed: "This request is closed",
    reliefClosedBody:
      "It is not taking new offers. The record stays here so what happened is still readable.",
    reliefDeliveryWindow: "Deliveries accepted",
    reliefDeliveryAddress: "Deliver to",
    reliefNothingArrived: "Nothing has arrived yet",

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

    claimTitle: "Manage your registration",
    claimIntro:
      "Set a password now to return to this registration later. Your registration is already saved, and creating an account is optional.",
    claimEmail: "Email",
    claimEmailHint: "Use the same email address you entered in the volunteer form.",
    claimPassword: "Password",
    claimPasswordHint: "Use at least 10 characters.",
    claimConfirmPassword: "Repeat password",
    claimSubmit: "Set password and continue",
    claimSubmitting: "Creating account…",
    claimPasswordTooShort: "Use at least 10 characters for your password.",
    claimPasswordMismatch: "The two passwords do not match.",
    claimEmailMismatch: "That email does not match this volunteer registration.",
    claimUnavailable: "This registration can no longer be used to create an account.",
    claimAlreadyUsed: "An account has already been created for this registration.",
    claimAccountExists: "That email already has an account. Sign in instead.",
    claimError: "The account could not be created. Please try again in a moment.",
    claimCreatedSignInFailed:
      "Your account was created, but we could not sign you in automatically. Sign in with the password you just chose.",
    claimLoginLink: "Sign in",
    loginTitle: "Volunteer sign in",
    loginIntro: "Sign in to see the registration you linked to your account.",
    loginEmail: "Email",
    loginPassword: "Password",
    loginSubmit: "Sign in",
    loginSubmitting: "Signing in…",
    loginError: "Incorrect email or password.",
    loginNoAccount: "Not registered yet?",
    loginRegister: "Register as a volunteer",

    errorSummaryTitle: "Please check these answers before submitting",
    errRequired: "This answer is required.",
    errTooLong: "This answer is too long.",
    errTooShort: "This answer is too short.",
    errInvalidEmail: "Enter a valid email address.",
    errInvalidPhone: "Enter a valid phone number.",
    errInvalidDate: "Enter a date as YYYY-MM-DD.",
    errInvalidOption: "Choose one of the offered answers.",
    errInvalidNumber: "Enter a number above zero.",
    errConsent: "Please tick the consent box to continue.",

    attachTitle: "Your request was saved. Some files were not attached.",
    attachIntro:
      "You do not need to fill the form in again. Retry the files below, or continue without them and send them to us later.",
    attachRetry: "Retry these files",
    attachRetrying: "Retrying…",
    attachContinue: "Continue without them",
    attachUploaded: "Attached",
    attachFailed: "Not attached",

    claimCodeStepTitle: "Enter the code we sent you",
    claimCodeSent:
      "If that email matches this registration, a six-digit code is on its way. It expires shortly.",
    claimCodeLabel: "Six-digit code",
    claimCodeHint: "Check the mailbox for the address on your registration.",
    claimSendCode: "Send me a code",
    claimSendingCode: "Sending…",
    claimCodeInvalid: "That code is not right, or it has expired. Request a new one.",
    claimStartHint:
      "We will email a code to confirm the mailbox is yours before linking your registration.",
    claimUseAnotherEmail: "Use a different email",
    recoverTitle: "Reset your password",
    recoverIntro: "We will email a link to set a new password.",
    recoverSubmit: "Send reset link",
    recoverSubmitting: "Sending…",
    recoverSent: "If that email has an account, a reset link is on its way.",
    recoverLink: "Forgotten your password?",

    boardUnavailable:
      "We could not load the requests just now. This is a problem at our end, not an empty board — please try again shortly.",
    boardUnavailableTitle: "Requests are unavailable",
    boardUnavailableCount: "Count unavailable",
    boardLastUpdated: "Updated",
    valueNotSpecified: "Not specified",
    valueNotCollected: "Not collected",
    needClosedTitle: "This request is no longer taking offers of help",
    needClosedBody:
      "It has been filled or completed. The board lists requests that still need people.",

    missionsNav: "Missions",
    missionsTitle: "Mission teams",
    missionsIntro:
      "Small teams with a shared purpose. Choosing a mission tells us where you would like to help — you stay eligible for other suitable work unless you say otherwise.",
    missionsPickLimit: "Choose up to two. The order you pick them in does not matter.",
    missionsSelected: "of 2 chosen",
    missionJoin: "Join mission",
    missionLeave: "Leave mission",
    missionOpen: "Open team",
    missionMembers: "members",
    missionLead: "Team lead",
    missionNextCheckIn: "Next check-in",
    missionPurpose: "Purpose",
    missionCurrentTask: "Current task",
    missionNotSetYet: "Not set yet — a coordinator will add this.",
    missionOnlyLabel: "Only invite me to needs within my missions",
    missionOnlyHint:
      "Off by default. Leave it off to stay part of the wider Help Rebuild Nepal network, and change it whenever you like.",
    missionRegisterFirst: "Register as a volunteer to choose a mission.",
    missionSignInToJoin: "Already registered? Sign in to choose your missions.",
    missionBack: "All missions",
    missionCapReached: "You have chosen two missions. Leave one to choose another.",
    missionSourceEmail: "Recorded from your email reply",
    missionSourceAdmin: "Recorded by a coordinator",
    missionPaused: "This team is paused",
    missionClosed: "This team has finished its work",
    missionYourMissions: "Your missions",
    missionNoneChosen: "You have not chosen a mission yet.",
    missionSaveScope: "Save this preference",
    missionsUnavailable:
      "Mission teams could not be loaded just now. This is a problem at our end — please try again shortly.",

    profileUnavailableTitle: "We could not load your registration",
    profileUnavailableBody:
      "This is a problem at our end, not a sign that your registration is missing. Please try again shortly — do not fill the form in again, or you will end up with two records.",
    readyTitle: "Ready for invitations",
    readyYes: "Your details are complete. A coordinator can invite you to suitable work.",
    readyPausedNote:
      "You have paused invitations. Nothing will be sent until you turn them back on.",
    readyMissingTitle: "Still needed before you can be invited",
    readyFixMatching: "Add this in your matching details above.",
    readyFixRegistration: "Contact us to update this on your registration.",
    readyFixCoordinator: "A coordinator will do this — nothing for you to fix.",
    wsInvitationsTitle: "Open invitations",
    wsInvitationsEmpty: "No open invitations. You will be emailed if a suitable role comes up.",
    wsInvitationExpires: "Respond by",
    wsInvitationLapsed: "This response window has closed",
    wsInvitationAccepted: "You said yes — waiting on the requester",
    wsInvitationWaiting: "Awaiting your response",
    wsCommitmentsTitle: "Current commitments",
    wsCommitmentsEmpty: "No confirmed commitments yet.",
    wsCommittedHours: "hours a week promised at your busiest overlap",

    n3StepNeed: "What you need",
    n3StepContact: "How to reach you",
    n3StepReview: "Check and send",
    n3Intro:
      "Three short steps. A coordinator works out the detail with you afterwards — you do not need to have it all figured out now.",
    n3Type: "What kind of support?",
    n3TypeHint: "Pick the closest. We will sort out the detail with you.",
    n3Title: "In one line, what do you need?",
    n3TitleHint: "This is what people see on the board. Plain words are best.",
    n3Detail: "Describe what needs to happen",
    n3DetailHint:
      "What is the situation, and what would help? A few sentences is enough.",
    n3District: "District",
    n3Municipality: "Municipality or ward",
    n3MunicipalityHint: "Optional. Helps a volunteer judge the journey.",
    n3WorkMode: "Where does the work happen?",
    n3Urgency: "How soon do you need this?",
    n3Organization: "Your name or organization",
    n3OrganizationHint: "Whichever you are asking on behalf of.",
    n3Person: "Contact person",
    n3Email: "Email",
    n3Phone: "Phone or WhatsApp",
    n3ContactHint: "Give at least one. We never publish either of them.",
    n3Photos: "Photographs or documents",
    n3Consent:
      "I confirm this request is genuine and that I may make it on behalf of the people named above.",
    n3ReviewTitle: "Check this over",
    n3ReviewIntro: "Nothing is sent until you press the button. You can go back and change anything.",
    n3NotAnswered: "Not answered",
    n3Back: "Back",
    n3Next: "Continue",
    n3Submit: "Send this request",
    n3SaveDraft: "Save a draft on this device",
    n3DraftSaved: "Draft saved on this device. It is not sent to us.",
    n3DraftFound: "You have an unfinished request saved on this device.",
    n3DraftRestore: "Pick up where you left off",
    n3DraftDiscard: "Start fresh",
    n3AssistTitle: "Would you rather we called you?",
    n3AssistBody:
      "Give a name and a number and a coordinator will ring you and fill this in with you. Nothing else is needed now.",
    n3AssistCta: "Ask us to call instead",
    n3AssistBack: "Fill in the form myself",
    n3AssistSubmit: "Ask for a call",
    n3AssistConsent: "I agree to be contacted about this request.",
    n3RoleNote:
      "Skills, headcount and dates are worked out with a coordinator once your request is verified.",

    rqNav: "My request",
    rqTitle: "Your request",
    rqIntro: "Where it has got to, and what you can change.",
    rqSignedOut: "Sign in with the email on your request to see it.",
    rqSignIn: "Sign in",
    rqNoRequest: "No request is linked to this account",
    rqNoRequestBody:
      "If you filed one, use the link on your confirmation page to link it to this account.",
    rqUnavailable:
      "We could not load your request just now. This is a problem at our end, not a sign it is missing — please try again shortly, and do not file it again.",
    rqReference: "Reference",
    rqStatus: "Status",
    rqCoordinator: "Your coordinator",
    rqNoCoordinator: "Not assigned yet",
    rqFiledOn: "Filed on",
    rqAssisted: "You asked us to call you about this",
    rqEditTitle: "Correct your request",
    rqEditWarning:
      "Changing what the work is will cancel any invitations already sent, so a coordinator can check them against the new description. Fixing the one-line summary alone does not.",
    rqEditSave: "Save changes",
    rqSummaryLabel: "One-line summary",
    rqDetailLabel: "What needs to happen",
    rqProposedTitle: "People being found for you",
    rqProposedEmpty: "Nobody has been approached yet. A coordinator does this once your request is verified.",
    rqProposedNote:
      "Names and contact details are shared only once both sides agree, so you see roles here rather than people.",
    rqConfirm: "Go ahead with this",
    rqDecline: "Not this one",
    rqOutcomeTitle: "Did the support help?",
    rqOutcomeIntro:
      "This is the only way we learn whether any of this worked. It is read by a coordinator, not published.",
    rqOutcomeYes: "Yes, the need was met",
    rqOutcomePartly: "Partly",
    rqOutcomeNo: "No",
    rqOutcomeNote: "Anything you want to add",
    rqOutcomeSave: "Send this",
    rqCloseTitle: "Close this request",
    rqCloseBody:
      "Close it if the problem is solved, however it was solved. You can reopen it afterwards.",
    rqCloseReason: "Why are you closing it? (optional)",
    rqClose: "Close the request",
    rqReopen: "Reopen the request",
    rqReopenBody: "This request is closed. Reopening sends it back for review.",
    rqHistoryTitle: "What has happened",
    rqHistoryEmpty: "Nothing recorded yet.",
    rqClaimTitle: "Link your request to this account",
    rqClaimIntro:
      "Enter the email address on your request and we will send a code to confirm it is yours.",
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
    formRemoteVolunteer: "दूरबाट काम गर्ने विकल्प छानिएको छ। यात्रा र स्थलगत परिचालनका प्रश्नहरू लुकाइएका छन्। तपाईंले अझै उपकरण, स्रोतसाधन वा व्यवस्थापन सहयोग दिन सक्नुहुन्छ।",
    formRemoteNeed: "दूरबाट काम गर्ने विकल्प छानिएको छ। स्थलगत बसोबास, खाना, यातायात र उपकरणका प्रश्नहरू लुकाइएका छन्। सहयोग पाउने समुदायको स्थान भने उल्लेख गर्नुहोस्।",
    formVolunteerIntro: "समन्वय टोलीले उपयुक्त अनुरोध खोज्न सकोस् भनेर आफ्नो सीप र उपलब्धता बताउनुहोस्। नाम, इमेल, फोन नम्बर र सहमति अनिवार्य छन्; अन्य विवरण वैकल्पिक हुन्।",
    formNeedIntro: "गर्नुपर्ने काम र त्यसले कसलाई सहयोग गर्छ बताउनुहोस्। आवश्यकता सूचीमा देखिनुअघि समन्वय टोलीले तपाईंको अनुरोध समीक्षा गर्छ।",
    formConsentLabel: "सहमति",
    needsSortBy: "क्रम मिलाउनुहोस्",
    needsAscending: "बढ्दो क्रममा",
    needsDescending: "घट्दो क्रममा",
    needsNewest: "पोस्ट गरिएको मिति",
    needsWorkMode: "काम गर्ने तरिका",
    needsTiming: "सुरु / अवधि",
    needsPeople: "चाहिने व्यक्ति",
    needsConfirmed: "पुष्टि भएका",

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
      "हामी कुनै सामान सङ्कलन, भण्डारण वा ढुवानी गर्दैनौं। कसलाई के चाहिन्छ र कसले दिन सक्छ भन्ने अभिलेख राख्छौं — हस्तान्तरण तपाईंहरू सिधै मिलाउनुहोस्।",
    reliefWhyNeedsFirstTitle: "किन अनुरोध पहिले",
    reliefWhyNeedsFirstBody:
      "नमागेको सामानले गोदाम र बाटो भरिन्छ। हरेक सहयोग प्रमाणित अनुरोधसँग मिल्नुपर्छ। प्रयोग गरिएको लुगा र म्याद सकिएको सामान लिइँदैन।",
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
    navGetInvolved: "सहभागी हुनुहोस्",
    navProgress: "हाम्रो प्रगति",
    navMenu: "मेनु",
    navMain: "मुख्य नेभिगेसन",
    navLanguage: "भाषा",
    navHome: "हेल्प रिबिल्ड नेपालको गृहपृष्ठ",
    navSkillNetworks: "सीप नेटवर्क",

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
    networkMemberBadge: "तपाईं सदस्य हुनुहुन्छ",
    networkJoining: "जोड्दै…",
    networkJoinToast:
      "तपाईं जोडिनुभयो। टोली बनाउँदा समन्वय टोलीले नेटवर्क सदस्यलाई पहिले हेर्छ।",
    networkJoinError: "जोड्न सकिएन। कृपया केही बेरमा फेरि प्रयास गर्नुहोस्।",
    networkSignInToJoin: "पहिल्यै दर्ता गर्नुभएको छ?",
    networkSignInLink: "एक क्लिकमा जोडिन साइन इन गर्नुहोस्",
    projectsCoordinator: "संयोजक",
    projectsNoCoordinator: "अझै तोकिएको छैन",
    projectsLead: "नेतृत्व",
    projectsMilestones: "मुख्य चरणहरू",
    projectsLatestUpdate: "पछिल्लो अपडेट",
    projectsNoUpdate: "अझै कुनै अपडेट छैन",
    projectsOutcome: "के भयो",
    projectsOutcomeConfirmed: "अनुरोध गर्ने संस्थाबाट पुष्टि भएको",
    projectsOutcomeUnconfirmed: "अनुरोधकर्ताबाट अझै पुष्टि भएको छैन",
    projectsHouseholds: "पुगेका घरधुरी",
    reliefReceived: "प्राप्त",
    reliefArranged: "मिलाइएको",
    reliefStillNeeded: "अझै आवश्यक",
    reliefClosed: "यो अनुरोध बन्द भइसकेको छ",
    reliefClosedBody:
      "यसले नयाँ प्रस्ताव लिँदैन। के भयो भन्ने अभिलेख यहीँ रहन्छ।",
    reliefDeliveryWindow: "डेलिभरी लिइने समय",
    reliefDeliveryAddress: "डेलिभरी ठेगाना",
    reliefNothingArrived: "अझै केही आइपुगेको छैन",

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

    claimTitle: "आफ्नो दर्ता व्यवस्थापन गर्नुहोस्",
    claimIntro:
      "पछि यो दर्ता फेरि हेर्न अहिले पासवर्ड राख्नुहोस्। तपाईंको दर्ता पहिल्यै सुरक्षित भइसकेको छ, र खाता बनाउनु वैकल्पिक हो।",
    claimEmail: "इमेल",
    claimEmailHint: "स्वयंसेवक फारममा लेख्नुभएको उही इमेल ठेगाना प्रयोग गर्नुहोस्।",
    claimPassword: "पासवर्ड",
    claimPasswordHint: "कम्तीमा १० अक्षर प्रयोग गर्नुहोस्।",
    claimConfirmPassword: "पासवर्ड फेरि लेख्नुहोस्",
    claimSubmit: "पासवर्ड राखेर अगाडि बढ्नुहोस्",
    claimSubmitting: "खाता बनाउँदै…",
    claimPasswordTooShort: "पासवर्डमा कम्तीमा १० अक्षर प्रयोग गर्नुहोस्।",
    claimPasswordMismatch: "दुवै पासवर्ड मिलेनन्।",
    claimEmailMismatch: "यो इमेल स्वयंसेवक दर्तासँग मिलेन।",
    claimUnavailable: "यो दर्ताबाट अब खाता बनाउन मिल्दैन।",
    claimAlreadyUsed: "यो दर्ताका लागि खाता पहिल्यै बनिसकेको छ।",
    claimAccountExists: "यो इमेलको खाता पहिल्यै छ। त्यसैबाट साइन इन गर्नुहोस्।",
    claimError: "खाता बनाउन सकिएन। कृपया केही बेरमा फेरि प्रयास गर्नुहोस्।",
    claimCreatedSignInFailed:
      "तपाईंको खाता बन्यो, तर स्वचालित रूपमा साइन इन गर्न सकिएन। भर्खर राखेको पासवर्डले साइन इन गर्नुहोस्।",
    claimLoginLink: "साइन इन गर्नुहोस्",
    loginTitle: "स्वयंसेवक साइन इन",
    loginIntro: "आफ्नो खातासँग जोडिएको दर्ता हेर्न साइन इन गर्नुहोस्।",
    loginEmail: "इमेल",
    loginPassword: "पासवर्ड",
    loginSubmit: "साइन इन गर्नुहोस्",
    loginSubmitting: "साइन इन हुँदै…",
    loginError: "इमेल वा पासवर्ड मिलेन।",
    loginNoAccount: "अझै दर्ता गर्नुभएको छैन?",
    loginRegister: "स्वयंसेवकका रूपमा दर्ता गर्नुहोस्",

    errorSummaryTitle: "पेस गर्नुअघि यी उत्तरहरू जाँच्नुहोस्",
    errRequired: "यो उत्तर आवश्यक छ।",
    errTooLong: "यो उत्तर धेरै लामो भयो।",
    errTooShort: "यो उत्तर धेरै छोटो भयो।",
    errInvalidEmail: "मान्य इमेल ठेगाना लेख्नुहोस्।",
    errInvalidPhone: "मान्य फोन नम्बर लेख्नुहोस्।",
    errInvalidDate: "मिति YYYY-MM-DD ढाँचामा लेख्नुहोस्।",
    errInvalidOption: "दिइएका विकल्पमध्ये एउटा छान्नुहोस्।",
    errInvalidNumber: "शून्यभन्दा माथिको संख्या लेख्नुहोस्।",
    errConsent: "अगाडि बढ्न सहमति बाकसमा चिन्ह लगाउनुहोस्।",

    attachTitle: "तपाईंको अनुरोध सुरक्षित भयो। केही फाइल संलग्न हुन सकेनन्।",
    attachIntro:
      "फारम फेरि भर्नुपर्दैन। तलका फाइल पुनः प्रयास गर्नुहोस्, वा तिनीहरूविना अगाडि बढेर पछि पठाउनुहोस्।",
    attachRetry: "यी फाइल पुनः प्रयास गर्नुहोस्",
    attachRetrying: "पुनः प्रयास हुँदै…",
    attachContinue: "तिनीहरूविना अगाडि बढ्नुहोस्",
    attachUploaded: "संलग्न भयो",
    attachFailed: "संलग्न भएन",

    claimCodeStepTitle: "हामीले पठाएको कोड लेख्नुहोस्",
    claimCodeSent:
      "यदि त्यो इमेल यस दर्तासँग मिल्छ भने छ अङ्कको कोड पठाइँदैछ। यो छिट्टै समाप्त हुन्छ।",
    claimCodeLabel: "छ अङ्कको कोड",
    claimCodeHint: "आफ्नो दर्तामा दिइएको ठेगानाको इमेल हेर्नुहोस्।",
    claimSendCode: "मलाई कोड पठाउनुहोस्",
    claimSendingCode: "पठाउँदै…",
    claimCodeInvalid: "त्यो कोड मिलेन, वा समाप्त भयो। नयाँ कोड माग्नुहोस्।",
    claimStartHint:
      "दर्ता जोड्नुअघि इमेल तपाईंकै हो भनी पुष्टि गर्न हामी कोड पठाउनेछौं।",
    claimUseAnotherEmail: "अर्को इमेल प्रयोग गर्नुहोस्",
    recoverTitle: "पासवर्ड रिसेट गर्नुहोस्",
    recoverIntro: "नयाँ पासवर्ड राख्न हामी लिंक इमेल गर्नेछौं।",
    recoverSubmit: "रिसेट लिंक पठाउनुहोस्",
    recoverSubmitting: "पठाउँदै…",
    recoverSent: "यदि त्यो इमेलको खाता छ भने रिसेट लिंक पठाइँदैछ।",
    recoverLink: "पासवर्ड बिर्सनुभयो?",

    boardUnavailable:
      "अहिले अनुरोधहरू लोड गर्न सकिएन। यो हाम्रो तर्फको समस्या हो, बोर्ड खाली भएको होइन — केही बेरमा फेरि प्रयास गर्नुहोस्।",
    boardUnavailableTitle: "अनुरोधहरू उपलब्ध छैनन्",
    boardUnavailableCount: "गणना उपलब्ध छैन",
    boardLastUpdated: "अद्यावधिक",
    valueNotSpecified: "उल्लेख गरिएको छैन",
    valueNotCollected: "सङ्कलन गरिएको छैन",
    needClosedTitle: "यो अनुरोधले अब सहयोगका प्रस्ताव लिँदैन",
    needClosedBody:
      "यो पूरा भइसक्यो वा सम्पन्न भयो। बोर्डमा अझै मानिस चाहिने अनुरोधहरू देखिन्छन्।",

    missionsNav: "अभियानहरू",
    missionsTitle: "अभियान टोलीहरू",
    missionsIntro:
      "साझा उद्देश्य भएका साना टोलीहरू। अभियान छान्नुले तपाईं कहाँ सहयोग गर्न चाहनुहुन्छ भन्ने जनाउँछ — तपाईंले नभनेसम्म अन्य उपयुक्त कामका लागि पनि योग्य रहनुहुन्छ।",
    missionsPickLimit: "दुईवटासम्म छान्नुहोस्। छान्ने क्रमले केही फरक पार्दैन।",
    missionsSelected: "मध्ये २ छानिएको",
    missionJoin: "अभियानमा सामेल हुनुहोस्",
    missionLeave: "अभियान छाड्नुहोस्",
    missionOpen: "टोली खोल्नुहोस्",
    missionMembers: "सदस्यहरू",
    missionLead: "टोली नेतृत्व",
    missionNextCheckIn: "अर्को भेटघाट",
    missionPurpose: "उद्देश्य",
    missionCurrentTask: "हालको कार्य",
    missionNotSetYet: "अझै तोकिएको छैन — संयोजकले थप्नेछन्।",
    missionOnlyLabel: "मलाई मेरा अभियानभित्रका आवश्यकताका लागि मात्र निम्तो दिनुहोस्",
    missionOnlyHint:
      "पूर्वनिर्धारित रूपमा बन्द। व्यापक नेटवर्कमा रहन यसलाई बन्द राख्नुहोस्; जुनसुकै बेला बदल्न सकिन्छ।",
    missionRegisterFirst: "अभियान छान्न स्वयंसेवकका रूपमा दर्ता गर्नुहोस्।",
    missionSignInToJoin: "पहिल्यै दर्ता गर्नुभएको छ? अभियान छान्न साइन इन गर्नुहोस्।",
    missionBack: "सबै अभियान",
    missionCapReached: "तपाईंले दुई अभियान छान्नुभयो। अर्को छान्न एउटा छाड्नुहोस्।",
    missionSourceEmail: "तपाईंको इमेल जवाफबाट अभिलेख गरिएको",
    missionSourceAdmin: "संयोजकद्वारा अभिलेख गरिएको",
    missionPaused: "यो टोली रोकिएको छ",
    missionClosed: "यो टोलीले आफ्नो काम सम्पन्न गरेको छ",
    missionYourMissions: "तपाईंका अभियानहरू",
    missionNoneChosen: "तपाईंले अझै अभियान छान्नुभएको छैन।",
    missionSaveScope: "यो प्राथमिकता सुरक्षित गर्नुहोस्",
    missionsUnavailable:
      "अहिले अभियान टोलीहरू लोड गर्न सकिएन। यो हाम्रो तर्फको समस्या हो — केही बेरमा फेरि प्रयास गर्नुहोस्।",

    profileUnavailableTitle: "तपाईंको दर्ता लोड गर्न सकिएन",
    profileUnavailableBody:
      "यो हाम्रो तर्फको समस्या हो; तपाईंको दर्ता हराएको होइन। केही बेरमा फेरि प्रयास गर्नुहोस् — फारम फेरि नभर्नुहोस्, नत्र दुईवटा रेकर्ड बन्नेछन्।",
    readyTitle: "निमन्त्रणाका लागि तयार",
    readyYes: "तपाईंका विवरण पूरा छन्। संयोजकले उपयुक्त कामका लागि निम्तो दिन सक्छन्।",
    readyPausedNote:
      "तपाईंले निमन्त्रणा रोक्नुभएको छ। फेरि नखोलेसम्म केही पठाइने छैन।",
    readyMissingTitle: "निमन्त्रणा पाउनुअघि अझै चाहिने कुरा",
    readyFixMatching: "माथिको मिलान विवरणमा यो थप्नुहोस्।",
    readyFixRegistration: "दर्तामा यो अद्यावधिक गर्न हामीलाई सम्पर्क गर्नुहोस्।",
    readyFixCoordinator: "यो संयोजकले गर्नेछन् — तपाईंले केही गर्नु पर्दैन।",
    wsInvitationsTitle: "खुला निमन्त्रणाहरू",
    wsInvitationsEmpty: "कुनै खुला निमन्त्रणा छैन। उपयुक्त काम आएमा इमेल गरिनेछ।",
    wsInvitationExpires: "जवाफ दिनुहोस्",
    wsInvitationLapsed: "जवाफको अवधि सकियो",
    wsInvitationAccepted: "तपाईंले स्वीकार गर्नुभयो — अनुरोधकर्ताको प्रतीक्षामा",
    wsInvitationWaiting: "तपाईंको जवाफको प्रतीक्षामा",
    wsCommitmentsTitle: "हालका प्रतिबद्धताहरू",
    wsCommitmentsEmpty: "अझै पुष्टि भएको प्रतिबद्धता छैन।",
    wsCommittedHours: "सबैभन्दा व्यस्त समयमा प्रति हप्ता वाचा गरिएका घण्टा",

    n3StepNeed: "तपाईंलाई के चाहिन्छ",
    n3StepContact: "सम्पर्क कसरी गर्ने",
    n3StepReview: "जाँचेर पठाउनुहोस्",
    n3Intro:
      "तीन छोटा चरण। विवरण पछि संयोजकले तपाईंसँग मिलाउनेछन् — अहिले सबै कुरा तयार हुनुपर्दैन।",
    n3Type: "कस्तो प्रकारको सहयोग?",
    n3TypeHint: "नजिकको छान्नुहोस्। विवरण हामी तपाईंसँग मिलाउनेछौं।",
    n3Title: "एक वाक्यमा, तपाईंलाई के चाहिन्छ?",
    n3TitleHint: "बोर्डमा मानिसले यही देख्छन्। सरल शब्द राम्रो हुन्छ।",
    n3Detail: "के हुनुपर्छ, वर्णन गर्नुहोस्",
    n3DetailHint: "अवस्था कस्तो छ र के गर्दा सहयोग पुग्छ? केही वाक्य नै पर्याप्त छ।",
    n3District: "जिल्ला",
    n3Municipality: "नगरपालिका वा वडा",
    n3MunicipalityHint: "ऐच्छिक। स्वयंसेवकलाई यात्रा अनुमान गर्न सजिलो हुन्छ।",
    n3WorkMode: "काम कहाँ हुन्छ?",
    n3Urgency: "कति चाँडो चाहिन्छ?",
    n3Organization: "तपाईंको नाम वा संस्था",
    n3OrganizationHint: "जसको तर्फबाट अनुरोध गर्दै हुनुहुन्छ।",
    n3Person: "सम्पर्क व्यक्ति",
    n3Email: "इमेल",
    n3Phone: "फोन वा WhatsApp",
    n3ContactHint: "कम्तीमा एउटा दिनुहोस्। हामी कहिल्यै सार्वजनिक गर्दैनौं।",
    n3Photos: "फोटो वा कागजात",
    n3Consent:
      "यो अनुरोध साँचो हो र माथि उल्लिखित व्यक्तिको तर्फबाट गर्न म अधिकृत छु भनी पुष्टि गर्दछु।",
    n3ReviewTitle: "एकपटक जाँच्नुहोस्",
    n3ReviewIntro: "बटन नथिचेसम्म केही पठाइँदैन। फर्केर जुनसुकै कुरा बदल्न सक्नुहुन्छ।",
    n3NotAnswered: "उत्तर दिइएको छैन",
    n3Back: "पछाडि",
    n3Next: "अगाडि बढ्नुहोस्",
    n3Submit: "यो अनुरोध पठाउनुहोस्",
    n3SaveDraft: "यही यन्त्रमा मस्यौदा सुरक्षित गर्नुहोस्",
    n3DraftSaved: "मस्यौदा यही यन्त्रमा सुरक्षित भयो। हामीलाई पठाइएको छैन।",
    n3DraftFound: "यही यन्त्रमा अधुरो अनुरोध सुरक्षित छ।",
    n3DraftRestore: "जहाँ छाड्नुभयो त्यहींबाट सुरु गर्नुहोस्",
    n3DraftDiscard: "नयाँ सुरु गर्नुहोस्",
    n3AssistTitle: "हामीले फोन गरौं?",
    n3AssistBody:
      "नाम र नम्बर दिनुहोस्, संयोजकले फोन गरेर तपाईंसँगै यो भर्नेछन्। अहिले अरू केही चाहिँदैन।",
    n3AssistCta: "बरु हामीलाई फोन गर्न भन्नुहोस्",
    n3AssistBack: "म आफैं फारम भर्छु",
    n3AssistSubmit: "फोनको लागि अनुरोध",
    n3AssistConsent: "यो अनुरोधबारे मलाई सम्पर्क गर्न म सहमत छु।",
    n3RoleNote:
      "सीप, कति जना र मिति तपाईंको अनुरोध प्रमाणित भएपछि संयोजकसँग मिलाइन्छ।",

    rqNav: "मेरो अनुरोध",
    rqTitle: "तपाईंको अनुरोध",
    rqIntro: "यो कहाँ पुग्यो, र तपाईंले के बदल्न सक्नुहुन्छ।",
    rqSignedOut: "आफ्नो अनुरोधमा दिइएको इमेलले साइन इन गर्नुहोस्।",
    rqSignIn: "साइन इन गर्नुहोस्",
    rqNoRequest: "यो खातासँग कुनै अनुरोध जोडिएको छैन",
    rqNoRequestBody:
      "तपाईंले अनुरोध पठाउनुभएको छ भने, पुष्टि पृष्ठको लिंकबाट यसलाई यो खातासँग जोड्नुहोस्।",
    rqUnavailable:
      "अहिले तपाईंको अनुरोध लोड गर्न सकिएन। यो हाम्रो तर्फको समस्या हो; अनुरोध हराएको होइन — केही बेरमा फेरि प्रयास गर्नुहोस्, फेरि नपठाउनुहोस्।",
    rqReference: "सन्दर्भ",
    rqStatus: "स्थिति",
    rqCoordinator: "तपाईंको संयोजक",
    rqNoCoordinator: "अझै तोकिएको छैन",
    rqFiledOn: "पठाइएको मिति",
    rqAssisted: "तपाईंले यसबारे फोन गर्न भन्नुभएको थियो",
    rqEditTitle: "आफ्नो अनुरोध सच्याउनुहोस्",
    rqEditWarning:
      "कामको विवरण बदल्नुभयो भने पठाइसकिएका निमन्त्रणा रद्द हुन्छन्, ताकि संयोजकले नयाँ विवरणसँग मिलाएर जाँच्न सकून्। एक वाक्यको सारांश मात्र बदल्दा हुँदैन।",
    rqEditSave: "परिवर्तन सुरक्षित गर्नुहोस्",
    rqSummaryLabel: "एक वाक्यको सारांश",
    rqDetailLabel: "के हुनुपर्छ",
    rqProposedTitle: "तपाईंका लागि खोजिँदै गरेका मानिस",
    rqProposedEmpty: "अझै कसैलाई सम्पर्क गरिएको छैन। अनुरोध प्रमाणित भएपछि संयोजकले गर्नेछन्।",
    rqProposedNote:
      "नाम र सम्पर्क विवरण दुवै पक्ष सहमत भएपछि मात्र साझा हुन्छ, त्यसैले यहाँ व्यक्ति होइन भूमिका देखिन्छ।",
    rqConfirm: "यसैसँग अगाडि बढौं",
    rqDecline: "यो होइन",
    rqOutcomeTitle: "सहयोग काम लाग्यो?",
    rqOutcomeIntro:
      "यो काम भयो कि भएन भन्ने हामीले थाहा पाउने एउटै बाटो यही हो। संयोजकले पढ्छन्, सार्वजनिक हुँदैन।",
    rqOutcomeYes: "हो, आवश्यकता पूरा भयो",
    rqOutcomePartly: "आंशिक रूपमा",
    rqOutcomeNo: "भएन",
    rqOutcomeNote: "थप्न चाहनुभएको कुरा",
    rqOutcomeSave: "पठाउनुहोस्",
    rqCloseTitle: "यो अनुरोध बन्द गर्नुहोस्",
    rqCloseBody:
      "समस्या जसरी भए पनि समाधान भयो भने बन्द गर्नुहोस्। पछि फेरि खोल्न सकिन्छ।",
    rqCloseReason: "किन बन्द गर्दै हुनुहुन्छ? (ऐच्छिक)",
    rqClose: "अनुरोध बन्द गर्नुहोस्",
    rqReopen: "अनुरोध फेरि खोल्नुहोस्",
    rqReopenBody: "यो अनुरोध बन्द छ। फेरि खोल्दा पुनः समीक्षामा जान्छ।",
    rqHistoryTitle: "के-के भयो",
    rqHistoryEmpty: "अझै केही अभिलेख छैन।",
    rqClaimTitle: "आफ्नो अनुरोध यो खातासँग जोड्नुहोस्",
    rqClaimIntro:
      "आफ्नो अनुरोधमा दिइएको इमेल लेख्नुहोस्, हामी पुष्टिका लागि कोड पठाउनेछौं।",
  },
};

export function added(lang: Lang): AddedStrings {
  return ADDED[lang];
}
