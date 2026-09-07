import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import MatchingActionForm from "@/components/MatchingActionForm";
import { added } from "@/lib/added-strings";
import { isLang, translator } from "@/lib/i18n";
import { joinMission, leaveMission } from "@/lib/mission-actions";
import { getMission, missionViewer } from "@/lib/missions";
import { screenPath } from "@/lib/routes";
import { NETWORKS } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const mission = await getMission(id);
  if (!mission) return {};
  return { title: mission.title, description: mission.purpose ?? added(lang).missionsIntro };
}

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();

  const a = added(lang);
  const tr = translator(lang);
  const [mission, viewer] = await Promise.all([getMission(id), missionViewer()]);
  if (!mission) notFound();

  const membership = viewer.memberships.find((m) => m.missionId === mission.id);
  const closed = mission.status === "closed";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div className="page page--narrow">
      <Link href={screenPath(lang, "missions")} className="backlink">
        {a.missionBack}
      </Link>

      <h1 className="h1 h1--page">{mission.title}</h1>

      {mission.status !== "active" ? (
        <p className="notice notice--warn" role="status">
          {closed ? a.missionClosed : a.missionPaused}
        </p>
      ) : null}

      <p className="intro" style={{ marginBottom: 20 }}>
        {mission.members} {a.missionMembers}
      </p>

      {/* Purpose, current task, lead and check-in are all left empty at seed
          time. Each says so explicitly rather than being hidden, because an
          absent row reads as "does not apply" — and someone deciding whether
          to join needs to know the difference between "no task yet" and "a
          task we did not mention". */}
      <div className="rowlist" style={{ marginBottom: 24 }}>
        <Fact label={a.missionPurpose} value={mission.purpose} fallback={a.missionNotSetYet} />
        <Fact
          label={a.missionCurrentTask}
          value={mission.currentTask}
          fallback={a.missionNotSetYet}
        />
        <Fact label={a.missionLead} value={mission.leadName} fallback={a.missionNotSetYet} />
        <Fact
          label={a.missionNextCheckIn}
          value={mission.nextCheckIn ? fmtDate(mission.nextCheckIn) : null}
          fallback={a.missionNotSetYet}
        />
      </div>

      {/* The skill networks whose members tend to be useful here. Shown as
          context, not as a requirement: a mission is an interest, and nothing
          about this list gates joining. */}
      <section className="panel panel--organize" style={{ marginBottom: 24 }}>
        <h2 className="panel__title">{tr("Skills that help here")}</h2>
        <p className="panel__body">
          {NETWORKS.slice(0, 4)
            .map((n) => tr(n.name))
            .join(" · ")}
        </p>
      </section>

      {membership ? (
        <>
          <MatchingActionForm action={leaveMission} label={a.missionLeave} lang={lang}>
            <input type="hidden" name="missionId" value={mission.id} />
          </MatchingActionForm>
          {/* Provenance. Someone whose membership was entered from an email
              reply should be able to see that is where it came from. */}
          {membership.source !== "self_selected" ? (
            <p className="hint" style={{ marginTop: 10, fontSize: 12 }}>
              {membership.source === "email_reply" ? a.missionSourceEmail : a.missionSourceAdmin}
            </p>
          ) : null}
        </>
      ) : viewer.volunteerId && !closed ? (
        viewer.canJoinMore ? (
          <MatchingActionForm action={joinMission} label={a.missionJoin} lang={lang}>
            <input type="hidden" name="missionId" value={mission.id} />
          </MatchingActionForm>
        ) : (
          <p className="notice" role="status">
            {a.missionCapReached}
          </p>
        )
      ) : !closed ? (
        <p className="hint">
          <Link href={screenPath(lang, "volunteer")}>{a.missionRegisterFirst}</Link>
        </p>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback: string;
}) {
  return (
    <div className="row">
      <span className="fact__k">{label}</span>
      <span className="fact__v" style={value ? undefined : { color: "var(--faint)" }}>
        {value ?? fallback}
      </span>
    </div>
  );
}
