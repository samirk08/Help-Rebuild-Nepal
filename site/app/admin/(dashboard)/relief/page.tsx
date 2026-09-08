import { createItemNeed, updatePledgeStatus } from "@/lib/admin-actions";
import { PLEDGE_STATUSES, statusLabel } from "@/lib/admin-render";
import { RELIEF_CATEGORIES, categoryById } from "@/lib/relief";
import { advanceDelivery, setItemNeedStatus, updateDeliveryDetails } from "@/lib/relief-actions";
import {
  STAGE_LABEL,
  STAGE_MEANING,
  isDeliveryStage,
  needsQuantity,
  nextStages,
  type DeliveryStage,
} from "@/lib/relief-delivery";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ProgressRow = {
  item_need_id: string;
  quantity: number;
  status: string;
  pledged: number;
  reserved: number;
  dispatched: number;
  received: number;
  committed: number;
  remaining: number;
};

const num = (value: unknown): number => Number(value ?? 0) || 0;

export default async function ReliefAdminPage() {
  const client = supabaseAdmin();

  const [{ data: itemNeeds }, { data: progressRows }, { data: pledges }] = await Promise.all([
    client.from("item_needs").select("*").order("created_at", { ascending: false }),
    client.from("item_need_progress").select("*"),
    client.from("pledges").select("*").order("created_at", { ascending: false }),
  ]);

  const progress = new Map(
    ((progressRows ?? []) as ProgressRow[]).map((r) => [r.item_need_id, r])
  );
  const needById = new Map((itemNeeds ?? []).map((n) => [n.id, n]));

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Relief items</h1>
          <p className="admin-head__note">
            Physical goods that have been asked for, and what has been offered against them.
            Nothing here takes custody of anything — it only records the match.
          </p>
        </div>
      </div>

      {/* The four numbers are separated on purpose. Pledged is a promise;
          received is the only one that means goods exist at the destination. */}
      <h2 className="admin-section-title">Item needs</h2>
      <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        {itemNeeds && itemNeeds.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Needed</th>
                <th>Pledged</th>
                <th>Arranged</th>
                <th>Received</th>
                <th>Still needed</th>
                <th>Location</th>
                <th>Needed by</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {itemNeeds.map((n) => {
                const category = categoryById(n.category);
                const g = progress.get(n.id);
                const status = String(n.status ?? "requested");
                return (
                  <tr key={n.id}>
                    <td>{category?.name ?? n.category}</td>
                    <td>{n.quantity}</td>
                    <td>{num(g?.pledged)}</td>
                    <td>{num(g?.committed)}</td>
                    <td>
                      <strong>{num(g?.received)}</strong>
                    </td>
                    <td>{g ? num(g.remaining) : n.quantity}</td>
                    <td>
                      {n.municipality} · {n.district}
                    </td>
                    <td className="admin-table__time">
                      {new Date(n.needed_by).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className={`admin-badge admin-badge--${
                          n.verified ? (status === "requested" ? "verified" : "completed") : "submitted"
                        }`}
                      >
                        {!n.verified ? "Unverified" : status === "requested" ? "Open" : "Closed"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty">
            <p className="admin-empty__title">No item needs yet</p>
            <p className="admin-empty__hint">
              There is no public form for posting one yet, so add it below.
            </p>
          </div>
        )}
      </div>

      {/* Per-request controls: the lifecycle, and the delivery arrangements.
          Kept collapsed so the table above stays readable. */}
      {(itemNeeds ?? []).map((n) => {
        const status = String(n.status ?? "requested");
        const category = categoryById(n.category);
        return (
          <details key={`admin-${n.id}`} style={{ marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13.5 }}>
              {category?.name ?? n.category} · {n.municipality} — delivery details and status
            </summary>

            <form action={setItemNeedStatus} className="admin-form-row" style={{ margin: "10px 0" }}>
              <input type="hidden" name="id" value={n.id} />
              <select name="status" defaultValue={status} aria-label="Request status">
                <option value="requested">Open — taking offers</option>
                <option value="closed">Closed — met or stood down</option>
                <option value="cancelled">Cancelled — should not have been posted</option>
              </select>
              <input type="text" name="reason" placeholder="Reason (shown to no one but us)" defaultValue={n.closed_reason ?? ""} />
              <button type="submit" className="btn btn--outline btn--sm">
                Save
              </button>
            </form>

            <form
              action={updateDeliveryDetails}
              className="admin-detail"
              style={{ display: "grid", gap: 8, marginBottom: 14 }}
            >
              <input type="hidden" name="id" value={n.id} />
              <input
                type="text"
                name="deliveryWindow"
                placeholder="When deliveries can be accepted (public)"
                defaultValue={n.delivery_window ?? ""}
              />
              <input
                type="text"
                name="deliveryAddress"
                placeholder="Where to deliver (public)"
                defaultValue={n.delivery_address ?? ""}
              />
              {/* Never published. `item_needs_public` — the only shape the
                  public site reads — does not contain these columns at all. */}
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                The three fields below are shared with a donor by a coordinator once a
                collection is arranged. They are never shown on the public site.
              </p>
              <input type="text" name="contactName" placeholder="Delivery contact name (private)" defaultValue={n.contact_name ?? ""} />
              <input type="text" name="contactPhone" placeholder="Delivery contact phone (private)" defaultValue={n.contact_phone ?? ""} />
              <input type="email" name="contactEmail" placeholder="Delivery contact email (private)" defaultValue={n.contact_email ?? ""} />
              <button type="submit" className="btn btn--dark btn--sm" style={{ justifySelf: "start" }}>
                Save delivery details
              </button>
            </form>
          </details>
        );
      })}

      {/* There is no public "post an item need" form yet (see README.md), so
          this is currently the only way a demand row gets created. */}
      <details style={{ margin: "16px 0 24px" }}>
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

      <h2 className="admin-section-title">Deliveries</h2>
      <p className="admin-head__note" style={{ marginBottom: 12 }}>
        Each offer moves one step at a time. {STAGE_MEANING.reserved} {STAGE_MEANING.received}
      </p>
      <div className="admin-table-wrap">
        {pledges && pledges.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Offered</th>
                <th>Arrived</th>
                <th>Matched need</th>
                <th>Contact</th>
                <th>Reviewed</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((p) => {
                const category = categoryById(p.category);
                // Rows come back untyped, and a stage this build does not know
                // about must not index a label map. Anything unrecognised reads
                // as an untouched offer, which is the safe direction.
                const stage: DeliveryStage = isDeliveryStage(p.stage) ? p.stage : "offered";
                const need = p.item_need_id ? needById.get(p.item_need_id) : null;
                const onward = nextStages(stage, p.status);
                return (
                  <tr key={p.id}>
                    <td>{category?.name ?? p.category}</td>
                    <td>{p.quantity}</td>
                    <td>{stage === "received" ? <strong>{p.received_quantity}</strong> : "—"}</td>
                    <td>
                      {need ? (
                        `${need.municipality} · ${need.district}`
                      ) : p.item_need_id ? (
                        p.item_need_id
                      ) : (
                        <span className="admin-badge admin-badge--rejected">UNREQUESTED</span>
                      )}
                    </td>
                    <td>{p.contact ?? "—"}</td>
                    <td>
                      {/* Whether we believe the offer is real. Separate from
                          where the goods are — that is the stage. */}
                      <form action={updatePledgeStatus} className="admin-form-row">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="status" defaultValue={p.status} aria-label="Pledge status">
                          {PLEDGE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="btn btn--outline btn--sm">
                          Update
                        </button>
                      </form>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${badgeFor(stage)}`}>
                        {STAGE_LABEL[stage]}
                      </span>
                      {/* Only the moves the database will accept are offered.
                          A dropdown of every stage would mean most choices
                          raise an exception, and reserving an unverified offer
                          would mean vouching for a donor nobody has checked. */}
                      {onward.length === 0 ? null : (
                        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          {onward.map((next) => (
                            <form action={advanceDelivery} className="admin-form-row" key={next}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="stage" value={next} />
                              {needsQuantity(next) ? (
                                <>
                                  <input
                                    type="number"
                                    name="quantity"
                                    min={1}
                                    max={p.quantity}
                                    defaultValue={p.quantity}
                                    required
                                    aria-label="Quantity that arrived"
                                    style={{ width: 84 }}
                                  />
                                  <input
                                    type="text"
                                    name="receivedBy"
                                    placeholder="Confirmed by"
                                    aria-label="Who confirmed receipt"
                                  />
                                </>
                              ) : null}
                              <button type="submit" className="btn btn--outline btn--sm">
                                {STAGE_LABEL[next]}
                              </button>
                            </form>
                          ))}
                        </div>
                      )}
                      {stage === "offered" && p.status !== "verified" ? (
                        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                          Verify this offer before arranging a collection.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty">
            <p className="admin-empty__title">No pledges yet</p>
            <p className="admin-empty__hint">
              Offers made against an item need on the public relief page will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Reuses the submission-status badge palette rather than adding a second one. */
function badgeFor(stage: string): string {
  if (stage === "received") return "verified";
  if (stage === "cancelled") return "rejected";
  if (stage === "offered") return "submitted";
  return "recruiting";
}
