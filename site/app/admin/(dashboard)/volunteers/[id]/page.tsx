import { notFound } from "next/navigation";

import { updateSubmissionNotes, updateSubmissionStatus } from "@/lib/admin-actions";
import { documentsFor } from "@/lib/admin-documents";
import { renderSubmissionFields } from "@/lib/admin-render";
import { VOLUNTEER_SECTIONS } from "@/lib/form-schema";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["submitted", "under_review", "verified", "recruiting", "filled", "completed", "rejected"];

export default async function VolunteerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: row } = await supabaseAdmin()
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("kind", "volunteer")
    .maybeSingle();

  if (!row) notFound();

  const sections = renderSubmissionFields(row.fields, VOLUNTEER_SECTIONS);
  const documents = await documentsFor(id);
  const returnTo = `/admin/volunteers/${id}`;

  return (
    <div>
      <h1 className="admin-h1">{row.org_or_name ?? "Volunteer"}</h1>

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
          <span className="admin-detail__k">Phone</span>
          <span className="admin-detail__v">{row.contact_phone ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Email</span>
          <span className="admin-detail__v">{row.contact_email ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">District</span>
          <span className="admin-detail__v">{row.district ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Language submitted in</span>
          <span className="admin-detail__v">{row.lang}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Submitted</span>
          <span className="admin-detail__v">{new Date(row.created_at).toLocaleString()}</span>
        </div>
        {row.verified_at ? (
          <div className="admin-detail__row">
            <span className="admin-detail__k">Verified</span>
            <span className="admin-detail__v">{new Date(row.verified_at).toLocaleString()}</span>
          </div>
        ) : null}
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
