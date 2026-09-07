import Link from "next/link";

import MatchingActionForm from "@/components/MatchingActionForm";
import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { joinMission, leaveMission } from "@/lib/mission-actions";
import type { Mission, MissionViewer } from "@/lib/missions";
import { screenPath } from "@/lib/routes";

/**
 * One mission, with whichever action the viewer is actually entitled to.
 *
 * Four states, and the difference between the last two matters: someone who
 * has hit the two-mission cap is shown a disabled control and told why, rather
 * than a button that fails when pressed. Someone signed out is pointed at the
 * form, because a mission attaches to a registration.
 */
export default function MissionCard({
  mission,
  viewer,
  lang,
}: {
  mission: Mission;
  viewer: MissionViewer;
  lang: Lang;
}) {
  const a = added(lang);
  const joined = viewer.memberships.some((m) => m.missionId === mission.id);
  const closed = mission.status === "closed";

  return (
    <div className="card network" key={mission.id}>
      <h2 className="network__name">{mission.title}</h2>

      {mission.status !== "active" ? (
        <p className="hint" style={{ marginTop: 4 }}>
          {closed ? a.missionClosed : a.missionPaused}
        </p>
      ) : null}

      {/* Purpose is shown only when a coordinator has written one. An empty
          mission says so on its own page rather than filling the gap here. */}
      {mission.purpose ? <p className="network__body">{mission.purpose}</p> : null}

      <p className="network__count">
        <strong>{mission.members}</strong>
        <span>{a.missionMembers}</span>
      </p>

      {joined ? (
        <MatchingActionForm action={leaveMission} label={a.missionLeave} lang={lang}>
          <input type="hidden" name="missionId" value={mission.id} />
        </MatchingActionForm>
      ) : viewer.volunteerId && !closed ? (
        viewer.canJoinMore ? (
          <MatchingActionForm action={joinMission} label={a.missionJoin} lang={lang}>
            <input type="hidden" name="missionId" value={mission.id} />
          </MatchingActionForm>
        ) : (
          <>
            <button type="button" className="btn btn--outline btn--sm btn--block" disabled>
              {a.missionJoin}
            </button>
            <p className="hint" style={{ marginTop: 8, fontSize: 12 }}>
              {a.missionCapReached}
            </p>
          </>
        )
      ) : !closed ? (
        <>
          <Link
            href={screenPath(lang, "volunteer")}
            className="btn btn--outline btn--outline-green btn--sm btn--block"
          >
            {a.missionRegisterFirst}
          </Link>
          {!viewer.signedIn ? (
            <p className="hint" style={{ marginTop: 8, fontSize: 12 }}>
              <Link href={screenPath(lang, "accountLogin")}>{a.missionSignInToJoin}</Link>
            </p>
          ) : null}
        </>
      ) : null}

      <p style={{ marginTop: 10 }}>
        <Link href={`${screenPath(lang, "missions")}/${mission.id}`}>{a.missionOpen} →</Link>
      </p>
    </div>
  );
}
