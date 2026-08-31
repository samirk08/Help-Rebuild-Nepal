import Link from "next/link";
import { notFound } from "next/navigation";

import DeleteVolunteerButton from "@/components/DeleteVolunteerButton";
import { updateSubmissionNotes, updateSubmissionStatus } from "@/lib/admin-actions";
import { documentsFor } from "@/lib/admin-documents";
import { SUBMISSION_STATUSES, renderSubmissionFields, statusLabel } from "@/lib/admin-render";
import { VOLUNTEER_SECTIONS } from "@/lib/form-schema";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
      <Link href="/admin/volunteers" className="admin-back">
        <span aria-hidden="true">←</span> All volunteers
      </Link>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">{row.org_or_name ?? "Volunteer"}</h1>
          <p className="admin-head__note">
            {row.district ?? "District not given"} · registered{" "}
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
          <span className="admin-detail__v">{row.lang === "np" ? "Nepali" : "English"}</span>
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

      {/* Last on the page on purpose — reviewing comes before removing. */}
      <h2 className="admin-section-title">Danger zone</h2>
      <DeleteVolunteerButton
        id={id}
        name={row.org_or_name ?? "this volunteer"}
        documentCount={documents.length}
      />
    </div>
  );
}
