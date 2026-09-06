export const ENGINE_VERSION = "rules-v1";
export const OPEN_NEED_STATUSES = ["verified", "recruiting"];
export const REVIEWED_VOLUNTEER_STATUSES = ["verified", "recruiting", "filled", "completed"];

export type Check = {
  key: string;
  result: "pass" | "fail" | "unknown";
  reason: string;
  question?: string;
};
export type WorkMode = "remote" | "onsite" | "either" | "hybrid";
export type Facts = {
  skills: string[] | null;
  specialties: string[];
  workMode: "remote" | "onsite" | "both" | null;
  district: string | null;
  travel: "anywhere" | "local" | "districts" | null;
  travelDistricts: string[];
  availableFrom: string | null;
  availableUntil: string | null;
  hoursPerWeek: number | null;
  maxDeploymentDays: number | null;
  experienceYears: number | null;
};
export type Profile = {
  volunteer_id: string;
  facts: Facts;
  paused: boolean;
  mission_ids: string[];
  mission_only: boolean;
  verified_qualifications: string[];
  confirmed_at: string;
  revision: number;
};
export type Submission = {
  id: string;
  kind: string;
  status: string;
  org_or_name: string | null;
  contact_email: string | null;
  district: string | null;
  fields: Record<string, unknown>;
  created_at: string;
  user_id?: string | null;
};
export type RoleConfig = {
  skills: string[];
  workMode: WorkMode;
  district: string | null;
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
  minExperienceYears: number | null;
  qualifications: string[];
  preferredSpecialties: string[];
  preferLocal: boolean;
  missionIds: string[];
};
export type Role = {
  id: string;
  need_id: string;
  title: string;
  headcount: number;
  config: RoleConfig;
  revision: number;
  active: boolean;
};
export type Invitation = {
  id: string;
  role_id: string;
  volunteer_id: string;
  need_id: string;
  status: "queued" | "sent" | "accepted" | "declined" | "expired" | "cancelled" | "confirmed";
  created_at: string;
  expires_at: string;
  role_revision: number;
};
export type Commitment = {
  needId: string;
  volunteerId: string;
  startDate: string | null;
  endDate: string | null;
  hoursPerWeek: number | null;
};
export type Context = {
  now: string;
  needStatus: string;
  profiles: Map<string, Profile>;
  interestedUserIds: Set<string>;
  invitations: Invitation[];
  commitments: Commitment[];
};
export type Recommendation = {
  volunteerId: string;
  name: string;
  category: "ready" | "clarify" | "excluded";
  checks: Check[];
  priority: number[];
  reasons: string[];
  profileRevision: number;
  engineVersion: string;
};
