import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["submitted", "under_review", "verified", "recruiting", "filled", "completed", "rejected"];

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const district = typeof params.district === "string" ? params.district : "";

  let query = supabaseAdmin()
    .from("submissions")
    .select("id, org_or_name, district, contact_phone, status, created_at")
    .eq("kind", "volunteer")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (district) query = query.ilike("district", `%${district}%`);

  const { data: rows } = await query;

  return (
    <div>
      <h1 className="admin-h1">Volunteers</h1>

      <form className="admin-filters" method="get">
        <select name="status" defaultValue={status}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input type="text" name="district" placeholder="District" defaultValue={district} />
        <button type="submit" className="btn btn--outline btn--sm">
          Filter
        </button>
        <a href="/api/admin/export?kind=volunteer" className="btn btn--outline btn--sm">
          Export CSV
        </a>
      </form>

      <div className="admin-table-wrap">
        {rows && rows.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>District</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/volunteers/${row.id}`}>{row.org_or_name ?? "—"}</Link>
                  </td>
                  <td>{row.district ?? "—"}</td>
                  <td>{row.contact_phone ?? "—"}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${row.status}`}>{row.status}</span>
                  </td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty">No volunteers match this filter.</p>
        )}
      </div>
    </div>
  );
}
