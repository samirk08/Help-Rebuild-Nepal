import MatchingProfileEditor from "./MatchingProfileEditor";
import { getMatchingProfile } from "@/lib/matching/data";
import { currentVolunteer } from "@/lib/volunteer-auth";
import { supabaseAdmin } from "@/lib/supabase";

export default async function OwnMatchingProfile({ id, lang }: {id:string;lang:"en"|"np"}) {
  const user = await currentVolunteer();
  if (!user) return null;
  const { data } = await supabaseAdmin().from("submissions").select("*").eq("id",id).eq("user_id",user.id).eq("kind","volunteer").maybeSingle();
  if (!data) return null;
  const matching = await getMatchingProfile(id);
  if (!matching.available) return null;
  return <MatchingProfileEditor key={matching.profile?.revision ?? 0} volunteer={data} profile={matching.profile} lang={lang}/>;
}
