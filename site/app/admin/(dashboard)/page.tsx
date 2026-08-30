import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const client = supabaseAdmin();

  const [{ count: volunteers }, { count: needs }, { count: pledges }, { count: awaitingReview }] =
    await Promise.all([
      client.from("submissions").select("id", { count: "exact", head: true }).eq("kind", "volunteer"),
      client.from("submissions").select("id", { count: "exact", head: true }).eq("kind", "need"),
      // Relief offers land in `pledges`, not `submissions` — see route.ts.
      client.from("pledges").select("id", { count: "exact", head: true }),
      client
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
    ]);

  const { data: recent } = await client
    .from("submissions")
    .select("id, kind, status, org_or_name, district, created_at")
    .eq("status", "submitted")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 className="admin-h1">Overview</h1>

      <div className="admin-stats">
        <div className="admin-stat">
          <p className="admin-stat__value">{volunteers ?? 0}</p>
          <p className="admin-stat__label">Volunteers registered</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__value">{needs ?? 0}</p>
          <p className="admin-stat__label">Needs posted</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__value">{pledges ?? 0}</p>
          <p className="admin-stat__label">Relief pledges</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__value">{awaitingReview ?? 0}</p>
          <p className="admin-stat__label">Awaiting review</p>
        </div>
      </div>

      <h2 className="admin-section-title">Needs your review</h2>
      <div className="admin-table-wrap">
        {recent && recent.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name / org</th>
                <th>District</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td>{row.kind}</td>
                  <td>{row.org_or_name ?? "—"}</td>
                  <td>{row.district ?? "—"}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/admin/${routeFor(row.kind)}/${row.id}`}>Review →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty">Nothing waiting for review.</p>
        )}
      </div>
    </div>
  );
}

// Only ever "volunteer" or "need" here — relief offers land in `pledges`,
// which this page's "needs your review" query doesn't touch (see below).
function routeFor(kind: string): string {
  return kind === "volunteer" ? "volunteers" : "needs";
}
