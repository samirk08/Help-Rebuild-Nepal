import Link from "next/link";

import MatchSuggestions from "@/components/MatchSuggestions";
import { statusLabel } from "@/lib/admin-render";
import { matchQueue } from "@/lib/match-suggestions";

export const dynamic = "force-dynamic";

/**
 * The coordination queue.
 *
 * Every open request that still has room, ordered by how badly it needs
 * attention — urgency against how far short of its people it is — each with
 * the volunteers it should be offered to and why.
 *
 * This is the screen the matching work actually happens on. The need detail
 * page can rank one request against the register, but a coordinator's real
 * question in the morning is "which of forty requests do I work first, and who
 * do I call", and answering that by opening forty pages is the manual review
 * this was built to remove. A request that is already full drops off the queue
 * rather than being ranked last: it is not work.
 */
export default async function MatchingPage() {
  const queue = await matchQueue();

  const withSuggestions = queue.filter((entry) => entry.top.length > 0);
  const withNobody = queue.filter((entry) => entry.top.length === 0);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Matching</h1>
          <p className="admin-head__note">
            Open requests that still have room, most urgent and least filled first, each with
            the volunteers who fit it. Suggestions only — a match is recorded when you click one.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            <p className="admin-empty__title">Nothing waiting to be matched</p>
            <p className="admin-empty__hint">
              This queue holds verified and recruiting requests that still need people. A
              request appears the moment a verifier publishes it.
            </p>
          </div>
        </div>
      ) : null}

      {withSuggestions.map((entry) => {
        const { need } = entry;
        const remaining =
          need.peopleNeeded === null ? null : Math.max(0, need.peopleNeeded - need.committed);

        return (
          <section className="queuecard" key={need.id}>
            <div className="queuecard__head">
              <div>
                <h2 className="queuecard__title">
                  <Link href={`/admin/needs/${need.id}`}>{need.title ?? "Untitled request"}</Link>
                </h2>
                <p className="queuecard__meta">
                  {[
                    need.district,
                    need.urgency,
                    need.skills.length > 0 ? need.skills.join(", ") : null,
                    statusLabel(need.status),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="queuecard__counts">
                <p style={{ margin: 0 }}>
                  <span className="queuecard__fill">
                    {need.committed}
                    {need.peopleNeeded === null ? "" : ` / ${need.peopleNeeded}`}
                  </span>{" "}
                  matched
                </p>
                <p style={{ margin: "2px 0 0" }}>
                  {/* An open answer to "how many people" is reported as it was
                      given, not turned into a number nobody stated. */}
                  {remaining === null
                    ? "Number not given"
                    : `${remaining} still needed`}
                  {entry.strong > 0 ? ` · ${entry.strong} strong` : ""}
                </p>
              </div>
            </div>

            <MatchSuggestions needId={need.id} suggestions={entry.top} />

            <p style={{ margin: 0, fontSize: 12.5 }}>
              <Link href={`/admin/needs/${need.id}`}>
                Open this request and see everyone <span aria-hidden="true">→</span>
              </Link>
            </p>
          </section>
        );
      })}

      {/* Requests nobody in the register can take are the most useful thing on
          this page: they are what recruiting has to go and find. */}
      {withNobody.length > 0 ? (
        <>
          <h2 className="admin-section-title">Nobody in the register fits these</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>District</th>
                  <th>Skills asked for</th>
                  <th>Urgency</th>
                  <th>Still needed</th>
                </tr>
              </thead>
              <tbody>
                {withNobody.map(({ need }) => (
                  <tr key={need.id}>
                    <td>
                      <Link href={`/admin/needs/${need.id}`}>{need.title ?? "Untitled"}</Link>
                    </td>
                    <td>{need.district ?? "—"}</td>
                    <td>{need.skills.length > 0 ? need.skills.join(", ") : "Not stated"}</td>
                    <td>{need.urgency ?? "—"}</td>
                    <td>
                      {need.peopleNeeded === null
                        ? "Number not given"
                        : Math.max(0, need.peopleNeeded - need.committed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-head__note" style={{ marginTop: 10 }}>
            {withNobody.length === 1 ? "This request has" : "These requests have"} no eligible
            volunteer in the register — a skill nobody has registered, a district nobody will
            travel to, or dates nobody is free for. Open one to see who was ruled out and why.
          </p>
        </>
      ) : null}

      {queue.length > 0 ? (
        <p className="admin-head__note" style={{ marginTop: 22 }}>
          Ordered by urgency against how far short each request still is. A request that
          answered &ldquo;how many people&rdquo; in words rather than a number counts as still
          open rather than dropping off the bottom. Scores are explained in full on each
          request&rsquo;s own page.
        </p>
      ) : null}
    </div>
  );
}
