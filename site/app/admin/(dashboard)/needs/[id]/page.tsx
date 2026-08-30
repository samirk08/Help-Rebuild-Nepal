import { notFound } from "next/navigation";

import { createMatch, promoteToProject, updateSubmissionNotes, updateSubmissionStatus } from "@/lib/admin-actions";
import { documentsFor } from "@/lib/admin-documents";
import { renderSubmissionFields } from "@/lib/admin-render";
import { NEED_SECTIONS } from "@/lib/form-schema";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["submitted", "under_review", "verified", "recruiting", "filled", "completed", "rejected"];

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

  const [sections, documents, { data: matches }, { data: project }, { data: verifiedVolunteers }] =
    await Promise.all([
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
    ]);

  const returnTo = `/admin/needs/${id}`;

  return (
    <div>
      <h1 className="admin-h1">{row.org_or_name ?? "Need"}</h1>

      <div className="admin-detail">
        <div className="admin-detail__row">
          <span className="admin-detail__k">Status</span>
          <span className="admin-detail__v">
            <form action={updateSubmissionStatus} className="admin-form-row">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <select name="status" defaultValue={row.status}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
                <span className="admin-detail__v">{m.status}</span>
              </div>
            );
          })
        ) : (
          <p className="admin-empty" style={{ padding: "12px 0" }}>
            No volunteer matched yet.
          </p>
        )}
      </div>
      {verifiedVolunteers && verifiedVolunteers.length > 0 ? (
        <form action={createMatch} className="admin-form-row" style={{ marginBottom: 24 }}>
          <input type="hidden" name="needId" value={id} />
          <select name="volunteerId" required defaultValue="">
            <option value="" disabled>
              Choose a volunteer…
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
          <p className="admin-empty" style={{ padding: "12px 0" }}>
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
