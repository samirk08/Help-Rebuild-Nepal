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
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Overview</h1>
          <p className="admin-head__note">
            Everything submitted through the public site, waiting to be checked by a person.
          </p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat admin-stat--green">
          <p className="admin-stat__value">{volunteers ?? 0}</p>
          <p className="admin-stat__label">Volunteers registered</p>
        </div>
        <div className="admin-stat admin-stat--navy">
          <p className="admin-stat__value">{needs ?? 0}</p>
          <p className="admin-stat__label">Needs posted</p>
        </div>
        <div className="admin-stat admin-stat--purple">
          <p className="admin-stat__value">{pledges ?? 0}</p>
          <p className="admin-stat__label">Relief pledges</p>
        </div>
        <div className="admin-stat admin-stat--amber">
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
                <th className="admin-table__go"></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td>{row.kind === "volunteer" ? "Volunteer" : "Need"}</td>
                  <td>
                    <Link href={`/admin/${routeFor(row.kind)}/${row.id}`}>
                      {row.org_or_name ?? "—"}
                    </Link>
                  </td>
                  <td>{row.district ?? "—"}</td>
                  <td className="admin-table__time">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="admin-table__go">
                    <Link href={`/admin/${routeFor(row.kind)}/${row.id}`}>
                      Review <span aria-hidden="true">→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty">
            <p className="admin-empty__title">Nothing waiting for review</p>
            <p className="admin-empty__hint">
              New volunteer registrations and posted needs land here the moment someone
              submits the form.
            </p>
          </div>
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
