import { supabaseAdmin } from "../supabase";
import { recommend } from "./engine";
import type { Context, Profile, Role, Submission, Invitation, Commitment } from "./types";

type DbError = { code?: string; message: string };
async function collect<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []) as T[]);
    if (!data || data.length < 500) return rows;
  }
}
export function missingMigration(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && ["42P01", "PGRST205", "42703"].includes(String(error.code));
}
export async function getMatchingProfile(id: string): Promise<{ available: boolean; profile: Profile | null }> {
  const { data, error } = await supabaseAdmin().from("matching_profiles").select("*").eq("volunteer_id", id).maybeSingle();
  if (error && missingMigration(error)) return { available: false, profile: null };
  if (error) throw new Error("Matching details could not be loaded.");
  return { available: true, profile: data as Profile | null };
}

export async function loadMatching(need: Submission) {
  const db = supabaseAdmin();
  const [volunteers, profiles, roles, invitations, matches, allocations, interests] = await Promise.all([
    collect<Submission>((a,b) => db.from("submissions").select("id,kind,status,org_or_name,contact_email,district,fields,created_at,user_id").eq("kind", "volunteer").order("id").range(a,b)),
    collect<Profile>((a,b) => db.from("matching_profiles").select("*").order("volunteer_id").range(a,b)),
    collect<Role>((a,b) => db.from("matching_roles").select("*").eq("need_id", need.id).order("id").range(a,b)),
    collect<Invitation>((a,b) => db.from("matching_invitations").select("id,role_id,need_id,volunteer_id,status,created_at,expires_at,role_revision").order("id").range(a,b)),
    collect<{ id:string; need_id:string; volunteer_id:string; status:string }>((a,b) => db.from("matches").select("id,need_id,volunteer_id,status").in("status", ["verified","recruiting","filled"]).order("id").range(a,b)),
    collect<{ match_id:string; start_date:string; end_date:string; hours_per_week:number }>((a,b) => db.from("matching_commitments").select("match_id,start_date,end_date,hours_per_week").order("match_id").range(a,b)),
    collect<{ user_id: string | null }>((a,b) => db.from("interests").select("user_id,id").eq("need_id", need.id).order("id").range(a,b)),
  ]);
  const byMatch = new Map(allocations.map(a => [a.match_id, a]));
  const commitments: Commitment[] = matches.map(m => {
    const allocation = byMatch.get(m.id);
    return { needId:m.need_id, volunteerId:m.volunteer_id, startDate:allocation?.start_date ?? null, endDate:allocation?.end_date ?? null, hoursPerWeek:allocation?.hours_per_week ?? null };
  });
  const context: Context = {
    now: new Date().toISOString(), needStatus:need.status, profiles:new Map(profiles.map(p => [p.volunteer_id,p])),
    interestedUserIds:new Set(interests.flatMap(i => i.user_id ? [i.user_id] : [])), invitations, commitments,
  };
  return { volunteers, roles, context, recommendations:roles.map(role => ({ role, result:recommend(role, volunteers, context) })) };
}

export async function getNeed(id: string): Promise<Submission & { matching_contact_approved: boolean }> {
  const { data, error } = await supabaseAdmin().from("submissions").select("*").eq("id",id).eq("kind","need").single();
  if (error || !data) throw new Error("Need unavailable.");
  return data;
}

export async function getNeeds(ids: string[]): Promise<(Submission & { matching_contact_approved: boolean })[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin().from("submissions").select("*").eq("kind","need").in("id",ids);
  if (error || !data) throw new Error("Needs unavailable.");
  return data;
}
