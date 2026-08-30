import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["submitted", "under_review", "verified", "recruiting", "filled", "completed", "rejected"];
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
    .select("id, org_or_name, district, urgency, status, created_at")
    .eq("kind", "need")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (urgency) query = query.ilike("urgency", `%${urgency}%`);
  if (district) query = query.ilike("district", `%${district}%`);

  const { data: rows } = await query;

  return (
    <div>
      <h1 className="admin-h1">Needs</h1>

      <form className="admin-filters" method="get">
        <select name="status" defaultValue={status}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="urgency" defaultValue={urgency}>
          <option value="">Any urgency</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input type="text" name="district" placeholder="District" defaultValue={district} />
        <button type="submit" className="btn btn--outline btn--sm">
          Filter
        </button>
        <a href="/api/admin/export?kind=need" className="btn btn--outline btn--sm">
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
                  </td>
                  <td>{row.district ?? "—"}</td>
                  <td>{row.urgency ?? "—"}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${row.status}`}>{row.status}</span>
                  </td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty">No needs match this filter.</p>
        )}
      </div>
    </div>
  );
}
