import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { getMatchingProfile } from "@/lib/matching/data";
import type { MissingFact } from "@/lib/matching/readiness";
import { supabaseAdmin } from "@/lib/supabase";
import { loadWorkspace } from "@/lib/volunteer-workspace";
import { currentVolunteer } from "@/lib/volunteer-auth";

/**
 * "Where do I stand?" for a signed-in volunteer.
 *
 * Three questions, in the order someone actually asks them: can I be invited,
 * what is waiting on me, and what have I already agreed to.
 *
 * Readiness lists only what is missing. A checklist of everything already
 * answered is noise, and a completion percentage would invite optimising the
 * number rather than filling the gap.
 */
export default async function VolunteerWorkspace({
  id,
  lang,
}: {
  id: string;
  lang: Lang;
}) {
  const user = await currentVolunteer();
  if (!user) return null;

  // Ownership re-checked here rather than trusted from the caller: this
  // component reads invitations, which are private to one person.
  const { data: volunteer } = await supabaseAdmin()
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("kind", "volunteer")
    .maybeSingle();
  if (!volunteer) return null;

  const matching = await getMatchingProfile(id);
  if (!matching.available) return null;

  const a = added(lang);
  const workspace = await loadWorkspace(volunteer, matching.profile);
  const { readiness } = workspace;

  const fixLabel = (fixes: MissingFact["fixes"]) =>
    fixes === "matching"
      ? a.readyFixMatching
      : fixes === "registration"
        ? a.readyFixRegistration
        : a.readyFixCoordinator;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
      day: "numeric",
      month: "long",
    });

  return (
    <>
      <section className="panel panel--organize" style={{ marginBottom: 16 }}>
        <h2 className="panel__title">{a.readyTitle}</h2>

        {readiness.ready ? (
          <p className="panel__body">{a.readyYes}</p>
        ) : (
          <>
            <p className="panel__body" style={{ marginBottom: 8 }}>
              {a.readyMissingTitle}
            </p>
            <ul className="bullets" style={{ margin: 0 }}>
              {readiness.missing.map((fact) => (
                <li key={fact.key}>
                  {fact.label}
                  <span className="hint" style={{ display: "block", fontSize: 12 }}>
                    {fixLabel(fact.fixes)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* A pause is a decision, not a gap, so it is stated separately rather
            than listed as something the person forgot to do. */}
        {readiness.paused ? (
          <p className="notice" style={{ marginTop: 12 }} role="status">
            {a.readyPausedNote}
          </p>
        ) : null}
      </section>

      {workspace.available ? (
        <>
          <section className="panel panel--organize" style={{ marginBottom: 16 }}>
            <h2 className="panel__title">{a.wsInvitationsTitle}</h2>
            {workspace.invitations.length === 0 ? (
              <p className="panel__body">{a.wsInvitationsEmpty}</p>
            ) : (
              <ul className="bullets" style={{ margin: "8px 0 0" }}>
                {workspace.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <strong>{invitation.roleTitle}</strong>
                    <span className="hint" style={{ display: "block", fontSize: 12 }}>
                      {[invitation.needTitle, invitation.district].filter(Boolean).join(" · ")}
                    </span>
                    <span className="hint" style={{ display: "block", fontSize: 12 }}>
                      {invitation.lapsed
                        ? a.wsInvitationLapsed
                        : invitation.status === "accepted"
                          ? a.wsInvitationAccepted
                          : `${a.wsInvitationWaiting} · ${a.wsInvitationExpires} ${fmtDate(invitation.expiresAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel panel--organize" style={{ marginBottom: 16 }}>
            <h2 className="panel__title">{a.wsCommitmentsTitle}</h2>
            {workspace.commitments.length === 0 ? (
              <p className="panel__body">{a.wsCommitmentsEmpty}</p>
            ) : (
              <>
                <ul className="bullets" style={{ margin: "8px 0 10px" }}>
                  {workspace.commitments.map((commitment) => (
                    <li key={commitment.id}>
                      <strong>{commitment.roleTitle}</strong>
                      <span className="hint" style={{ display: "block", fontSize: 12 }}>
                        {fmtDate(commitment.startDate)} – {fmtDate(commitment.endDate)} ·{" "}
                        {commitment.hoursPerWeek} h/week
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Peak overlap, not the sum: two commitments that do not run
                    at the same time do not add up, and saying they do would
                    tell someone they are full when they are free. */}
                <p className="hint" style={{ fontSize: 12 }}>
                  {workspace.committedHours} {a.wsCommittedHours}
                </p>
              </>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
