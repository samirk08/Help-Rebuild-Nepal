import type { Context, Profile, Role, Submission } from "../lib/matching/types";

export const now = "2026-09-06T12:00:00.000Z";
export function volunteer(id = "asha", overrides:Partial<Submission> = {}):Submission {
  return {id,kind:"volunteer",status:"verified",org_or_name:id,contact_email:`${id}@example.org`,district:null,created_at:now,user_id:`user-${id}`,fields:{consent:"on"},...overrides};
}
export function profile(id = "asha", overrides:Partial<Profile> = {}):Profile {
  return {volunteer_id:id,revision:1,confirmed_at:now,paused:false,mission_ids:[],mission_only:false,verified_qualifications:[],facts:{skills:["engineering"],specialties:[],workMode:"remote",district:null,travel:null,travelDistricts:[],availableFrom:"2026-09-01",availableUntil:"2026-10-01",hoursPerWeek:10,maxDeploymentDays:null,experienceYears:null},...overrides};
}
export function role():Role {
  return {id:"role-housing",need_id:"need-housing",title:"Remote housing engineer",headcount:1,active:true,revision:1,config:{skills:["engineering"],workMode:"remote",district:null,startDate:"2026-09-10",endDate:"2026-09-23",hoursPerWeek:5,minExperienceYears:null,qualifications:[],preferredSpecialties:[],preferLocal:false,missionIds:[]}};
}
export function context(profiles:Profile[] = [profile()]):Context {
  return {now,needStatus:"verified",profiles:new Map(profiles.map(p => [p.volunteer_id,p])),interestedUserIds:new Set(),invitations:[],commitments:[]};
}
