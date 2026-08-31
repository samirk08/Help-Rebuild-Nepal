import Link from "next/link";

import { SUBMISSION_STATUSES, repeatedContactIds, statusLabel } from "@/lib/admin-render";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const URGENCIES = ["Immediate", "Urgent", "Upcoming", "Reconstruction"];

export default async function NeedsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const urgency = typeof params.urgency === "string" ? params.urgency : "";
  const district = typeof params.district === "string" ? params.district : "";

  let query = supabaseAdmin()
    .from("submissions")
    .select("id, org_or_name, district, urgency, status, created_at, contact_phone, contact_email")
    .eq("kind", "need")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (urgency) query = query.ilike("urgency", `%${urgency}%`);
  if (district) query = query.ilike("district", `%${district}%`);

  const { data: rows } = await query;
  const repeated = repeatedContactIds(rows ?? []);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Needs</h1>
          <p className="admin-head__note">
            {rows?.length ?? 0} {rows?.length === 1 ? "request" : "requests"}
            {status || urgency || district ? " matching this filter" : " so far"}.
          </p>
        </div>
      </div>

      <form className="admin-filters" method="get">
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="">Any status</option>
          {SUBMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select name="urgency" defaultValue={urgency} aria-label="Filter by urgency">
          <option value="">Any urgency</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="district"
          placeholder="District"
          defaultValue={district}
          aria-label="Filter by district"
        />
        <button type="submit" className="btn btn--outline btn--sm">
          Filter
        </button>
        <a
          href="/api/admin/export?kind=need"
          className="btn btn--outline btn--sm admin-filters__end"
        >
          Export CSV
        </a>
      </form>

      <div className="admin-table-wrap">
        {rows && rows.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>District</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/needs/${row.id}`}>{row.org_or_name ?? "—"}</Link>
                    {repeated.has(row.id) ? (
                      <span
                        className="admin-badge admin-badge--submitted"
                        style={{ marginLeft: 8 }}
                        title="Another request shares this email or phone number"
                      >
                        Repeat contact
                      </span>
                    ) : null}
                  </td>
                  <td>{row.district ?? "—"}</td>
                  <td>{row.urgency ?? "—"}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${row.status}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="admin-table__time">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty">
            <p className="admin-empty__title">No needs here yet</p>
            <p className="admin-empty__hint">
              {status || urgency || district
                ? "Nothing matches this filter. Try clearing it."
                : "Requests posted through the public form will appear here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
