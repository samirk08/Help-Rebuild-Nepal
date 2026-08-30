import { DISTRICTS, SKILLS } from "./content";

/**
 * Presentational tables that lived in the prototype's render pass.
 * Everything here is English-source and goes through `translator(lang)` at render.
 */

export type Status = { label: string; color: string };

export const STATUSES: Status[] = [
  { label: "Submitted", color: "var(--amber)" },
  { label: "Under review", color: "var(--blue)" },
  { label: "Verified", color: "var(--green)" },
  { label: "Recruiting", color: "var(--purple)" },
  { label: "Filled", color: "var(--ink)" },
  { label: "Completed", color: "var(--faint-2)" },
];

export const HOW_STEPS = [
  { n: "01", title: "Offer help or post a need" },
  { n: "02", title: "A municipality or partner checks it" },
  { n: "03", title: "We match people and resources" },
  { n: "04", title: "Teams coordinate and record the work" },
];

export const TRUST_ITEMS = [
  {
    k: "Who verifies a request",
    v: "Municipality and ward offices, partner NGOs and INGOs, and our own coordination team.",
  },
  {
    k: "If a request cannot be verified",
    v: "It stays visible, labelled community-reported, and is never shown as confirmed.",
  },
  {
    k: "How misuse is prevented",
    v: "Duplicate requests are closed, requesters are named and contactable, and volunteers are never asked to pay.",
  },
  {
    k: "What happens to your data",
    v: "Shared only with verified requesters and partner agencies, on the consent you give at registration. Withdrawable at any time.",
  },
];

export const MATCH_ON = [
  "Skills and expertise",
  "Location and mobility",
  "Availability and duration",
  "Type of support",
  "Language",
  "Equipment and resources",
  "Experience level",
];

export const ORGANIZE_OPTIONS = [
  "Coordinate volunteers",
  "Keep records and lists",
  "Translate",
  "Drive / arrange transport",
  "Manage a schedule",
  "Raise funds",
];

export const NEED_FILTERS: Array<{ label: string; options: string[] }> = [
  {
    label: "Province",
    options: [
      "All provinces",
      "Bagmati",
      "Gandaki",
      "Koshi",
      "Karnali",
      "Lumbini",
      "Madhesh",
      "Sudurpashchim",
    ],
  },
  { label: "District", options: ["All districts", ...DISTRICTS.slice(1)] },
  { label: "Skill required", options: ["All skills", ...SKILLS] },
  {
    label: "Urgency",
    options: [
      "Any urgency",
      "Immediate (0–72 hrs)",
      "Urgent (1 week)",
      "Upcoming (1 month)",
      "Reconstruction",
    ],
  },
  {
    label: "Status",
    options: ["Any status", "Verified", "Recruiting", "Filled", "Completed", "Community-reported"],
  },
];

export const NEED_COLUMNS = [
  "Location",
  "Need",
  "People needed",
  "Urgency",
  "Status",
  "Action",
];

export const DETAIL_FACTS = [
  { k: "Skill required", v: "Structural engineering" },
  { k: "Experience level", v: "Licensed professional" },
  { k: "Duration", v: "1 week" },
  { k: "Start date", v: "As soon as filled" },
  { k: "Accommodation", v: "Provided by municipality" },
  { k: "Food", v: "Provided" },
  { k: "Transport", v: "Reimbursed" },
  { k: "Type of support", v: "On the ground, unpaid" },
];

export const DIALOG_FACTS = [
  { k: "Skill required", v: "Structural engineering" },
  { k: "People needed", v: "4" },
  { k: "Duration", v: "1 week" },
  { k: "Support", v: "Accommodation and food provided" },
];

export const EXPERTISE = [
  "Engineering",
  "Architecture",
  "Health & medical",
  "Project management",
  "Water & sanitation",
  "Logistics",
  "Other",
];

export const LOCATIONS = [
  "Nepal",
  "India",
  "Australia",
  "United States",
  "UAE",
  "Other (45+ countries)",
];

export const DEMAND = [
  { label: "Active requests", value: "0" },
  { label: "People needed", value: "0" },
  { label: "Volunteers matched", value: "0" },
  { label: "Needs met", value: "0" },
  { label: "Projects completed", value: "0" },
];

export const PROJECT_PHASES = [
  { stage: "Recruiting", body: "Team roster still open, coordinator assigned." },
  { stage: "In progress", body: "Team deployed and reporting weekly." },
  { stage: "Completed", body: "Work finished, results recorded and handed over." },
];

export const NETWORKS = [
  {
    name: "Engineering network",
    body: "Structural and civil engineers for damage assessment and retrofitting.",
  },
  {
    name: "Architecture network",
    body: "Designers working on safe, affordable and buildable reconstruction.",
  },
  {
    name: "Medical network",
    body: "Doctors, nurses and paramedics for health camps and emergency cover.",
  },
  { name: "WASH network", body: "Water, sanitation and hygiene specialists." },
  { name: "Logistics network", body: "Transport, warehousing and supply-chain coordinators." },
];

export const PROFILE_CARDS = [
  {
    title: "Identity",
    rows: [
      { k: "Name", v: "—" },
      { k: "District", v: "—" },
      { k: "Verified", v: "Pending" },
    ],
  },
  {
    title: "Expertise",
    rows: [
      { k: "Primary skill", v: "—" },
      { k: "Experience", v: "—" },
      { k: "Certifications", v: "—" },
    ],
  },
  {
    title: "Availability",
    rows: [
      { k: "Available from", v: "—" },
      { k: "Hours per week", v: "—" },
      { k: "Max deployment", v: "—" },
    ],
  },
  {
    title: "Deployment",
    rows: [
      { k: "Mode", v: "—" },
      { k: "Travel", v: "—" },
      { k: "Preferred districts", v: "—" },
    ],
  },
  {
    title: "Resources",
    rows: [
      { k: "Equipment", v: "—" },
      { k: "Vehicle", v: "—" },
      { k: "Other", v: "—" },
    ],
  },
  {
    title: "Activity",
    rows: [
      { k: "Matched opportunities", v: "0" },
      { k: "Needs joined", v: "0" },
      { k: "Networks", v: "0" },
    ],
  },
];

export const PARTNER_STATS = [
  {
    label: "Awaiting verification",
    value: "0",
    note: "needs review",
    color: "var(--amber)",
  },
  { label: "Verified this week", value: "0", note: "published", color: "var(--green)" },
  {
    label: "Volunteers matched",
    value: "0",
    note: "across all districts",
    color: "var(--navy)",
  },
  {
    label: "Open projects",
    value: "0",
    note: "with an assigned coordinator",
    color: "var(--red)",
  },
];

export const QUEUE_FILTERS = ["All", "Immediate", "This week", "Flagged"];

export const ADMIN_MODULES = [
  {
    title: "Manage volunteers",
    count: "0",
    body: "Register, filter by skill, location and availability.",
  },
  { title: "Manage requests", count: "0", body: "All incoming needs with their full history." },
  {
    title: "Verification & approvals",
    count: "0 in queue",
    body: "Confirm needs with municipalities and partners.",
  },
  {
    title: "Matching & team formation",
    count: "0",
    body: "Match verified needs to available people, build teams.",
  },
  {
    title: "Projects & coordination",
    count: "0",
    body: "Standing teams, rosters, durations and progress.",
  },
  { title: "Reports & analytics", count: "—", body: "Where the demand is, where the gaps are." },
  { title: "Communications", count: "0 sent", body: "Notify matched volunteers and requesters." },
  { title: "User management", count: "0", body: "Roles, permissions and verifier accounts." },
  {
    title: "Data security & privacy",
    count: "Active",
    body: "Consent records and controlled data sharing.",
  },
];

export const EXPORTS = [
  "Export volunteer database",
  "Export request and project data",
  "Filter by location, skill or availability",
  "Reports on what is needed and where",
  "Share with government and partners",
  "Maintain data security and privacy",
];

export const FOOTER_COLUMNS: Array<{
  title: string;
  items: Array<{ label: string; screen: string }>;
}> = [
  {
    title: "Volunteer",
    items: [
      { label: "Register my skills", screen: "volunteer" },
      { label: "My profile", screen: "profile" },
      { label: "Skill networks", screen: "networks" },
    ],
  },
  {
    title: "Request help",
    items: [
      { label: "Post a need", screen: "post" },
      { label: "Active needs", screen: "needs" },
      { label: "Relief items", screen: "relief" },
      { label: "Projects", screen: "projects" },
    ],
  },
  {
    title: "More",
    items: [
      { label: "Live numbers", screen: "tracker" },
      { label: "For partners", screen: "partners" },
    ],
  },
];

/** The one worked example the design ships, used by the dialog and the detail page. */
export const EXAMPLE_NEED_ID = "example";

export const PMDRF_URL = "https://pmdrf.nchl.com.np/";
