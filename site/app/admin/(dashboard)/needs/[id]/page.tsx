import Link from "next/link";
import { notFound } from "next/navigation";

import MatchSuggestions from "@/components/MatchSuggestions";
import { createMatch, promoteToProject, updateSubmissionNotes, updateSubmissionStatus } from "@/lib/admin-actions";
import { documentsFor } from "@/lib/admin-documents";
import { SUBMISSION_STATUSES, renderSubmissionFields, statusLabel } from "@/lib/admin-render";
import { NEED_SECTIONS } from "@/lib/form-schema";
import { signalText } from "@/lib/match-copy";
import { suggestVolunteersForNeed, SUGGESTION_PAGE } from "@/lib/match-suggestions";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function NeedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = supabaseAdmin();

  const { data: row } = await client
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("kind", "need")
    .maybeSingle();

  if (!row) notFound();

  const [
    sections,
    documents,
    { data: matches },
    { data: project },
    { data: verifiedVolunteers },
    { data: interests },
    suggestions,
  ] = await Promise.all([
      Promise.resolve(renderSubmissionFields(row.fields, NEED_SECTIONS)),
      documentsFor(id),
      client
        .from("matches")
        .select("id, status, volunteer_id, submissions:volunteer_id(org_or_name)")
        .eq("need_id", id),
      client.from("projects").select("id, stage, coordinator").eq("need_id", id).maybeSingle(),
      client
        .from("submissions")
        .select("id, org_or_name")
        .eq("kind", "volunteer")
        .in("status", ["verified", "recruiting"])
        .order("org_or_name")
        .limit(300),
      client
        .from("interests")
        .select("id, name, contact, message, created_at")
        .eq("need_id", id)
        .order("created_at", { ascending: false }),
      // Ranked against the whole register — see lib/matching.ts. Runs in
      // parallel with everything else on the page rather than after it: it is
      // the slowest read here and blocking the detail view on it would make
      // reviewing a need feel worse than it did before suggestions existed.
      suggestVolunteersForNeed(id),
    ]);

  const returnTo = `/admin/needs/${id}`;

  return (
    <div>
      <Link href="/admin/needs" className="admin-back">
        <span aria-hidden="true">←</span> All needs
      </Link>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">{row.org_or_name ?? "Need"}</h1>
          <p className="admin-head__note">
            {row.district ?? "District not given"} · posted{" "}
            {new Date(row.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="admin-head__actions">
          <span className={`admin-badge admin-badge--${row.status}`}>
            {statusLabel(row.status)}
          </span>
        </div>
      </div>

      <div className="admin-detail">
        <div className="admin-detail__row">
          <span className="admin-detail__k">Status</span>
          <span className="admin-detail__v">
            <form action={updateSubmissionStatus} className="admin-form-row">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <select name="status" defaultValue={row.status} aria-label="Status">
                {SUBMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn--outline btn--sm">
                Update
              </button>
            </form>
          </span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">District</span>
          <span className="admin-detail__v">{row.district ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Urgency</span>
          <span className="admin-detail__v">{row.urgency ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Contact</span>
          <span className="admin-detail__v">{row.contact_phone ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Submitted</span>
          <span className="admin-detail__v">{new Date(row.created_at).toLocaleString()}</span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="admin-section-title">{section.title}</h2>
          <div className="admin-detail">
            {section.rows.map((r) => (
              <div className="admin-detail__row" key={r.label}>
                <span className="admin-detail__k">{r.label}</span>
                <span className="admin-detail__v">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {documents.length > 0 ? (
        <>
          <h2 className="admin-section-title">Documents</h2>
          <ul className="admin-doc-list">
            {documents.map((doc) => (
              <li key={doc.id}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  {doc.original_name}
                </a>{" "}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  ({Math.round(doc.size_bytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* People who clicked "I can help with this" on the public board. Their
          contact details are only ever shown here, never on the public page. */}
      <h2 className="admin-section-title">Expressed interest</h2>
      <div className="admin-detail">
        {interests && interests.length > 0 ? (
          interests.map((person) => (
            <div className="admin-detail__row" key={person.id}>
              <span className="admin-detail__k">
                {person.name}
                <br />
                <span style={{ color: "var(--faint)", fontSize: 12 }}>
                  {new Date(person.created_at).toLocaleString()}
                </span>
              </span>
              <span className="admin-detail__v">
                {person.contact}
                {person.message ? (
                  <>
                    <br />
                    <span style={{ color: "var(--muted)" }}>{person.message}</span>
                  </>
                ) : null}
              </span>
            </div>
          ))
        ) : (
          <p className="admin-empty admin-empty--inline">No one has expressed interest yet.</p>
        )}
      </div>

      <h2 className="admin-section-title">Matched volunteers</h2>
      <div className="admin-detail">
        {matches && matches.length > 0 ? (
          matches.map((m) => {
            // Supabase's TS types this embedded relation as an array even
            // though volunteer_id -> submissions.id is a to-one FK.
            const volunteer = Array.isArray(m.submissions) ? m.submissions[0] : m.submissions;
            return (
              <div className="admin-detail__row" key={m.id}>
                <span className="admin-detail__k">{volunteer?.org_or_name ?? m.volunteer_id}</span>
                <span className="admin-detail__v">
                  <span className={`admin-badge admin-badge--${m.status}`}>
                    {statusLabel(m.status)}
                  </span>
                </span>
              </div>
            );
          })
        ) : (
          <p className="admin-empty admin-empty--inline">No volunteer matched yet.</p>
        )}
      </div>
      {/* Ranked by lib/matching.ts against the whole register, with the
          reasoning shown. The engine suggests; this page's buttons are still
          the only thing that records a match. */}
      <h2 className="admin-section-title">Suggested volunteers</h2>
      {suggestions && suggestions.eligible.length > 0 ? (
        <>
          <p className="admin-head__note" style={{ margin: "0 0 12px" }}>
            {suggestions.eligible.length} of {suggestions.poolSize}{" "}
            {suggestions.poolSize === 1 ? "registration" : "registrations"} could take this on,
            best fit first. Every score breaks down below it — check the cautions before making
            contact.
          </p>
          <MatchSuggestions needId={id} suggestions={suggestions.eligible.slice(0, SUGGESTION_PAGE)} />
          {suggestions.eligible.length > SUGGESTION_PAGE ? (
            <details className="matchblocked">
              <summary>
                {suggestions.eligible.length - SUGGESTION_PAGE} more possible{" "}
                {suggestions.eligible.length - SUGGESTION_PAGE === 1 ? "volunteer" : "volunteers"}
              </summary>
              <div style={{ padding: "0 14px 14px" }}>
                <MatchSuggestions
                  needId={id}
                  suggestions={suggestions.eligible.slice(SUGGESTION_PAGE)}
                  startRank={SUGGESTION_PAGE + 1}
                />
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <div className="admin-detail">
          <p className="admin-empty admin-empty--inline">
            {suggestions && suggestions.poolSize > 0
              ? "No one in the register can take this on. The ruled-out list below says why — often it is one answer, like a district nobody will travel to."
              : "No volunteer registrations to rank yet."}
          </p>
        </div>
      )}

      {/* Ruled out, not hidden. "Nobody matched" and "eleven people matched
          and every one said they cannot travel" are different problems. */}
      {suggestions && suggestions.blocked.length > 0 ? (
        <details className="matchblocked">
          <summary>
            {suggestions.blocked.length} ruled out
          </summary>
          <ul className="matchblocked__list">
            {suggestions.blocked.map(({ volunteer, assessment }) => (
              <li key={volunteer.id}>
                <span className="matchblocked__who">
                  <Link href={`/admin/volunteers/${volunteer.id}`}>
                    {volunteer.name ?? volunteer.id}
                  </Link>
                </span>
                <span>{assessment.blockers.map((b) => signalText("en", b)).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* The engine ranks what it can read. Someone who spoke to the ward
          office knows things no form asked about, so the full list stays. */}
      {verifiedVolunteers && verifiedVolunteers.length > 0 ? (
        <form action={createMatch} className="admin-form-row" style={{ marginBottom: 24 }}>
          <input type="hidden" name="needId" value={id} />
          <input type="hidden" name="source" value="manual" />
          <select name="volunteerId" required defaultValue="" aria-label="Volunteer to match">
            <option value="" disabled>
              Match someone else…
            </option>
            {verifiedVolunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.org_or_name ?? v.id}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--outline btn--sm">
            Mark matched
          </button>
        </form>
      ) : null}

      <h2 className="admin-section-title">Project</h2>
      <div className="admin-detail">
        {project ? (
          <>
            <div className="admin-detail__row">
              <span className="admin-detail__k">Stage</span>
              <span className="admin-detail__v">{project.stage}</span>
            </div>
            <div className="admin-detail__row">
              <span className="admin-detail__k">Coordinator</span>
              <span className="admin-detail__v">{project.coordinator ?? "—"}</span>
            </div>
          </>
        ) : (
          <p className="admin-empty admin-empty--inline">
            Not yet promoted to a standing project.
          </p>
        )}
      </div>
      {!project ? (
        <form action={promoteToProject} className="admin-form-row" style={{ marginBottom: 24 }}>
          <input type="hidden" name="needId" value={id} />
          <input type="text" name="coordinator" placeholder="Coordinator (optional)" />
          <button type="submit" className="btn btn--outline btn--sm">
            Promote to project
          </button>
        </form>
      ) : null}

      <h2 className="admin-section-title">Internal notes</h2>
      <form action={updateSubmissionNotes}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <textarea className="admin-textarea" name="notes" defaultValue={row.notes ?? ""} />
        <div style={{ marginTop: 8 }}>
          <button type="submit" className="btn btn--dark btn--sm">
            Save notes
          </button>
        </div>
      </form>
    </div>
  );
}
