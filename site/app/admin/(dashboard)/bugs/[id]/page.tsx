import Link from "next/link";
import { notFound } from "next/navigation";

import { BUG_LABEL, BUG_STATUSES } from "@/lib/bug-constants";
import { deleteBug, getBug, updateBugStatus } from "@/lib/bugs";

export const dynamic = "force-dynamic";

export default async function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getBug(id);
  if (!found) notFound();

  const { bug, attachments } = found;

  return (
    <div>
      <Link href="/admin/bugs" className="admin-back">
        <span aria-hidden="true">←</span> All bugs
      </Link>

      <div className="admin-head">
        <div>
          <h1 className="admin-h1">{bug.title}</h1>
          <p className="admin-head__note">
            {BUG_LABEL[bug.severity] ?? bug.severity} · filed{" "}
            {new Date(bug.createdAt).toLocaleString()} by {bug.reportedByEmail ?? "—"}
          </p>
        </div>
        <div className="admin-head__actions">
          <form action={updateBugStatus} className="admin-form-row">
            <input type="hidden" name="id" value={bug.id} />
            <select name="status" defaultValue={bug.status} aria-label="Status">
              {BUG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BUG_LABEL[s]}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--outline btn--sm">
              Update
            </button>
          </form>
        </div>
      </div>

      <div className="admin-detail">
        <div className="admin-detail__row">
          <span className="admin-detail__k">Where</span>
          <span className="admin-detail__v">{bug.pageUrl ?? "—"}</span>
        </div>
        <div className="admin-detail__row">
          <span className="admin-detail__k">Status</span>
          <span className="admin-detail__v">{BUG_LABEL[bug.status] ?? bug.status}</span>
        </div>
        {bug.resolvedAt ? (
          <div className="admin-detail__row">
            <span className="admin-detail__k">Closed</span>
            <span className="admin-detail__v">{new Date(bug.resolvedAt).toLocaleString()}</span>
          </div>
        ) : null}
        <div className="admin-detail__row">
          <span className="admin-detail__k">Reported from</span>
          {/* Where the report was filed, not necessarily where the bug happened. */}
          <span className="admin-detail__v" style={{ fontSize: 12 }}>
            {bug.reportedFrom ?? "—"}
          </span>
        </div>
      </div>

      {bug.detail ? (
        <>
          <h2 className="admin-section-title">What happened</h2>
          <div className="admin-detail">
            <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6, margin: "12px 0" }}>
              {bug.detail}
            </p>
          </div>
        </>
      ) : null}

      {attachments.length > 0 ? (
        <>
          <h2 className="admin-section-title">Screenshots</h2>
          <div className="grid grid--300" style={{ marginBottom: 16 }}>
            {attachments.map((file) => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-detail"
                style={{ display: "block", padding: 12 }}
              >
                {/* Signed URLs are short-lived and the host is not in next.config's
                    image domains, so a plain img is correct here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url}
                  alt={file.originalName}
                  style={{ width: "100%", borderRadius: "var(--radius-sm)", display: "block" }}
                />
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
                  {file.originalName} · {Math.round(file.sizeBytes / 1024)} KB
                </p>
              </a>
            ))}
          </div>
          <p className="hint">
            Open an image and save it if you need to attach it to a conversation — these links
            expire after ten minutes.
          </p>
        </>
      ) : null}

      <h2 className="admin-section-title">Danger zone</h2>
      <form action={deleteBug}>
        <input type="hidden" name="id" value={bug.id} />
        <button type="submit" className="btn btn--outline btn--sm">
          Delete this report and its screenshots
        </button>
      </form>
    </div>
  );
}
