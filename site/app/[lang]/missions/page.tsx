import type { Metadata } from "next";
import { notFound } from "next/navigation";

import MatchingActionForm from "@/components/MatchingActionForm";
import MissionCard from "@/components/MissionCard";
import { added } from "@/lib/added-strings";
import { isLang } from "@/lib/i18n";
import { setMissionOnly } from "@/lib/mission-actions";
import { listMissions, missionViewer } from "@/lib/missions";

// Membership counts and the viewer's own selections are live rows.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const a = added(lang);
  return { title: a.missionsTitle, description: a.missionsIntro };
}

export default async function MissionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const a = added(lang);
  const [missions, viewer] = await Promise.all([listMissions(), missionViewer()]);

  return (
    <div className="page">
      <h1 className="h1 h1--page">{a.missionsTitle}</h1>
      <p className="intro" style={{ marginBottom: 8 }}>
        {a.missionsIntro}
      </p>
      <p className="hint" style={{ marginBottom: 26 }}>
        {a.missionsPickLimit}
        {viewer.volunteerId
          ? ` — ${viewer.memberships.length} ${a.missionsSelected}`
          : ""}
      </p>

      {/* The one control that actually narrows who gets invited to what.
          Shown only to someone who has missions to narrow to. */}
      {viewer.volunteerId && viewer.memberships.length > 0 ? (
        <section className="panel panel--organize" style={{ marginBottom: 24 }}>
          <MatchingActionForm action={setMissionOnly} label={a.missionSaveScope} lang={lang}>
            <label className="matching-check">
              <input type="checkbox" name="missionOnly" defaultChecked={viewer.missionOnly} />
              {a.missionOnlyLabel}
            </label>
            <p className="hint" style={{ fontSize: 12 }}>
              {a.missionOnlyHint}
            </p>
          </MatchingActionForm>
        </section>
      ) : null}

      <div className="grid grid--260">
        {missions.map((mission) => (
          <MissionCard key={mission.id} mission={mission} viewer={viewer} lang={lang} />
        ))}
      </div>

      {/* An empty list on this page means the migration has not been run, but
          a public page is not the place to say so — that belongs in Admin ->
          Diagnostics. A visitor gets the same honest "unavailable" wording the
          board uses, not a zero and not an instruction meant for an operator. */}
      {missions.length === 0 ? (
        <p className="notice notice--warn" role="alert">
          {a.missionsUnavailable}
        </p>
      ) : null}
    </div>
  );
}
