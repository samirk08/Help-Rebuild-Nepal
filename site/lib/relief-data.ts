import type { ItemNeed } from "./relief";
import { supabaseAdmin } from "./supabase";

/**
 * Server-side reads for the relief boards.
 *
 * Kept out of `lib/relief.ts` on purpose: that module is imported by client
 * components (the offer form), and pulling the service-role Supabase client
 * into a client bundle is exactly the mistake this separation prevents.
 *
 * Everything here reads `item_needs_public` (migration 018) rather than
 * `item_needs`. That view already filters to verified rows and carries the
 * four quantities, and — the reason it exists — it does not have the
 * recipient's name, phone or email in it at all. A `select *` against the base
 * table publishes a ward officer's mobile number; a `select *` against this one
 * cannot.
 */

type ItemNeedRow = {
  id: string;
  category: string;
  quantity: number;
  district: string;
  municipality: string;
  ward: string | null;
  needed_by: string;
  requester: string;
  verified: boolean;
  detail: string;
  detail_np: string;
  status: string;
  delivery_window: string | null;
  delivery_address: string | null;
  pledged: number | string | null;
  committed: number | string | null;
  received: number | string | null;
  remaining: number | string | null;
};

/** Aggregates come back as bigint where the driver hands them over as strings. */
const count = (value: number | string | null | undefined): number => Number(value ?? 0) || 0;

function toItemNeed(row: ItemNeedRow): ItemNeed {
  return {
    id: row.id,
    category: row.category,
    quantity: row.quantity,
    pledged: count(row.pledged),
    committed: count(row.committed),
    received: count(row.received),
    remaining: count(row.remaining),
    status: row.status,
    district: row.district,
    municipality: row.municipality,
    ward: row.ward ?? undefined,
    neededBy: row.needed_by,
    requester: row.requester,
    verified: row.verified,
    detail: row.detail,
    detailNp: row.detail_np,
    deliveryWindow: row.delivery_window ?? undefined,
    deliveryAddress: row.delivery_address ?? undefined,
  };
}

export async function listItemNeeds(): Promise<ItemNeed[]> {
  const { data, error } = await supabaseAdmin()
    .from("item_needs_public")
    .select("*")
    // Closed requests stay readable at their own URL — that is the record of
    // what happened — but they do not belong on a board of things to do.
    .eq("status", "requested")
    .order("needed_by", { ascending: true });

  if (error) {
    console.error("listItemNeeds failed", error);
    return [];
  }

  return (data ?? []).map((row) => toItemNeed(row as ItemNeedRow));
}

export async function getItemNeed(id: string): Promise<ItemNeed | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data } = await supabaseAdmin()
    .from("item_needs_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return toItemNeed(data as ItemNeedRow);
}
