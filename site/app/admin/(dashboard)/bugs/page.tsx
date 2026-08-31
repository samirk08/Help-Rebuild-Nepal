import Link from "next/link";

import BugReportForm from "@/components/BugReportForm";
import CopyBugsButton from "@/components/CopyBugsButton";
import { BUG_LABEL, BUG_STATUSES } from "@/lib/bug-constants";
import { formatBugsForHandover, listBugs } from "@/lib/bugs";

export const dynamic = "force-dynamic";

/** Reuses the status badge palette: blocking reads like a rejection, minor like a closed item. */
const SEVERITY_BADGE: Record<string, string> = {
  blocking: "rejected",
  normal: "submitted",
  minor: "completed",
};

export default async function BugsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "open";

  const [bugs, handover] = await Promise.all([
    listBugs(status === "all" ? undefined : status),
    formatBugsForHandover(),
  ]);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Bugs</h1>
          <p className="admin-head__note">
            Anything broken on the site, with the screenshot attached. &ldquo;Copy open
            bugs&rdquo; puts them all on the clipboard as text, ready to hand to whoever is
            fixing them.
          </p>
        </div>
        <div className="admin-head__actions">
          <CopyBugsButton text={handover} />
        </div>
      </div>

      <h2 className="admin-section-title" style={{ marginTop: 0 }}>
        File a bug
      </h2>
      <BugReportForm />

      <h2 className="admin-section-title">Reported</h2>
      <form className="admin-filters" method="get">
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="all">All</option>
          {BUG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BUG_LABEL[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--outline btn--sm">
          Filter
        </button>
      </form>

      <div className="admin-table-wrap">
        {bugs.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>What is broken</th>
                <th>Where</th>
                <th>Status</th>
                <th>Filed</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((bug) => (
                <tr key={bug.id}>
                  <td>
                    <span className={`admin-badge admin-badge--${SEVERITY_BADGE[bug.severity]}`}>
                      {BUG_LABEL[bug.severity] ?? bug.severity}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/bugs/${bug.id}`}>{bug.title}</Link>
                    {bug.attachmentCount > 0 ? (
                      <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>
                        {bug.attachmentCount} image{bug.attachmentCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ overflowWrap: "anywhere" }}>{bug.pageUrl ?? "—"}</td>
                  <td>
                    <span
                      className={`admin-badge admin-badge--${
                        bug.status === "open" ? "under_review" : "verified"
                      }`}
                    >
                      {BUG_LABEL[bug.status] ?? bug.status}
                    </span>
                  </td>
                  <td className="admin-table__time">
                    {new Date(bug.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty">
            <p className="admin-empty__title">
              {status === "open" ? "No open bugs" : "Nothing here"}
            </p>
            <p className="admin-empty__hint">
              File one above the moment you hit it — a screenshot pasted now is worth more than
              a description written later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
