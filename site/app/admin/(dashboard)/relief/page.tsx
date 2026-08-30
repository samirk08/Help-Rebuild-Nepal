import { createItemNeed, updatePledgeStatus } from "@/lib/admin-actions";
import { RELIEF_CATEGORIES, categoryById } from "@/lib/relief";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["submitted", "under_review", "verified", "rejected"];

export default async function ReliefAdminPage() {
  const client = supabaseAdmin();

  const [{ data: itemNeeds }, { data: pledgedRows }, { data: pledges }] = await Promise.all([
    client.from("item_needs").select("*").order("created_at", { ascending: false }),
    client.from("item_need_pledged").select("item_need_id, pledged"),
    client.from("pledges").select("*").order("created_at", { ascending: false }),
  ]);

  const pledgedByNeed = new Map((pledgedRows ?? []).map((r) => [r.item_need_id, r.pledged]));

  return (
    <div>
      <h1 className="admin-h1">Relief items</h1>

      <h2 className="admin-section-title">Item needs</h2>
      <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        {itemNeeds && itemNeeds.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Needed</th>
                <th>Pledged</th>
                <th>Location</th>
                <th>Needed by</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {itemNeeds.map((n) => {
                const category = categoryById(n.category);
                return (
                  <tr key={n.id}>
                    <td>{category?.name ?? n.category}</td>
                    <td>{n.quantity}</td>
                    <td>{pledgedByNeed.get(n.id) ?? 0}</td>
                    <td>
                      {n.municipality} · {n.district}
                    </td>
                    <td>{new Date(n.needed_by).toLocaleDateString()}</td>
                    <td>{n.verified ? "Yes" : "No"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty">No item needs yet — add one below.</p>
        )}
      </div>

      {/* There is no public "post an item need" form yet (see README.md), so
          this is currently the only way a demand row gets created. */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
          Add an item need
        </summary>
        <form action={createItemNeed} className="admin-detail" style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <select name="category" required defaultValue="">
            <option value="" disabled>
              Category…
            </option>
            {RELIEF_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.unit})
              </option>
            ))}
          </select>
          <input type="number" name="quantity" placeholder="Quantity" min={1} required />
          <input type="text" name="district" placeholder="District" required />
          <input type="text" name="municipality" placeholder="Municipality" required />
          <input type="text" name="ward" placeholder="Ward (optional)" />
          <input type="date" name="neededBy" required />
          <input type="text" name="requester" placeholder="Requested by" required />
          <textarea className="admin-textarea" name="detail" placeholder="Detail (English)" required />
          <textarea className="admin-textarea" name="detailNp" placeholder="Detail (Nepali, optional)" />
          <label style={{ fontSize: 13.5 }}>
            <input type="checkbox" name="verified" /> Mark verified immediately
          </label>
          <button type="submit" className="btn btn--dark btn--sm" style={{ justifySelf: "start" }}>
            Create item need
          </button>
        </form>
      </details>

      <h2 className="admin-section-title">Pledges</h2>
      <div className="admin-table-wrap">
        {pledges && pledges.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Quantity</th>
                <th>Matched need</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((p) => {
                const category = categoryById(p.category);
                return (
                  <tr key={p.id}>
                    <td>{category?.name ?? p.category}</td>
                    <td>{p.quantity}</td>
                    <td>
                      {p.item_need_id ? (
                        p.item_need_id
                      ) : (
                        <span className="admin-badge admin-badge--rejected">UNREQUESTED</span>
                      )}
                    </td>
                    <td>{p.contact ?? "—"}</td>
                    <td>
                      <form action={updatePledgeStatus} className="admin-form-row">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="status" defaultValue={p.status}>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty">No pledges yet.</p>
        )}
      </div>
    </div>
  );
}
