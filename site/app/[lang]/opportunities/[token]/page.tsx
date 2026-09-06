import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MatchingActionForm from "@/components/MatchingActionForm";
import { respondToMatchingInvitation } from "@/lib/matching/actions";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicNeed } from "@/lib/public-needs";
import { isLang } from "@/lib/i18n";
import type { Role } from "@/lib/matching/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title:"Your HRN opportunity", robots:{index:false,follow:false},referrer:"no-referrer" };

export default async function OpportunityPage({params}:{params:Promise<{lang:string;token:string}>}) {
  const {lang,token} = await params;
  if (!isLang(lang) || !/^[a-f0-9]{64}$/.test(token)) notFound();
  const tr = (en:string,np:string) => lang === "np" ? np : en;
  const db = supabaseAdmin();
  const {data:i,error} = await db.from("matching_invitations").select("role_id,need_id,status,expires_at,role_revision").eq("token_hash",createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (error || !i) notFound();
  const [{data:raw},need] = await Promise.all([db.from("matching_roles").select("*").eq("id",i.role_id).single(),getPublicNeed(i.need_id)]);
  const role = raw as Role|null;
  const active = role && need && role.active && role.revision === i.role_revision && ["verified","recruiting"].includes(need.status) && ["queued","sent"].includes(i.status) && Date.parse(i.expires_at)>Date.now();
  return <div className="page page--narrow"><section className="matching-panel">
    <h1>{tr("Your opportunity","तपाईंको अवसर")}</h1>
    {!active ? <p role="status">{i.status === "accepted" || i.status === "confirmed" ? tr("Your interest has been recorded. Please coordinate with the team about next steps.","तपाईंको रुचि दर्ता भएको छ। अबका चरणका लागि टोलीसँग समन्वय गर्नुहोस्।") : tr("This invitation is no longer active. Thank you for your willingness to help.","यो निमन्त्रणा अब सक्रिय छैन। सहयोग गर्ने इच्छाका लागि धन्यवाद।")}</p> : <>
      <h2>{role.title}</h2><p>{role.config.startDate} – {role.config.endDate} · {role.config.hoursPerWeek} {tr("hours/week","घण्टा/हप्ता")} · {role.config.workMode}</p>
      <p>{need.whatToDo}</p>
      <p>{tr("Support","उपलब्ध सहयोग")}: {[need.accommodation && `${tr("Accommodation","आवास")}: ${need.accommodation}`,need.food && `${tr("Food","खाना")}: ${need.food}`,need.transport && `${tr("Transport","यातायात")}: ${need.transport}`].filter(Boolean).join(" · ") || tr("Confirm arrangements with the requester.","अनुरोधकर्तासँग व्यवस्था पुष्टि गर्नुहोस्।")}</p>
      <Link href={`/${lang}/needs/${need.id}`}>{tr("Read the full request","पूरा अनुरोध पढ्नुहोस्")}</Link>
      <p>{tr("Proceed expresses interest. The coordination team will confirm the connection with both parties.","अगाडि बढ्दा तपाईंको रुचि जनाइन्छ। समन्वय टोलीले दुवै पक्षसँग सम्बन्ध पुष्टि गर्नेछ।")}</p>
      <MatchingActionForm action={respondToMatchingInvitation} label={tr("Proceed","अगाडि बढ्नुहोस्")} lang={lang}><input type="hidden" name="token" value={token}/><input type="hidden" name="response" value="accepted"/><label className="matching-check"><input type="checkbox" name="confirmAvailability" required/>{tr("I can meet these dates and hours, including arriving on time for any on-site work.","म यी मिति र घण्टामा काम गर्न सक्छु र स्थलगत काममा समयमै पुग्न सक्छु।")}</label></MatchingActionForm>
      <MatchingActionForm action={respondToMatchingInvitation} label={tr("Decline","अस्वीकार गर्नुहोस्")} lang={lang}><input type="hidden" name="token" value={token}/><input type="hidden" name="response" value="declined"/><label className="matching-check"><input type="checkbox" name="pause"/>{tr("Also pause future matching invitations","भविष्यका मिलान निमन्त्रणा पनि रोक्नुहोस्")}</label></MatchingActionForm>
    </>}
  </section></div>;
}
