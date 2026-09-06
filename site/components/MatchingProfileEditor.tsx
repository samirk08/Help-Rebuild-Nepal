import MatchingActionForm from "./MatchingActionForm";
import { saveMatchingProfile } from "@/lib/matching/actions";
import { SKILLS } from "@/lib/matching/catalog";
import { legacyFacts } from "@/lib/matching/normalize";
import type { Profile, Submission } from "@/lib/matching/types";

export default function MatchingProfileEditor({ volunteer, profile, admin = false, lang = "en" }: {
  volunteer:Submission; profile:Profile|null; admin?:boolean; lang?:"en"|"np";
}) {
  const f = profile?.facts ?? legacyFacts(volunteer);
  const tr = (en:string,np:string) => lang === "np" ? np : en;
  return <section className="matching-panel">
    <h2>{tr("Matching details","मिलानका विवरण")}</h2>
    <p>{tr("Confirm the skills and time you can offer. Leave uncertain answers blank. Mission preferences can be added later.","तपाईंले दिन सक्ने सीप र समय पुष्टि गर्नुहोस्। निश्चित नभएका उत्तर खाली छोड्नुहोस्। अभियानका रुचिहरू पछि थप्न सकिन्छ।")}</p>
    {!profile ? <p className="matching-notice">{tr("Some old dropdown answers may have been selected automatically. Please confirm them here.","पुराना फारमका केही उत्तर स्वतः छानिएका हुन सक्छन्। कृपया यहाँ पुष्टि गर्नुहोस्।")}</p> : null}
    <MatchingActionForm action={saveMatchingProfile} label={tr("Save matching details","मिलानका विवरण सुरक्षित गर्नुहोस्")} lang={lang}>
      <input type="hidden" name="volunteerId" value={volunteer.id}/><input type="hidden" name="revision" value={profile?.revision ?? 0}/>
      <fieldset className="matching-skills"><legend>{tr("Skills offered for opportunities","अवसरका लागि उपलब्ध सीपहरू")}</legend>
        {SKILLS.map(([id,label]) => <label key={id}><input type="checkbox" name="skills" value={id} defaultChecked={f.skills?.includes(id) ?? false}/>{label}</label>)}
      </fieldset>
      <div className="matching-grid">
        <label>{tr("Specialties (comma separated)","विशेष सीप (अल्पविरामले छुट्याउनुहोस्)")}<input name="specialties" maxLength={1000} defaultValue={f.specialties.join(", ")}/></label>
        <label>{tr("Relevant experience in years","सम्बन्धित अनुभव (वर्ष)")}<input type="number" name="experienceYears" min={0} max={80} defaultValue={f.experienceYears ?? ""}/></label>
        <label>{tr("Work preference","कामको प्राथमिकता")}<select name="workMode" defaultValue={f.workMode ?? ""}><option value="">{tr("Not confirmed","पुष्टि भएको छैन")}</option><option value="remote">{tr("Remote only","टाढाबाट मात्र")}</option><option value="onsite">{tr("On-site only","स्थलगत मात्र")}</option><option value="both">{tr("Remote and on-site","टाढाबाट र स्थलगत")}</option></select></label>
        <label>{tr("Home district (optional for remote work)","हालको जिल्ला (टाढाबाट कामका लागि ऐच्छिक)")}<input name="district" maxLength={100} defaultValue={f.district ?? ""}/></label>
        <label>{tr("Travel area","यात्रा गर्न सक्ने क्षेत्र")}<select name="travel" defaultValue={f.travel ?? ""}><option value="">{tr("Not confirmed","पुष्टि भएको छैन")}</option><option value="anywhere">{tr("Anywhere in Nepal","नेपालभरि")}</option><option value="local">{tr("My district only","आफ्नो जिल्लामा मात्र")}</option><option value="districts">{tr("Selected districts","छानिएका जिल्लाहरू")}</option></select></label>
        <label>{tr("Travel districts (comma separated)","यात्रा गर्न सक्ने जिल्लाहरू")}<input name="travelDistricts" defaultValue={f.travelDistricts.join(", ")} maxLength={500}/></label>
        <label>{tr("Available from","कहिलेदेखि उपलब्ध")}<input type="date" name="availableFrom" defaultValue={f.availableFrom ?? ""}/></label>
        <label>{tr("Available until","कहिलेसम्म उपलब्ध")}<input type="date" name="availableUntil" defaultValue={f.availableUntil ?? ""}/></label>
        <label>{tr("Total hours available per week","प्रति हप्ता उपलब्ध कुल घण्टा")}<input type="number" name="hoursPerWeek" min={1} max={168} defaultValue={f.hoursPerWeek ?? ""}/></label>
        <label>{tr("Maximum on-site deployment (days)","अधिकतम स्थलगत अवधि (दिन)")}<input type="number" name="maxDeploymentDays" min={1} max={366} defaultValue={f.maxDeploymentDays ?? ""}/></label>
      </div>
      {admin ? <label>Qualifications checked by a coordinator (comma separated)<input name="verifiedQualifications" maxLength={1000} defaultValue={profile?.verified_qualifications.join(", ") ?? ""}/><small>Enter only qualifications you have verified. Match the requirement name used on the role.</small></label> : null}
      <label className="matching-check"><input type="checkbox" name="paused" defaultChecked={profile?.paused ?? false}/>{tr("Pause matching invitations","मिलानका निमन्त्रणा रोक्नुहोस्")}</label>
      <label className="matching-check"><input type="checkbox" name="confirmFacts" required/>{admin ? "These details were confirmed with the volunteer." : tr("These details reflect the skills and availability I currently offer.","यी विवरणले मेरा हाल उपलब्ध सीप र समय जनाउँछन्।")}</label>
    </MatchingActionForm>
  </section>;
}
