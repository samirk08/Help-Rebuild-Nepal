// AUTO-GENERATED from "Help Rebuild Nepal.dc.html" by scripts/gen-content.js.
// Content tables lifted verbatim from the approved design. Re-run the script to refresh.
// Two notes on faithful transfer:
//   * STR.en/np each defined heroTitle and heroSub twice; JS last-wins, so only the
//     values the prototype actually rendered are kept here.
//   * NP_MAP had 3 duplicate keys, all with identical values — deduped, nothing lost.

export type Lang = "en" | "np";

export type NavItem = { id: ScreenId; en: string; np: string };

export type ScreenId =
  | "home"
  | "needs"
  | "projects"
  | "networks"
  | "tracker"
  | "profile"
  | "partners";

export type RadioRow = {
  group: string;
  label: string;
  note: string;
  color: string;
};

export type FormField = {
  label: string;
  span: string;
  ph?: string;
  note?: string;
  isText?: boolean;
  isSelect?: boolean;
  isArea?: boolean;
  isChips?: boolean;
  isRadio?: boolean;
  options?: string[];
  rows?: RadioRow[];
};

export type FormSection = {
  n: string;
  title: string;
  hint: string;
  fields: FormField[];
};

export const NAV: NavItem[] = [
  {
    "id": "home",
    "en": "Home",
    "np": "गृहपृष्ठ"
  },
  {
    "id": "needs",
    "en": "Needs",
    "np": "आवश्यकता"
  },
  {
    "id": "projects",
    "en": "Projects",
    "np": "परियोजना"
  },
  {
    "id": "networks",
    "en": "Networks",
    "np": "नेटवर्क"
  },
  {
    "id": "tracker",
    "en": "Tracker",
    "np": "ट्र्याकर"
  },
  {
    "id": "profile",
    "en": "Profile",
    "np": "प्रोफाइल"
  },
  {
    "id": "partners",
    "en": "For partners",
    "np": "साझेदारका लागि"
  }
];

export const LOOP_WORDS: string[] = [
  "engineers",
  "nurses",
  "translators",
  "drivers",
  "surveyors",
  "coordinators",
  "electricians",
  "teachers"
];

export const LOOP_WORDS_NP: string[] = [
  "इन्जिनियर",
  "नर्स",
  "अनुवादक",
  "चालक",
  "सर्भेयर",
  "संयोजक",
  "इलेक्ट्रिसियन",
  "शिक्षक"
];

export const TRACKER_LABELS: string[] = [
  "Total volunteers registered",
  "Remote volunteers",
  "On the ground, need logistics",
  "On the ground, self-supported",
  "Time contributors"
];

export const DEMO_COUNTS: number[] = [
  1284,
  412,
  306,
  198,
  368
];

export const DISTRICTS: string[] = [
  "Select district",
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  "Sindhupalchok",
  "Rasuwa",
  "Kavre",
  "Nuwakot",
  "Dolakha",
  "Gorkha",
  "Other / outside Nepal"
];

export const SKILLS: string[] = [
  "Engineering (structural / civil)",
  "Architecture",
  "Health & medical",
  "Water & sanitation (WASH)",
  "Project management",
  "Logistics & transport",
  "Construction & trades",
  "Education & child support",
  "Psychosocial support",
  "Translation",
  "IT & data",
  "Other"
];

export const VOL_FORM: FormSection[] = [
  {
    "n": "01",
    "title": "Your details",
    "hint": "Required",
    "fields": [
      {
        "label": "Full name",
        "isText": true,
        "ph": "As on your ID",
        "span": "span 1"
      },
      {
        "label": "Email",
        "isText": true,
        "ph": "you@example.com",
        "span": "span 1"
      },
      {
        "label": "Phone / WhatsApp",
        "isText": true,
        "ph": "+977",
        "span": "span 1"
      },
      {
        "label": "Where you are based",
        "isSelect": true,
        "options": [
          "Select district",
          "Kathmandu",
          "Lalitpur",
          "Bhaktapur",
          "Sindhupalchok",
          "Rasuwa",
          "Kavre",
          "Nuwakot",
          "Dolakha",
          "Gorkha",
          "Other / outside Nepal"
        ],
        "span": "span 1"
      },
      {
        "label": "Emergency contact",
        "isText": true,
        "ph": "Name and phone number",
        "span": "1 / -1"
      }
    ]
  },
  {
    "n": "02",
    "title": "Your contribution path",
    "hint": "Choose all that apply",
    "fields": [
      {
        "label": "How you can contribute",
        "isChips": true,
        "span": "1 / -1",
        "options": [
          "I can help remotely",
          "I can travel",
          "I can contribute time",
          "I can provide equipment",
          "I can contribute logistics",
          "I can support financially"
        ]
      }
    ]
  },
  {
    "n": "03",
    "title": "Expertise and skills",
    "hint": "Required",
    "fields": [
      {
        "label": "Primary skill",
        "isSelect": true,
        "options": [
          "Engineering (structural / civil)",
          "Architecture",
          "Health & medical",
          "Water & sanitation (WASH)",
          "Project management",
          "Logistics & transport",
          "Construction & trades",
          "Education & child support",
          "Psychosocial support",
          "Translation",
          "IT & data",
          "Other"
        ],
        "span": "span 1"
      },
      {
        "label": "Years of experience",
        "isSelect": true,
        "options": [
          "Select",
          "Under 2",
          "2–5",
          "5–10",
          "10–20",
          "20+"
        ],
        "span": "span 1"
      },
      {
        "label": "Sub-skills",
        "isText": true,
        "ph": "e.g. seismic retrofitting, damage assessment",
        "span": "1 / -1"
      },
      {
        "label": "Certifications and licences",
        "isText": true,
        "ph": "Council registration number, certifications",
        "span": "1 / -1",
        "note": "Helps verifiers prioritise you for technical assessments."
      }
    ]
  },
  {
    "n": "04",
    "title": "Availability",
    "hint": "",
    "fields": [
      {
        "label": "Available from",
        "isText": true,
        "ph": "DD / MM / YYYY",
        "span": "span 1"
      },
      {
        "label": "Duration you can commit",
        "isSelect": true,
        "options": [
          "Select",
          "A few days",
          "1–2 weeks",
          "1 month",
          "3 months",
          "Ongoing"
        ],
        "span": "span 1"
      },
      {
        "label": "Hours per week",
        "isSelect": true,
        "options": [
          "Select",
          "Up to 5",
          "5–15",
          "15–30",
          "Full time"
        ],
        "span": "span 1"
      },
      {
        "label": "Maximum single deployment",
        "isSelect": true,
        "options": [
          "Select",
          "3 days",
          "1 week",
          "2 weeks",
          "1 month or more"
        ],
        "span": "span 1"
      }
    ]
  },
  {
    "n": "05",
    "title": "Deployment preferences",
    "hint": "",
    "fields": [
      {
        "label": "Where you can work",
        "isSelect": true,
        "options": [
          "On the ground",
          "Remote",
          "Both"
        ],
        "span": "span 1"
      },
      {
        "label": "Travel",
        "isSelect": true,
        "options": [
          "Anywhere in Nepal",
          "Specific districts only",
          "Within my district only"
        ],
        "span": "span 1"
      },
      {
        "label": "Preferred districts",
        "isText": true,
        "ph": "List districts, if any",
        "span": "1 / -1"
      }
    ]
  },
  {
    "n": "06",
    "title": "What you can bring",
    "hint": "Optional",
    "fields": [
      {
        "label": "Resources",
        "isChips": true,
        "span": "1 / -1",
        "options": [
          "Equipment",
          "Tools",
          "Vehicle",
          "Software / licences",
          "Professional services",
          "Warehouse / storage",
          "Accommodation"
        ]
      },
      {
        "label": "Details",
        "isArea": true,
        "ph": "Describe what you can bring, quantities, and any conditions.",
        "span": "1 / -1"
      }
    ]
  },
  {
    "n": "07",
    "title": "Additional information",
    "hint": "Optional",
    "fields": [
      {
        "label": "Languages",
        "isChips": true,
        "span": "1 / -1",
        "options": [
          "Nepali",
          "English",
          "Newar",
          "Maithili",
          "Tamang",
          "Hindi",
          "Other"
        ]
      },
      {
        "label": "Past experience in disaster response",
        "isArea": true,
        "ph": "Where, when, and in what role.",
        "span": "1 / -1"
      },
      {
        "label": "References",
        "isText": true,
        "ph": "Name and contact of someone who can vouch for your work",
        "span": "1 / -1"
      }
    ]
  }
];

export const NEED_FORM: FormSection[] = [
  {
    "n": "01",
    "title": "Who are you",
    "hint": "Required",
    "fields": [
      {
        "label": "You are posting as",
        "isSelect": true,
        "options": [
          "Government agency",
          "Municipality / ward",
          "NGO / INGO",
          "Community group",
          "Institution (school, hospital)",
          "Business",
          "Individual"
        ],
        "span": "span 1",
        "note": "Individual requests are published as community-reported, verification pending."
      },
      {
        "label": "Organization name",
        "isText": true,
        "ph": "Full registered name",
        "span": "span 1"
      },
      {
        "label": "Contact person",
        "isText": true,
        "ph": "Name and role",
        "span": "span 1"
      },
      {
        "label": "Phone / email",
        "isText": true,
        "ph": "How volunteers reach you",
        "span": "span 1"
      }
    ]
  },
  {
    "n": "02",
    "title": "Location of the need",
    "hint": "Required",
    "fields": [
      {
        "label": "Province",
        "isSelect": true,
        "options": [
          "Select province",
          "Koshi",
          "Madhesh",
          "Bagmati",
          "Gandaki",
          "Lumbini",
          "Karnali",
          "Sudurpashchim"
        ],
        "span": "span 1"
      },
      {
        "label": "District",
        "isSelect": true,
        "options": [
          "Select district",
          "Kathmandu",
          "Lalitpur",
          "Bhaktapur",
          "Sindhupalchok",
          "Rasuwa",
          "Kavre",
          "Nuwakot",
          "Dolakha",
          "Gorkha",
          "Other / outside Nepal"
        ],
        "span": "span 1"
      },
      {
        "label": "Municipality",
        "isText": true,
        "ph": "Municipality or rural municipality",
        "span": "span 1"
      },
      {
        "label": "Ward",
        "isText": true,
        "ph": "Ward number",
        "span": "span 1"
      },
      {
        "label": "Exact location",
        "isText": true,
        "ph": "Landmark, or paste map coordinates",
        "span": "1 / -1"
      }
    ]
  },
  {
    "n": "03",
    "title": "What you need",
    "hint": "Choose all that apply",
    "fields": [
      {
        "label": "Skills required",
        "isChips": true,
        "span": "1 / -1",
        "options": [
          "Engineering (structural / civil)",
          "Architecture",
          "Health & medical",
          "Water & sanitation (WASH)",
          "Project management",
          "Logistics & transport",
          "Construction & trades",
          "Education & child support",
          "Psychosocial support",
          "Translation",
          "IT & data",
          "Other"
        ]
      },
      {
        "label": "Resources required",
        "isChips": true,
        "span": "1 / -1",
        "options": [
          "Equipment",
          "Vehicles",
          "Materials",
          "Medical supplies",
          "Tents / shelter",
          "Food and water",
          "Funding"
        ]
      }
    ]
  },
  {
    "n": "04",
    "title": "Need details",
    "hint": "Be specific",
    "fields": [
      {
        "label": "How many people",
        "isText": true,
        "ph": "e.g. 4",
        "span": "span 1"
      },
      {
        "label": "Experience level required",
        "isSelect": true,
        "options": [
          "Any",
          "Some experience",
          "Qualified professional",
          "Senior / licensed"
        ],
        "span": "span 1"
      },
      {
        "label": "Exactly what needs to be done",
        "isArea": true,
        "ph": "Inspect approximately 40 houses in Ward 7 and assess whether they are safe for occupation.",
        "span": "1 / -1"
      },
      {
        "label": "Objectives / what success looks like",
        "isArea": true,
        "ph": "All houses assessed and results handed to the ward office.",
        "span": "1 / -1"
      }
    ]
  },
  {
    "n": "05",
    "title": "Timeline and duration",
    "hint": "",
    "fields": [
      {
        "label": "Start date",
        "isText": true,
        "ph": "DD / MM / YYYY",
        "span": "span 1"
      },
      {
        "label": "Duration",
        "isSelect": true,
        "options": [
          "Select",
          "1–3 days",
          "1 week",
          "2 weeks",
          "1 month",
          "Longer / ongoing project"
        ],
        "span": "span 1"
      },
      {
        "label": "Deadline",
        "isText": true,
        "ph": "When this must be completed by",
        "span": "span 1"
      }
    ]
  },
  {
    "n": "06",
    "title": "Support and logistics",
    "hint": "What you can provide",
    "fields": [
      {
        "label": "Accommodation",
        "isSelect": true,
        "options": [
          "Provided",
          "Not provided",
          "Can arrange if needed"
        ],
        "span": "span 1"
      },
      {
        "label": "Food",
        "isSelect": true,
        "options": [
          "Provided",
          "Not provided",
          "Can arrange if needed"
        ],
        "span": "span 1"
      },
      {
        "label": "Transport",
        "isSelect": true,
        "options": [
          "Provided",
          "Not provided",
          "Reimbursed"
        ],
        "span": "span 1"
      },
      {
        "label": "Equipment available on site",
        "isArea": true,
        "ph": "What volunteers will find there, and what they should bring.",
        "span": "1 / -1"
      }
    ]
  },
  {
    "n": "07",
    "title": "Type of support",
    "hint": "",
    "fields": [
      {
        "label": "Where the work happens",
        "isSelect": true,
        "options": [
          "On the ground",
          "Remote",
          "Both"
        ],
        "span": "span 1"
      },
      {
        "label": "Paid or unpaid",
        "isSelect": true,
        "options": [
          "Unpaid / volunteer",
          "Expenses covered",
          "Paid engagement"
        ],
        "span": "span 1"
      }
    ]
  },
  {
    "n": "08",
    "title": "Level of urgency",
    "hint": "Required",
    "fields": [
      {
        "label": "How urgent is this",
        "isRadio": true,
        "span": "1 / -1",
        "rows": [
          {
            "group": "urgency",
            "label": "Immediate",
            "note": "0–72 hours",
            "color": "#d13b30"
          },
          {
            "group": "urgency",
            "label": "Urgent",
            "note": "within 1 week",
            "color": "#e0a11b"
          },
          {
            "group": "urgency",
            "label": "Upcoming",
            "note": "within 1 month",
            "color": "#2b7fd4"
          },
          {
            "group": "urgency",
            "label": "Reconstruction",
            "note": "long term",
            "color": "#14663c"
          }
        ]
      }
    ]
  },
  {
    "n": "09",
    "title": "Additional information",
    "hint": "Optional",
    "fields": [
      {
        "label": "Anything else volunteers should know",
        "isArea": true,
        "ph": "Access conditions, security, permissions, documents.",
        "span": "1 / -1"
      },
      {
        "label": "Documents or photographs",
        "isText": true,
        "ph": "Paste a link to photos, assessments or permits",
        "span": "1 / -1"
      }
    ]
  }
];

export const STR = {
  "en": {
    "heroTag": "Coordinated recovery",
    "heroTitle": "Rebuilding Nepal takes all of us.",
    "heroSub": "Offer your time, skills, equipment or resources—or tell us what your community needs. Help Rebuild Nepal connects verified needs with people ready to help.",
    "liveNow": "Live impact tracker",
    "zeroNote": "The network is opening now. Counters start at zero and update as people register and verified needs are posted.",
    "twoWays": "Two ways to make an impact",
    "helpTitle": "I want to help",
    "needTitle": "I need volunteers / help",
    "registerCta": "Register as a volunteer",
    "postCta": "Post a need",
    "flowTitle": "Platform flow overview",
    "statusFlow": "Request status flow",
    "verifiedBy": "Verification and partners",
    "iCanHelpBtn": "I can help",
    "requestSupportBtn": "Request support",
    "offerHelpBtn": "Offer help",
    "earlyTitle": "Help build the network from day one",
    "earlyBody": "Register what you can offer or post a community need. Live totals will appear as requests are verified, volunteers are matched and work is completed.",
    "seeTracker": "See the live tracker",
    "needsNowTitle": "Current verified needs",
    "needsNowBody": "Verified requests appear here first — the quickest way to see where people are needed right now.",
    "needsNowEmptyTitle": "No requests have been verified yet",
    "needsNowEmptyBody": "The first verified request will appear here. Until then, the most useful thing you can do is register what you can offer.",
    "seeNeedsBoard": "Open the needs dashboard",
    "whatBrings": "What brings you here?",
    "canHelpTitle": "I can help",
    "canHelpBody": "Offer your time, professional skills, equipment, transportation or other resources.",
    "needSupportTitle": "I need support",
    "needSupportBody": "Tell us what your community, organization or rebuilding project needs.",
    "howItWorks": "How it works",
    "moreThanTitle": "More than a list of volunteers",
    "moreThanBody": "We connect each verified request with people who have the right skills, availability, location and resources to respond.",
    "projectsPeekTitle": "Active projects",
    "projectsPeekBody": "Some needs take a standing team rather than one deployment — a school rebuild, a shelter, a health camp series. Those run as projects with a coordinator and a public progress record.",
    "seeProjects": "See projects",
    "trustTitle": "Verification and trust",
    "trustIntro": "Nothing is published on the strength of a form alone. Here is who checks a request, and what happens when a request cannot be checked.",
    "donateTitle": "I want to contribute financially",
    "donateBody": "Money is handled by the government, not by this platform. Financial contributions go to the Prime Minister Disaster Relief Fund.",
    "pmdrfTitle": "Prime Minister Disaster Relief Fund",
    "pmdrfBody": "You will be taken to the official fund portal at pmdrf.nchl.com.np to complete your contribution. Help Rebuild Nepal never collects or holds donations.",
    "pmdrfCta": "Continue to the relief fund",
    "openTo": "Open to",
    "liveLabel": "Updating live",
    "sampleChip": "Sample data — not real activity",
    "progressLabel": "Sections",
    "expandAll": "Expand all",
    "collapseAll": "Collapse all",
    "queueTitle": "Verification queue",
    "queueNote": "Requests waiting on a verifier",
    "queueEmptyTitle": "Nothing waiting for review",
    "queueEmptyBody": "Submitted requests land here for a municipality, partner organization or the coordination team to confirm before they are published.",
    "openFullPage": "Open full page",
    "toastVolunteer": "Design preview — nothing was submitted. Connect this form to a database and it becomes a live registration.",
    "toastNeed": "Design preview — nothing was submitted. A live request would now enter the verification queue.",
    "toastInterest": "Design preview — no interest was recorded. On a live request the requester would be notified.",
    "partnersTitle": "For partners",
    "partnersIntro": "Access for municipalities, agencies and partner organizations: verification queues, matching, project oversight and structured handover.",
    "helpBody": "Register your skills, time, resources and availability. You decide how far you can travel, how long you can commit, and what you can bring.",
    "needBody": "Tell us what your community, project or organization needs. Be specific: the clearer the request, the faster it gets matched and filled.",
    "verifyBody": "Every request is reviewed before it is published. Needs reported by individuals are shown separately as community-reported, verification pending.",
    "logoNote": "Partner and agency logos to be supplied — drop image files into these slots.",
    "jA": "A. Journey — I want to help",
    "jEngine": "The matching engine",
    "jB": "B. Journey — I need help",
    "matchIntro": "A verified request is matched against the register on:",
    "ctaTitle": "The register is open. Add yourself, or add your need.",
    "ctaBody": "Every profile makes the next match faster. Every verified need makes the picture of what the country actually requires more accurate.",
    "footerTagline": "A coordination layer between people who want to help and the communities, municipalities and organizations that need help.",
    "footerNote": "Prototype interface. Forms are not yet connected to a live database.",
    "organizeTitle": "You do not need to be a specialist",
    "organizeBody": "Organizers and coordinators are as valuable as engineers. If you can make calls, keep lists, translate, drive or run a schedule, register — coordinators become the people who connect verified needs to available volunteers in their district.",
    "writeLike": "Write it like this",
    "exampleQuote": "“Need 2 structural engineers to inspect approximately 40 houses in Ward 7 and assess whether they are safe for occupation.”",
    "writeLikeNote": "Far more useful than “we need engineers”. Precise requests get filled first.",
    "needsTitle": "Active needs",
    "needsIntro": "Every verified request, filterable by location, skill required and urgency. Community-reported needs awaiting verification are listed separately and labelled.",
    "needsCount": "0 published requests",
    "needsEmptyTitle": "No published requests yet",
    "needsEmptyBody": "Requests appear here as soon as a verifier confirms them. If your community needs people, post the need and it enters review.",
    "seeExample": "See an example request",
    "backToNeeds": "← Back to all needs",
    "exampleNote": "Example layout. No live requests have been published yet.",
    "whatToDo": "What needs to be done",
    "detailBody": "Inspect approximately 40 houses in Ward 7 and assess whether they are safe for occupation. Findings are recorded on the municipality's assessment form and handed to the ward office each evening.",
    "detailTitle": "Structural engineers — Sindhupalchok, Ward 7",
    "detailMeta": "Melamchi Municipality · Bagmati Province · Posted 2 days ago",
    "verifiedBadge": "VERIFIED BY MUNICIPALITY",
    "immediateBadge": "IMMEDIATE — 0–72 HOURS",
    "positions": "Positions",
    "committed": "volunteers committed",
    "iCanHelp": "I can help with this →",
    "interestNote": "Expressing interest is not a commitment. The requester contacts you first.",
    "trackerTitle": "Live impact tracker",
    "trackerIntro": "Anonymous, real-time counts of collective capacity. No personal details are shown here.",
    "expertiseTitle": "Expertise breakdown",
    "fromTitle": "Registered from",
    "diasporaNote": "Diaspora volunteers can contribute remotely — assessment review, design, fundraising, translation and coordination.",
    "demandTitle": "Demand snapshot",
    "projectsTitle": "Projects in progress",
    "projectsIntro": "Where a single need becomes ongoing work — a school rebuild, a temporary shelter, a health camp series — volunteers form a team and work together over weeks or months.",
    "projectsEmptyTitle": "No projects have been opened yet",
    "projectsEmptyBody": "A project opens when a verified need requires a standing team rather than a one-off deployment. Every project carries a coordinator, a roster, a duration and a public progress record.",
    "proposeProject": "Propose a project need",
    "networksTitle": "Skill networks",
    "networksIntro": "Join or create a network of people who share your expertise. Networks let a municipality reach an entire discipline at once instead of chasing individuals.",
    "joinNetwork": "Join network",
    "createNetwork": "Create a network",
    "createNetworkBody": "Your discipline missing? Start it, and volunteers with that skill are pointed to it on registration.",
    "profileNote": "Preview of the profile you get after registering.",
    "yourName": "Your name",
    "profileMeta": "Primary skill · District · Available from —",
    "completeness": "Profile completeness",
    "profileBody": "Once registered you can express interest in verified needs, join or create skill networks, update availability at any time, and receive matched opportunities.",
    "registerArrow": "Register as a volunteer →",
    "adminTitle": "Command centre",
    "adminIntro": "Back-end view for the coordination team: verification queues, matching, project oversight and structured handover to government and partners.",
    "handoverTitle": "Data handover and reporting",
    "handoverBody": "Structured, verified and filterable records shared with the agencies that need them.",
    "membersLabel": "members"
  },
  "np": {
    "heroTag": "समन्वित पुनर्निर्माण",
    "heroTitle": "नेपाल पुनर्निर्माणमा हामी सबै चाहिन्छौं।",
    "heroSub": "तपाईंको समय, सीप, उपकरण वा स्रोत दिनुहोस् — वा तपाईंको समुदायलाई के चाहिएको छ भन्नुहोस्। हेल्प रिबिल्ड नेपालले प्रमाणित आवश्यकतालाई सहयोग गर्न तयार मानिससँग जोड्छ।",
    "liveNow": "प्रत्यक्ष प्रभाव ट्र्याकर",
    "zeroNote": "नेटवर्क अहिले खुल्दैछ। सङ्ख्याहरू शून्यबाट सुरु हुन्छन् र दर्ता तथा प्रमाणित आवश्यकता अनुसार अद्यावधिक हुन्छन्।",
    "twoWays": "प्रभाव पार्ने दुई तरिका",
    "helpTitle": "मलाई सहयोग गर्नु छ",
    "needTitle": "मलाई स्वयंसेवक / सहयोग चाहियो",
    "registerCta": "स्वयंसेवक दर्ता",
    "postCta": "आवश्यकता राख्नुहोस्",
    "flowTitle": "प्लेटफर्म प्रक्रिया",
    "statusFlow": "अनुरोधको स्थिति",
    "verifiedBy": "प्रमाणीकरण र साझेदार",
    "iCanHelpBtn": "म सहयोग गर्न सक्छु",
    "requestSupportBtn": "सहयोग माग्नुहोस्",
    "offerHelpBtn": "सहयोग दिनुहोस्",
    "earlyTitle": "पहिलो दिनदेखि नेटवर्क निर्माणमा सघाउनुहोस्",
    "earlyBody": "तपाईंले दिन सक्ने कुरा दर्ता गर्नुहोस् वा समुदायको आवश्यकता राख्नुहोस्। अनुरोध प्रमाणित हुँदै, स्वयंसेवक मिल्दै र काम सम्पन्न हुँदै जाँदा प्रत्यक्ष जोडहरू देखिन थाल्नेछन्।",
    "seeTracker": "प्रत्यक्ष ट्र्याकर हेर्नुहोस्",
    "needsNowTitle": "हालका प्रमाणित आवश्यकता",
    "needsNowBody": "प्रमाणित अनुरोध पहिले यहाँ देखिन्छ — अहिले कहाँ मानिस चाहिएको छ भन्ने छिटो थाहा पाउने ठाउँ।",
    "needsNowEmptyTitle": "अझै कुनै अनुरोध प्रमाणित भएको छैन",
    "needsNowEmptyBody": "पहिलो प्रमाणित अनुरोध यहाँ देखिनेछ। त्यससम्म, तपाईंले दिन सक्ने कुरा दर्ता गर्नु सबैभन्दा उपयोगी हुन्छ।",
    "seeNeedsBoard": "आवश्यकता ड्यासबोर्ड खोल्नुहोस्",
    "whatBrings": "तपाईं किन आउनुभयो?",
    "canHelpTitle": "म सहयोग गर्न सक्छु",
    "canHelpBody": "तपाईंको समय, व्यावसायिक सीप, उपकरण, यातायात वा अन्य स्रोत दिनुहोस्।",
    "needSupportTitle": "मलाई सहयोग चाहियो",
    "needSupportBody": "तपाईंको समुदाय, संस्था वा पुनर्निर्माण परियोजनालाई के चाहिएको छ भन्नुहोस्।",
    "howItWorks": "यो कसरी काम गर्छ",
    "moreThanTitle": "स्वयंसेवकको सूची मात्र होइन",
    "moreThanBody": "हामी प्रत्येक प्रमाणित अनुरोधलाई सही सीप, उपलब्धता, स्थान र स्रोत भएका व्यक्तिसँग जोड्छौं।",
    "projectsPeekTitle": "सक्रिय परियोजना",
    "projectsPeekBody": "कुनै आवश्यकतालाई एकपटकको परिचालन नभई स्थायी टोली चाहिन्छ — विद्यालय पुनर्निर्माण, आश्रय, स्वास्थ्य शिविर। त्यस्ता काम संयोजक र सार्वजनिक प्रगति अभिलेखसहित परियोजनाका रूपमा चल्छन्।",
    "seeProjects": "परियोजना हेर्नुहोस्",
    "trustTitle": "प्रमाणीकरण र विश्वास",
    "trustIntro": "फारम भरेको भरमा कुनै पनि कुरा प्रकाशित हुँदैन। अनुरोध कसले जाँच्छ, र जाँच्न नसकिने अवस्थामा के हुन्छ — यहाँ छ।",
    "donateTitle": "म आर्थिक सहयोग गर्न चाहन्छु",
    "donateBody": "रकम यो प्लेटफर्मले नभई सरकारले व्यवस्थापन गर्छ। आर्थिक सहयोग प्रधानमन्त्री विपद् राहत कोषमा जान्छ।",
    "pmdrfTitle": "प्रधानमन्त्री विपद् राहत कोष",
    "pmdrfBody": "सहयोग पूरा गर्न तपाईंलाई pmdrf.nchl.com.np को आधिकारिक पोर्टलमा लगिनेछ। हेल्प रिबिल्ड नेपालले कहिल्यै दान सङ्कलन वा राख्दैन।",
    "pmdrfCta": "राहत कोषमा जानुहोस्",
    "openTo": "यिनका लागि खुला",
    "liveLabel": "प्रत्यक्ष अद्यावधिक",
    "sampleChip": "नमुना तथ्याङ्क — वास्तविक होइन",
    "progressLabel": "खण्डहरू",
    "expandAll": "सबै खोल्नु",
    "collapseAll": "सबै बन्द गर्नु",
    "queueTitle": "प्रमाणीकरण लाइन",
    "queueNote": "प्रमाणकको पर्खाइमा रहेका अनुरोध",
    "queueEmptyTitle": "समीक्षाको पर्खाइमा केही छैन",
    "queueEmptyBody": "पेश भएका अनुरोध प्रकाशित हुनुअघि नगरपालिका, साझेदार संस्था वा समन्वय टोलीले पुष्टि गर्नका लागि यहाँ आउँछन्।",
    "openFullPage": "पूरा पृष्ठ खोल्नु",
    "toastVolunteer": "डिजाइन नमुना — केही पेश भएको छैन। यो फारम डेटाबेससँग जोडिएपछि वास्तविक दर्ता हुनेछ।",
    "toastNeed": "डिजाइन नमुना — केही पेश भएको छैन। वास्तविक अनुरोध अब प्रमाणीकरण लाइनमा जान्थ्यो।",
    "toastInterest": "डिजाइन नमुना — कुनै इच्छा अभिलेख भएन। वास्तविक अनुरोधमा अनुरोधकर्तालाई सूचना जान्थ्यो।",
    "partnersTitle": "साझेदारका लागि",
    "partnersIntro": "नगरपालिका, निकाय र साझेदार संस्थाका लागि पहुँच: प्रमाणीकरण लाइन, म्याचिङ, परियोजना निगरानी र व्यवस्थित हस्तान्तरण।",
    "helpBody": "तपाईंको सीप, समय, स्रोत र उपलब्धता दर्ता गर्नुहोस्। कति दूर यात्रा गर्न सक्नुहुन्छ, कति समय दिन सक्नुहुन्छ र के ल्याउन सक्नुहुन्छ — निर्णय तपाईंको।",
    "needBody": "तपाईंको समुदाय, परियोजना वा संस्थालाई के चाहिएको छ भन्नुहोस्। स्पष्ट हुनुहोस् — अनुरोध जति स्पष्ट, त्यति छिटो पूरा हुन्छ।",
    "verifyBody": "प्रकाशित हुनु अघि प्रत्येक अनुरोधको समीक्षा हुन्छ। व्यक्तिगत रूपमा आएका आवश्यकता 'समुदायद्वारा रिपोर्ट, प्रमाणीकरण बाँकी' भनी छुट्टै देखाइन्छ।",
    "logoNote": "साझेदार र सरकारी निकायका लोगो राख्न बाँकी — यहाँ तस्बिर फाइल राख्नुहोस्।",
    "jA": "क. यात्रा — मलाई सहयोग गर्नु छ",
    "jEngine": "म्याचिङ इन्जिन",
    "jB": "ख. यात्रा — मलाई सहयोग चाहियो",
    "matchIntro": "प्रमाणित अनुरोधलाई निम्न आधारमा दर्तासँग मिलाइन्छ:",
    "ctaTitle": "दर्ता खुला छ। आफूलाई थप्नुहोस्, वा आफ्नो आवश्यकता राख्नुहोस्।",
    "ctaBody": "प्रत्येक प्रोफाइलले अर्को म्याच छिटो बनाउँछ। प्रत्येक प्रमाणित आवश्यकताले देशलाई वास्तवमा के चाहिएको छ भन्ने तस्बिर स्पष्ट बनाउँछ।",
    "footerTagline": "सहयोग गर्न चाहने व्यक्ति र सहयोग आवश्यक पर्ने समुदाय, नगरपालिका तथा संस्थाबीचको समन्वय पर्त।",
    "footerNote": "नमुना इन्टरफेस। फारमहरू अझै प्रत्यक्ष डेटाबेससँग जोडिएका छैनन्।",
    "organizeTitle": "विशेषज्ञ हुनु अनिवार्य छैन",
    "organizeBody": "संयोजक र व्यवस्थापक इन्जिनियर जत्तिकै महत्त्वपूर्ण हुन्छन्। फोन गर्न, सूची राख्न, अनुवाद गर्न, सवारी चलाउन वा तालिका मिलाउन सक्नुहुन्छ भने दर्ता गर्नुहोस् — संयोजकहरूले जिल्लामा प्रमाणित आवश्यकतालाई उपलब्ध स्वयंसेवकसँग जोड्छन्।",
    "writeLike": "यसरी लेख्नुहोस्",
    "exampleQuote": "“वडा ७ का करिब ४० घर निरीक्षण गरी बस्न सुरक्षित छन् वा छैनन् मूल्याङ्कन गर्न २ जना स्ट्रक्चरल इन्जिनियर आवश्यक।”",
    "writeLikeNote": "“हामीलाई इन्जिनियर चाहियो” भन्दा धेरै उपयोगी। स्पष्ट अनुरोध पहिले पूरा हुन्छ।",
    "needsTitle": "सक्रिय आवश्यकता",
    "needsIntro": "प्रत्येक प्रमाणित अनुरोध — स्थान, आवश्यक सीप र अत्यावश्यकता अनुसार छान्न मिल्ने। प्रमाणीकरण बाँकी रहेका समुदायिक आवश्यकता छुट्टै सूचीबद्ध र लेबल गरिन्छ।",
    "needsCount": "० प्रकाशित अनुरोध",
    "needsEmptyTitle": "अझै कुनै अनुरोध प्रकाशित भएको छैन",
    "needsEmptyBody": "प्रमाणक पुष्टि गर्नासाथ अनुरोध यहाँ देखिन्छ। तपाईंको समुदायलाई मानिस चाहिएको छ भने आवश्यकता राख्नुहोस्, समीक्षामा जान्छ।",
    "seeExample": "नमुना अनुरोध हेर्नुहोस्",
    "backToNeeds": "← सबै आवश्यकतामा फर्कनु",
    "exampleNote": "नमुना ढाँचा। अझै कुनै प्रत्यक्ष अनुरोध प्रकाशित भएको छैन।",
    "whatToDo": "के गर्नुपर्ने हो",
    "detailBody": "वडा ७ का करिब ४० घर निरीक्षण गरी बस्न सुरक्षित छन् वा छैनन् मूल्याङ्कन गर्नुपर्ने। निष्कर्ष नगरपालिकाको मूल्याङ्कन फारममा राखी प्रत्येक साँझ वडा कार्यालयमा बुझाउनुपर्छ।",
    "detailTitle": "स्ट्रक्चरल इन्जिनियर — सिन्धुपाल्चोक, वडा ७",
    "detailMeta": "मेलम्ची नगरपालिका · बागमती प्रदेश · २ दिन अघि राखिएको",
    "verifiedBadge": "नगरपालिकाद्वारा प्रमाणित",
    "immediateBadge": "तत्काल — ०–७२ घण्टा",
    "positions": "पदहरू",
    "committed": "स्वयंसेवक प्रतिबद्ध",
    "iCanHelp": "म यसमा सहयोग गर्न सक्छु →",
    "interestNote": "इच्छा जनाउनु प्रतिबद्धता होइन। अनुरोधकर्ताले पहिले तपाईंलाई सम्पर्क गर्छ।",
    "trackerTitle": "प्रत्यक्ष प्रभाव ट्र्याकर",
    "trackerIntro": "सामूहिक क्षमताको गुमनाम, वास्तविक समयको गणना। यहाँ कुनै व्यक्तिगत विवरण देखाइँदैन।",
    "expertiseTitle": "विशेषज्ञता विभाजन",
    "fromTitle": "दर्ता भएका स्थान",
    "diasporaNote": "प्रवासी स्वयंसेवकहरू दूरबाटै सहयोग गर्न सक्छन् — मूल्याङ्कन समीक्षा, डिजाइन, कोष सङ्कलन, अनुवाद र समन्वय।",
    "demandTitle": "माग सारसंक्षेप",
    "projectsTitle": "चलिरहेका परियोजना",
    "projectsIntro": "एउटै आवश्यकता निरन्तर काममा बदलिँदा — विद्यालय पुनर्निर्माण, अस्थायी आश्रय, स्वास्थ्य शिविर — स्वयंसेवकहरू टोली बनाई हप्ता वा महिनासम्म सँगै काम गर्छन्।",
    "projectsEmptyTitle": "अझै कुनै परियोजना खुलेको छैन",
    "projectsEmptyBody": "प्रमाणित आवश्यकतालाई एकपटकको परिचालन नभई स्थायी टोली चाहिँदा परियोजना खुल्छ। प्रत्येक परियोजनामा संयोजक, टोली सूची, अवधि र सार्वजनिक प्रगति अभिलेख हुन्छ।",
    "proposeProject": "परियोजना आवश्यकता प्रस्ताव गर्नुहोस्",
    "networksTitle": "सीप नेटवर्क",
    "networksIntro": "आफ्नै विशेषज्ञता बाँड्ने मानिसहरूको नेटवर्कमा सामेल हुनुहोस् वा नयाँ बनाउनुहोस्। नेटवर्कले नगरपालिकालाई एक-एक व्यक्ति खोज्नुभन्दा पूरै विधासँग एकैचोटि पुग्न दिन्छ।",
    "joinNetwork": "नेटवर्कमा सामेल हुनु",
    "createNetwork": "नेटवर्क बनाउनु",
    "createNetworkBody": "तपाईंको विधा छुटेको छ? सुरु गर्नुहोस् — दर्ता गर्दा त्यो सीप भएका स्वयंसेवकलाई यहाँ पठाइन्छ।",
    "profileNote": "दर्ता पछि पाइने प्रोफाइलको नमुना।",
    "yourName": "तपाईंको नाम",
    "profileMeta": "मुख्य सीप · जिल्ला · उपलब्ध हुने मिति —",
    "completeness": "प्रोफाइल पूर्णता",
    "profileBody": "दर्ता भएपछि तपाईं प्रमाणित आवश्यकतामा इच्छा जनाउन, सीप नेटवर्कमा सामेल हुन वा बनाउन, कुनै पनि बेला उपलब्धता अद्यावधिक गर्न र मिल्दो अवसर प्राप्त गर्न सक्नुहुन्छ।",
    "registerArrow": "स्वयंसेवक दर्ता →",
    "adminTitle": "कमाण्ड सेन्टर",
    "adminIntro": "समन्वय टोलीको लागि ब्याक-एन्ड दृश्य: प्रमाणीकरण लाइन, म्याचिङ, परियोजना निगरानी र सरकार तथा साझेदारसँग व्यवस्थित हस्तान्तरण।",
    "handoverTitle": "डेटा हस्तान्तरण र रिपोर्टिङ",
    "handoverBody": "आवश्यक निकायसँग बाँडिने व्यवस्थित, प्रमाणित र छान्न मिल्ने अभिलेख।",
    "membersLabel": "सदस्य"
  }
} as const;

/** Every UI string key, widened to `string` so either language satisfies it. */
export type Dict = { readonly [K in keyof (typeof STR)["en"]]: string };

/** English -> Nepali lookup for data-table content held only in English. */
export const NP_MAP: Record<string, string> = {
  "Find the need": "आवश्यकता पत्ता लगाउनु",
  "Verify the need": "प्रमाणित गर्नु",
  "Find the right people": "सही व्यक्ति खोज्नु",
  "Connect them": "जोड्नु",
  "Track fulfilment": "पूर्णता ट्र्याक गर्नु",
  "People registered to help": "सहयोगका लागि दर्ता भएका",
  "Active verified requests": "सक्रिय प्रमाणित अनुरोध",
  "Volunteers matched": "मिलाइएका स्वयंसेवक",
  "Needs met": "पूरा भएका आवश्यकता",
  "People": "मानिस",
  "Skills": "सीप",
  "Time": "समय",
  "Equipment": "उपकरण",
  "Logistics": "ढुवानी",
  "Money": "आर्थिक",
  "Post a need": "आवश्यकता राख्नुहोस्",
  "Find volunteers": "स्वयंसेवक खोज्नु",
  "Manage requests": "अनुरोध व्यवस्थापन",
  "Track progress": "प्रगति ट्र्याक",
  "Landing": "गृहपृष्ठ",
  "Learn what the platform does and choose a path.": "प्लेटफर्मले के गर्छ बुझ्नु र बाटो छान्नु।",
  "Choose your path": "बाटो छान्नु",
  "I want to help, or I need help.": "मलाई सहयोग गर्नु छ, वा मलाई सहयोग चाहियो।",
  "Register / post": "दर्ता / अनुरोध",
  "Volunteer profile or need request.": "स्वयंसेवक प्रोफाइल वा आवश्यकता अनुरोध।",
  "Verification": "प्रमाणीकरण",
  "Reviewed by the platform team or a verified partner.": "प्लेटफर्म टोली वा प्रमाणित साझेदारद्वारा समीक्षा।",
  "Match & connect": "म्याच र जडान",
  "The matching engine connects people to verified needs.": "म्याचिङ इन्जिनले मानिसलाई प्रमाणित आवश्यकतासँग जोड्छ।",
  "Coordinate": "समन्वय",
  "Teams coordinate, share updates, complete the work.": "टोलीले समन्वय गर्छ, अद्यावधिक बाँड्छ, काम पूरा गर्छ।",
  "Track & impact": "ट्र्याक र प्रभाव",
  "Progress recorded and handed to stakeholders.": "प्रगति अभिलेख गरी सम्बद्ध पक्षलाई बुझाइन्छ।",
  "Submitted": "पेश गरिएको",
  "Under review": "समीक्षामा",
  "Verified": "प्रमाणित",
  "Recruiting": "भर्ती हुँदै",
  "Filled": "भरिएको",
  "Completed": "सम्पन्न",
  "government agency logo": "सरकारी निकायको लोगो",
  "municipality logo": "नगरपालिकाको लोगो",
  "NGO / INGO logo": "एनजीओ / आईएनजीओ लोगो",
  "hospital / health logo": "अस्पताल / स्वास्थ्य लोगो",
  "partner org logo": "साझेदार संस्थाको लोगो",
  "Volunteer": "स्वयंसेवक",
  "Request help": "सहयोग माग",
  "Platform": "प्लेटफर्म",
  "Register my skills": "मेरो सीप दर्ता",
  "My readiness profile": "मेरो तयारी प्रोफाइल",
  "Skill networks": "सीप नेटवर्क",
  "Active needs": "सक्रिय आवश्यकता",
  "Projects": "परियोजना",
  "Live impact tracker": "प्रत्यक्ष प्रभाव ट्र्याकर",
  "For partners": "साझेदारका लागि",
  "Awaiting verification": "प्रमाणीकरण पर्खाइमा",
  "Verified this week": "यो हप्ता प्रमाणित",
  "Open projects": "खुला परियोजना",
  "needs review": "समीक्षा आवश्यक",
  "published": "प्रकाशित",
  "across all districts": "सबै जिल्लामा",
  "with an assigned coordinator": "संयोजक तोकिएका",
  "All": "सबै",
  "Immediate": "तत्काल",
  "This week": "यो हप्ता",
  "Flagged": "चिन्ह लगाइएको",
  "Offer help or post a need": "सहयोग दिनुहोस् वा आवश्यकता राख्नुहोस्",
  "Requests are reviewed and clearly verified": "अनुरोधको समीक्षा हुन्छ र स्पष्ट रूपमा प्रमाणित हुन्छ",
  "People and resources are matched": "मानिस र स्रोत मिलाइन्छ",
  "Teams coordinate and track the work": "टोलीले समन्वय गर्छ र कामको ट्र्याक राख्छ",
  "Who verifies a request": "अनुरोध कसले प्रमाणित गर्छ",
  "Municipality and ward offices, partner NGOs and INGOs, and the platform's own coordination team.": "नगरपालिका र वडा कार्यालय, साझेदार एनजीओ तथा आईएनजीओ, र प्लेटफर्मको आफ्नै समन्वय टोली।",
  "If a request cannot be verified": "अनुरोध प्रमाणित हुन नसके",
  "It stays visible and stays labelled community-reported, verification pending — never presented as confirmed.": "त्यो देखिने रहन्छ र 'समुदायद्वारा रिपोर्ट, प्रमाणीकरण बाँकी' भनी लेबल गरिन्छ — कहिल्यै पुष्टि भएको भनी देखाइँदैन।",
  "How misuse is prevented": "दुरुपयोग कसरी रोकिन्छ",
  "Duplicate and unverifiable requests are closed, requesters are named and contactable, and volunteers are never asked to pay to take part.": "दोहोरो र प्रमाणित हुन नसक्ने अनुरोध बन्द गरिन्छ, अनुरोधकर्ताको नाम र सम्पर्क खुल्ला हुन्छ, र स्वयंसेवकसँग सहभागिताको शुल्क कहिल्यै मागिँदैन।",
  "What happens to your data": "तपाईंको डेटाको के हुन्छ",
  "Shared only with verified requesters and partner agencies, on the consent you give at registration, and withdrawable at any time.": "दर्ता गर्दा दिनुभएको सहमतिअनुसार प्रमाणित अनुरोधकर्ता र साझेदार निकायसँग मात्र बाँडिन्छ, र कुनै पनि बेला फिर्ता लिन सकिन्छ।",
  "Sign up": "खाता खोल्नु",
  "Account, contact and where you are based.": "खाता, सम्पर्क र तपाईं बस्ने ठाउँ।",
  "Tell us what you offer": "तपाईंले के दिन सक्नुहुन्छ भन्नुहोस्",
  "Skills, experience, certifications, and what you can bring.": "सीप, अनुभव, प्रमाणपत्र, र तपाईंले ल्याउन सक्ने कुरा।",
  "Say when and where": "कहिले र कहाँ भन्नुहोस्",
  "Availability, duration, on the ground or remote, how far you travel.": "उपलब्धता, अवधि, स्थलगत वा दूरबाट, कति टाढा यात्रा गर्नुहुन्छ।",
  "You are in the register": "तपाईं दर्तामा हुनुहुन्छ",
  "Consent, profile created, and matched opportunities start arriving.": "सहमति, प्रोफाइल तयार, र मिल्दा अवसर आउन थाल्छन्।",
  "Account for your organization, institution or community.": "तपाईंको संस्था, निकाय वा समुदायको खाता।",
  "Where the need is": "आवश्यकता कहाँ छ",
  "Province, district, municipality, ward and exact location.": "प्रदेश, जिल्ला, नगरपालिका, वडा र ठ्याक्कै स्थान।",
  "Skills, how many people, exactly what must be done, and how urgent.": "सीप, कति जना, ठ्याक्कै के गर्नुपर्ने, र कति अत्यावश्यक।",
  "Verified, then published — track it, update it, close it.": "प्रमाणित, अनि प्रकाशित — ट्र्याक गर्नुहोस्, अद्यावधिक गर्नुहोस्, बन्द गर्नुहोस्।",
  "People who fit are notified and express interest.": "मिल्ने व्यक्तिलाई सूचना जान्छ र उनीहरू इच्छा जनाउँछन्।",
  "Several can join one request; coordinators build the team.": "एउटै अनुरोधमा धेरै सामेल हुन सक्छन्; संयोजकले टोली बनाउँछन्।",
  "The team works, shares updates, marks progress.": "टोलीले काम गर्छ, अद्यावधिक बाँड्छ, प्रगति टिप्छ।",
  "Impact recorded and available for reporting.": "प्रभाव अभिलेख गरिन्छ र रिपोर्टिङका लागि उपलब्ध हुन्छ।",
  "Create an account with basic details.": "आधारभूत विवरणसहित खाता बनाउनु।",
  "Choose your contribution path": "योगदानको बाटो छान्नु",
  "Remotely, on the ground, time, equipment, logistics or financially.": "दूरबाट, स्थलगत, समय, उपकरण, ढुवानी वा आर्थिक।",
  "Volunteer profile": "स्वयंसेवक प्रोफाइल",
  "Personal information, location, contact, emergency contact.": "व्यक्तिगत विवरण, स्थान, सम्पर्क, आपत्कालीन सम्पर्क।",
  "Expertise and skills": "विशेषज्ञता र सीप",
  "Primary skill, sub-skills, years of experience, certifications.": "मुख्य सीप, उप-सीप, अनुभवका वर्ष, प्रमाणपत्र।",
  "Availability": "उपलब्धता",
  "Start date, duration, hours per week, maximum deployment.": "सुरु मिति, अवधि, साप्ताहिक घण्टा, अधिकतम परिचालन।",
  "Deployment preferences": "परिचालन प्राथमिकता",
  "On the ground, remote or both; anywhere or specific districts.": "स्थलगत, दूरबाट वा दुवै; कतै पनि वा निश्चित जिल्ला।",
  "What you can bring": "तपाईं के ल्याउन सक्नुहुन्छ",
  "Equipment, tools, vehicle, software, services, other resources.": "उपकरण, औजार, सवारी, सफ्टवेयर, सेवा, अन्य स्रोत।",
  "Additional information": "थप जानकारी",
  "Languages, past disaster experience, references.": "भाषा, विगतको विपद् अनुभव, सन्दर्भ।",
  "Consent and confirmation": "सहमति र पुष्टि",
  "Data usage policy and consent.": "डेटा प्रयोग नीति र सहमति।",
  "Profile created": "प्रोफाइल बन्यो",
  "You are part of the register, and can express interest in verified needs.": "तपाईं दर्तामा समावेश भइसक्नुभयो, र प्रमाणित आवश्यकतामा इच्छा जनाउन सक्नुहुन्छ।",
  "Create an account for your organization or community.": "तपाईंको संस्था वा समुदायको लागि खाता बनाउनु।",
  "Who are you": "तपाईं को हुनुहुन्छ",
  "Government, municipality, NGO, community, institution, business or individual.": "सरकार, नगरपालिका, एनजीओ, समुदाय, संस्था, व्यवसाय वा व्यक्ति।",
  "Location of the need": "आवश्यकताको स्थान",
  "What you need": "तपाईंलाई के चाहिन्छ",
  "Required skills, expertise and resources.": "आवश्यक सीप, विशेषज्ञता र स्रोत।",
  "Need details": "आवश्यकताको विवरण",
  "How many people, exactly what needs doing, and the objective.": "कति जना, ठ्याक्कै के गर्नुपर्ने, र उद्देश्य।",
  "Timeline and duration": "समयरेखा र अवधि",
  "Start date, duration, deadline.": "सुरु मिति, अवधि, अन्तिम म्याद।",
  "Support and logistics": "सहयोग र ढुवानी",
  "Accommodation, food, transport, equipment available.": "बास, खाना, यातायात, उपलब्ध उपकरण।",
  "Type of support": "सहयोगको प्रकार",
  "On the ground, remote or both; paid or unpaid.": "स्थलगत, दूरबाट वा दुवै; सशुल्क वा नि:शुल्क।",
  "Level of urgency": "अत्यावश्यकताको स्तर",
  "Immediate, urgent, upcoming or long-term reconstruction.": "तत्काल, अत्यावश्यक, आगामी वा दीर्घकालीन पुनर्निर्माण।",
  "Equipment needed, documents, images, other detail.": "आवश्यक उपकरण, कागजात, तस्बिर, अन्य विवरण।",
  "Submit for review": "समीक्षाका लागि पेश",
  "Verified, then published — you can track, update and close it.": "प्रमाणित भएपछि प्रकाशित — तपाईं ट्र्याक, अद्यावधिक र बन्द गर्न सक्नुहुन्छ।",
  "Skills and expertise": "सीप र विशेषज्ञता",
  "Location and mobility": "स्थान र गतिशीलता",
  "Availability and duration": "उपलब्धता र अवधि",
  "Language": "भाषा",
  "Equipment and resources": "उपकरण र स्रोत",
  "Experience level": "अनुभव स्तर",
  "Match found": "म्याच भेटियो",
  "Volunteers who fit are notified, see the detail and express interest.": "मिल्ने स्वयंसेवकलाई सूचना जान्छ, विवरण देख्छन् र इच्छा जनाउँछन्।",
  "Team formation": "टोली निर्माण",
  "Several volunteers can join the same request. Coordinators build teams.": "एउटै अनुरोधमा धेरै स्वयंसेवक सामेल हुन सक्छन्। संयोजकले टोली बनाउँछन्।",
  "Deploy and execute": "परिचालन र कार्यान्वयन",
  "The team coordinates, shares updates and marks progress.": "टोलीले समन्वय गर्छ, अद्यावधिक बाँड्छ र प्रगति टिप्छ।",
  "Complete and record": "सम्पन्न र अभिलेख",
  "Work completed, feedback shared, impact recorded for reporting.": "काम सम्पन्न, प्रतिक्रिया बाँडिएको, प्रभाव रिपोर्टिङका लागि अभिलेख।",
  "Location": "स्थान",
  "Need": "आवश्यकता",
  "People needed": "आवश्यक जनशक्ति",
  "Urgency": "अत्यावश्यकता",
  "Status": "स्थिति",
  "Action": "कार्य",
  "All provinces": "सबै प्रदेश",
  "All districts": "सबै जिल्ला",
  "All skills": "सबै सीप",
  "Any urgency": "कुनै पनि अत्यावश्यकता",
  "Any status": "कुनै पनि स्थिति",
  "Community-reported": "समुदायद्वारा रिपोर्ट",
  "Immediate (0–72 hrs)": "तत्काल (०–७२ घण्टा)",
  "Urgent (1 week)": "अत्यावश्यक (१ हप्ता)",
  "Upcoming (1 month)": "आगामी (१ महिना)",
  "Reconstruction": "पुनर्निर्माण",
  "Skill required": "आवश्यक सीप",
  "Structural engineering": "स्ट्रक्चरल इन्जिनियरिङ",
  "Licensed professional": "इजाजतप्राप्त व्यावसायिक",
  "Duration": "अवधि",
  "1 week": "१ हप्ता",
  "Start date": "सुरु मिति",
  "As soon as filled": "पद भरिनासाथ",
  "Accommodation": "बास",
  "Provided by municipality": "नगरपालिकाद्वारा उपलब्ध",
  "Food": "खाना",
  "Provided": "उपलब्ध",
  "Transport": "यातायात",
  "Reimbursed": "खर्च फिर्ता",
  "On the ground, unpaid": "स्थलगत, नि:शुल्क",
  "Total volunteers registered": "कुल दर्ता स्वयंसेवक",
  "Remote volunteers": "दूरबाट सहयोग गर्ने",
  "On the ground, need logistics": "स्थलगत, ढुवानी आवश्यक",
  "On the ground, self-supported": "स्थलगत, आत्मनिर्भर",
  "Time contributors": "समय दिने",
  "Engineering": "इन्जिनियरिङ",
  "Architecture": "आर्किटेक्चर",
  "Health & medical": "स्वास्थ्य र चिकित्सा",
  "Project management": "परियोजना व्यवस्थापन",
  "Water & sanitation": "खानेपानी र सरसफाई",
  "Other": "अन्य",
  "Nepal": "नेपाल",
  "India": "भारत",
  "Australia": "अस्ट्रेलिया",
  "United States": "संयुक्त राज्य",
  "UAE": "यूएई",
  "Other (45+ countries)": "अन्य (४५+ देश)",
  "Active requests": "सक्रिय अनुरोध",
  "Projects completed": "सम्पन्न परियोजना",
  "In progress": "चलिरहेको",
  "Team roster still open, coordinator assigned.": "टोली सूची खुला, संयोजक तोकिएको।",
  "Team deployed and reporting weekly.": "टोली परिचालित, साप्ताहिक रिपोर्ट।",
  "Work finished, impact recorded and handed over.": "काम सम्पन्न, प्रभाव अभिलेख र हस्तान्तरण।",
  "Engineering network": "इन्जिनियरिङ नेटवर्क",
  "Architecture network": "आर्किटेक्चर नेटवर्क",
  "Medical network": "चिकित्सा नेटवर्क",
  "WASH network": "वाश नेटवर्क",
  "Logistics network": "ढुवानी नेटवर्क",
  "Structural and civil engineers for damage assessment and retrofitting.": "क्षति मूल्याङ्कन र सुदृढीकरणका लागि स्ट्रक्चरल र सिविल इन्जिनियर।",
  "Designers working on safe, affordable and buildable reconstruction.": "सुरक्षित, किफायती र बनाउन सकिने पुनर्निर्माणमा काम गर्ने डिजाइनर।",
  "Doctors, nurses and paramedics for health camps and emergency cover.": "स्वास्थ्य शिविर र आपत्कालका लागि चिकित्सक, नर्स र प्यारामेडिक।",
  "Water, sanitation and hygiene specialists.": "खानेपानी, सरसफाई र स्वच्छता विशेषज्ञ।",
  "Transport, warehousing and supply-chain coordinators.": "यातायात, भण्डारण र आपूर्ति शृंखला संयोजक।",
  "Identity": "परिचय",
  "Name": "नाम",
  "District": "जिल्ला",
  "Pending": "बाँकी",
  "Expertise": "विशेषज्ञता",
  "Primary skill": "मुख्य सीप",
  "Experience": "अनुभव",
  "Certifications": "प्रमाणपत्र",
  "Available from": "उपलब्ध हुने मिति",
  "Hours per week": "साप्ताहिक घण्टा",
  "Max deployment": "अधिकतम परिचालन",
  "Deployment": "परिचालन",
  "Mode": "तरिका",
  "Travel": "यात्रा",
  "Preferred districts": "रुचाइएका जिल्ला",
  "Resources": "स्रोत",
  "Vehicle": "सवारी",
  "Activity": "गतिविधि",
  "Matched opportunities": "मिलेका अवसर",
  "Needs joined": "सामेल आवश्यकता",
  "Networks": "नेटवर्क",
  "Manage volunteers": "स्वयंसेवक व्यवस्थापन",
  "Register, filter by skill, location and availability.": "दर्ता; सीप, स्थान र उपलब्धता अनुसार छान्नु।",
  "All incoming needs with their full history.": "आउने सबै आवश्यकता र पूरा इतिहास।",
  "Verification & approvals": "प्रमाणीकरण र स्वीकृति",
  "Confirm needs with municipalities and partners.": "नगरपालिका र साझेदारसँग आवश्यकता पुष्टि।",
  "0 in queue": "० लाइनमा",
  "Matching & team formation": "म्याचिङ र टोली निर्माण",
  "Match verified needs to available people, build teams.": "प्रमाणित आवश्यकतालाई उपलब्ध व्यक्तिसँग मिलाउनु, टोली बनाउनु।",
  "Projects & coordination": "परियोजना र समन्वय",
  "Standing teams, rosters, durations and progress.": "स्थायी टोली, सूची, अवधि र प्रगति।",
  "Reports & analytics": "रिपोर्ट र विश्लेषण",
  "Where the demand is, where the gaps are.": "माग कहाँ छ, अन्तर कहाँ छ।",
  "Communications": "सञ्चार",
  "Notify matched volunteers and requesters.": "मिलेका स्वयंसेवक र अनुरोधकर्तालाई सूचना।",
  "0 sent": "० पठाइएको",
  "User management": "प्रयोगकर्ता व्यवस्थापन",
  "Roles, permissions and verifier accounts.": "भूमिका, अनुमति र प्रमाणक खाता।",
  "Data security & privacy": "डेटा सुरक्षा र गोपनीयता",
  "Consent records and controlled data sharing.": "सहमति अभिलेख र नियन्त्रित डेटा साझेदारी।",
  "Active": "सक्रिय",
  "Export volunteer database": "स्वयंसेवक डेटाबेस निर्यात",
  "Export request and project data": "अनुरोध र परियोजना डेटा निर्यात",
  "Filter by location, skill or availability": "स्थान, सीप वा उपलब्धता अनुसार छान्नु",
  "Impact reports and analytics": "प्रभाव रिपोर्ट र विश्लेषण",
  "Share with government and partners": "सरकार र साझेदारसँग साझेदारी",
  "Maintain data security and privacy": "डेटा सुरक्षा र गोपनीयता कायम",
  "Coordinate volunteers": "स्वयंसेवक समन्वय",
  "Keep records and lists": "अभिलेख र सूची राख्नु",
  "Translate": "अनुवाद",
  "Drive / arrange transport": "सवारी चलाउनु / यातायात मिलाउनु",
  "Manage a schedule": "तालिका व्यवस्थापन",
  "Raise funds": "कोष सङ्कलन",
  "I want to help": "मलाई सहयोग गर्नु छ",
  "I need volunteers / help": "मलाई स्वयंसेवक / सहयोग चाहियो",
  "I can help": "म सहयोग गर्न सक्छु",
  "I need support": "मलाई सहयोग चाहियो",
  "Register your skills, time and resources": "तपाईंको सीप, समय र स्रोत दर्ता गर्नुहोस्",
  "Tell us exactly what you need": "तपाईंलाई ठ्याक्कै के चाहिएको छ बताउनुहोस्",
  "Detail is what makes this work. With enough of it, a municipality can be told precisely who is available, where they are, and from when. Only your name, skill and district are required.": "विवरणले नै यसलाई काम गर्ने बनाउँछ। पर्याप्त विवरण भए नगरपालिकालाई को उपलब्ध छ, कहाँ छ र कहिलेदेखि छ ठ्याक्कै बताउन सकिन्छ। नाम, सीप र जिल्ला मात्र अनिवार्य छ।",
  "The more precisely a need is described, the faster it gets filled. Every request is reviewed before it is published, and you can update or close it at any time.": "आवश्यकता जति स्पष्ट लेखिन्छ, त्यति छिटो पूरा हुन्छ। प्रत्येक अनुरोध प्रकाशित हुनु अघि समीक्षा हुन्छ, र तपाईं कुनै पनि बेला अद्यावधिक वा बन्द गर्न सक्नुहुन्छ।",
  "I consent to my details being shared with verified requesters, government agencies and partner organizations for the purpose of coordinating relief and reconstruction.": "राहत र पुनर्निर्माण समन्वयका लागि मेरो विवरण प्रमाणित अनुरोधकर्ता, सरकारी निकाय र साझेदार संस्थासँग बाँड्न मेरो सहमति छ।",
  "I confirm this request is genuine and that I am authorised to make it on behalf of the organization named above.": "यो अनुरोध वास्तविक हो र माथि उल्लेखित संस्थाको तर्फबाट गर्न म अधिकारप्राप्त छु भनी पुष्टि गर्दछु।",
  "Create my profile": "मेरो प्रोफाइल बनाउनु",
  "Submit request for review": "समीक्षाका लागि अनुरोध पेश",
  "Your details": "तपाईंको विवरण",
  "Required": "अनिवार्य",
  "Optional": "वैकल्पिक",
  "Choose all that apply": "लागू हुने सबै छान्नुहोस्",
  "Be specific": "स्पष्ट हुनुहोस्",
  "What you can provide": "तपाईं के दिन सक्नुहुन्छ",
  "Full name": "पूरा नाम",
  "Email": "इमेल",
  "Phone / WhatsApp": "फोन / व्हाट्सएप",
  "Where you are based": "तपाईं बस्ने ठाउँ",
  "Emergency contact": "आपत्कालीन सम्पर्क",
  "Your contribution path": "तपाईंको योगदानको बाटो",
  "How you can contribute": "कसरी योगदान गर्न सक्नुहुन्छ",
  "I can help remotely": "म दूरबाट सहयोग गर्न सक्छु",
  "I can travel": "म यात्रा गर्न सक्छु",
  "I can contribute time": "म समय दिन सक्छु",
  "I can provide equipment": "म उपकरण दिन सक्छु",
  "I can contribute logistics": "म ढुवानीमा सहयोग गर्न सक्छु",
  "I can support financially": "म आर्थिक सहयोग गर्न सक्छु",
  "Years of experience": "अनुभवका वर्ष",
  "Sub-skills": "उप-सीप",
  "Certifications and licences": "प्रमाणपत्र र इजाजत",
  "Duration you can commit": "दिन सक्ने अवधि",
  "Maximum single deployment": "अधिकतम एक परिचालन",
  "Where you can work": "काम गर्न सक्ने ठाउँ",
  "On the ground": "स्थलगत",
  "Remote": "दूरबाट",
  "Both": "दुवै",
  "Anywhere in Nepal": "नेपालभर कतै पनि",
  "Specific districts only": "निश्चित जिल्लामा मात्र",
  "Within my district only": "मेरो जिल्लाभित्र मात्र",
  "Details": "विवरण",
  "Languages": "भाषा",
  "Past experience in disaster response": "विपद् प्रतिकार्यमा विगतको अनुभव",
  "References": "सन्दर्भ",
  "You are posting as": "तपाईं कसको रूपमा राख्दै हुनुहुन्छ",
  "Organization name": "संस्थाको नाम",
  "Contact person": "सम्पर्क व्यक्ति",
  "Phone / email": "फोन / इमेल",
  "Province": "प्रदेश",
  "Municipality": "नगरपालिका",
  "Ward": "वडा",
  "Exact location": "ठ्याक्कै स्थान",
  "Skills required": "आवश्यक सीप",
  "Resources required": "आवश्यक स्रोत",
  "How many people": "कति जना",
  "Experience level required": "आवश्यक अनुभव स्तर",
  "Exactly what needs to be done": "ठ्याक्कै के गर्नुपर्ने हो",
  "Objectives / what success looks like": "उद्देश्य / सफलता कस्तो देखिन्छ",
  "Deadline": "अन्तिम म्याद",
  "Equipment available on site": "स्थलमा उपलब्ध उपकरण",
  "Where the work happens": "काम कहाँ हुन्छ",
  "Paid or unpaid": "सशुल्क वा नि:शुल्क",
  "How urgent is this": "यो कति अत्यावश्यक छ",
  "Urgent": "अत्यावश्यक",
  "Upcoming": "आगामी",
  "Anything else volunteers should know": "स्वयंसेवकले जान्नुपर्ने अन्य कुरा",
  "Documents or photographs": "कागजात वा तस्बिर",
  "Government agency": "सरकारी निकाय",
  "Municipality / ward": "नगरपालिका / वडा",
  "NGO / INGO": "एनजीओ / आईएनजीओ",
  "Community group": "समुदायिक समूह",
  "Institution (school, hospital)": "संस्था (विद्यालय, अस्पताल)",
  "Business": "व्यवसाय",
  "Individual": "व्यक्ति",
  "Select": "छान्नुहोस्",
  "Select district": "जिल्ला छान्नुहोस्",
  "Select province": "प्रदेश छान्नुहोस्",
  "Any": "कुनै पनि",
  "Some experience": "केही अनुभव",
  "Qualified professional": "योग्य व्यावसायिक",
  "Senior / licensed": "वरिष्ठ / इजाजतप्राप्त",
  "Not provided": "उपलब्ध छैन",
  "Can arrange if needed": "आवश्यक भए मिलाउन सकिन्छ",
  "Unpaid / volunteer": "नि:शुल्क / स्वयंसेवा",
  "Expenses covered": "खर्च व्यहोरिने",
  "Paid engagement": "सशुल्क संलग्नता",
  "Engineering (structural / civil)": "इन्जिनियरिङ (स्ट्रक्चरल / सिविल)",
  "Water & sanitation (WASH)": "खानेपानी र सरसफाई (वाश)",
  "Logistics & transport": "ढुवानी र यातायात",
  "Construction & trades": "निर्माण र सीपमूलक काम",
  "Education & child support": "शिक्षा र बालबालिका सहयोग",
  "Psychosocial support": "मनोसामाजिक सहयोग",
  "Translation": "अनुवाद",
  "IT & data": "आईटी र डेटा",
  "Tools": "औजार",
  "Software / licences": "सफ्टवेयर / इजाजत",
  "Professional services": "व्यावसायिक सेवा",
  "Warehouse / storage": "गोदाम / भण्डारण",
  "Vehicles": "सवारी साधन",
  "Materials": "सामग्री",
  "Medical supplies": "औषधि तथा चिकित्सा सामग्री",
  "Tents / shelter": "पाल / आश्रय",
  "Food and water": "खाना र पानी",
  "Funding": "कोष",
  "Nepali": "नेपाली",
  "English": "अंग्रेजी",
  "Newar": "नेवार",
  "Maithili": "मैथिली",
  "Tamang": "तामाङ",
  "Hindi": "हिन्दी",
  "A few days": "केही दिन",
  "1–2 weeks": "१–२ हप्ता",
  "1 month": "१ महिना",
  "3 months": "३ महिना",
  "Ongoing": "निरन्तर",
  "Up to 5": "५ सम्म",
  "5–15": "५–१५",
  "15–30": "१५–३०",
  "Full time": "पूर्ण समय",
  "3 days": "३ दिन",
  "2 weeks": "२ हप्ता",
  "1 month or more": "१ महिना वा बढी",
  "Under 2": "२ भन्दा कम",
  "2–5": "२–५",
  "5–10": "५–१०",
  "10–20": "१०–२०",
  "20+": "२०+",
  "1–3 days": "१–३ दिन",
  "Longer / ongoing project": "लामो / निरन्तर परियोजना",
  "Kathmandu": "काठमाडौं",
  "Lalitpur": "ललितपुर",
  "Bhaktapur": "भक्तपुर",
  "Sindhupalchok": "सिन्धुपाल्चोक",
  "Rasuwa": "रसुवा",
  "Kavre": "काभ्रे",
  "Nuwakot": "नुवाकोट",
  "Dolakha": "दोलखा",
  "Gorkha": "गोरखा",
  "Other / outside Nepal": "अन्य / नेपाल बाहिर",
  "Koshi": "कोशी",
  "Madhesh": "मधेश",
  "Bagmati": "बागमती",
  "Gandaki": "गण्डकी",
  "Lumbini": "लुम्बिनी",
  "Karnali": "कर्णाली",
  "Sudurpashchim": "सुदूरपश्चिम",
  "Helps verifiers prioritise you for technical assessments.": "प्राविधिक मूल्याङ्कनका लागि प्रमाणकहरूले तपाईंलाई प्राथमिकता दिन सजिलो हुन्छ।",
  "Individual requests are published as community-reported, verification pending.": "व्यक्तिगत अनुरोध 'समुदायद्वारा रिपोर्ट, प्रमाणीकरण बाँकी' भनी प्रकाशित हुन्छ।",
  "As on your ID": "परिचयपत्रमा भएअनुसार",
  "Name and phone number": "नाम र फोन नम्बर",
  "DD / MM / YYYY": "दिन / महिना / वर्ष",
  "e.g. seismic retrofitting, damage assessment": "जस्तै भूकम्पीय सुदृढीकरण, क्षति मूल्याङ्कन",
  "Council registration number, certifications": "काउन्सिल दर्ता नम्बर, प्रमाणपत्र",
  "List districts, if any": "जिल्ला उल्लेख गर्नुहोस्, भए",
  "Describe what you can bring, quantities, and any conditions.": "तपाईं के ल्याउन सक्नुहुन्छ, कति परिमाण र कुनै सर्त भए लेख्नुहोस्।",
  "Where, when, and in what role.": "कहाँ, कहिले र कुन भूमिकामा।",
  "Name and contact of someone who can vouch for your work": "तपाईंको कामको पुष्टि गर्न सक्ने व्यक्तिको नाम र सम्पर्क",
  "Full registered name": "पूरा दर्ता नाम",
  "Name and role": "नाम र भूमिका",
  "How volunteers reach you": "स्वयंसेवकले तपाईंलाई कसरी सम्पर्क गर्ने",
  "Municipality or rural municipality": "नगरपालिका वा गाउँपालिका",
  "Ward number": "वडा नम्बर",
  "Landmark, or paste map coordinates": "चिनारी स्थान, वा नक्सा कोअर्डिनेट",
  "e.g. 4": "जस्तै ४",
  "When this must be completed by": "यो कहिलेसम्म सम्पन्न हुनुपर्छ",
  "Inspect approximately 40 houses in Ward 7 and assess whether they are safe for occupation.": "वडा ७ का करिब ४० घर निरीक्षण गरी बस्न सुरक्षित छन् वा छैनन् मूल्याङ्कन गर्नुपर्ने।",
  "All houses assessed and results handed to the ward office.": "सबै घरको मूल्याङ्कन र नतिजा वडा कार्यालयमा बुझाइएको।",
  "What volunteers will find there, and what they should bring.": "स्वयंसेवकले त्यहाँ के पाउनेछन्, र के ल्याउनुपर्छ।",
  "Access conditions, security, permissions, documents.": "पहुँचको अवस्था, सुरक्षा, अनुमति, कागजात।",
  "Paste a link to photos, assessments or permits": "तस्बिर, मूल्याङ्कन वा अनुमतिपत्रको लिंक राख्नुहोस्",
  "you@example.com": "you@example.com",
  "0–72 hours": "०–७२ घण्टा",
  "within 1 week": "१ हप्ताभित्र",
  "within 1 month": "१ महिनाभित्र",
  "long term": "दीर्घकालीन",
  "0 published requests": "० प्रकाशित अनुरोध"
};
