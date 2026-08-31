import type { ItemNeed } from "./relief";
import { supabaseAdmin } from "./supabase";

/**
 * Server-side reads for the relief boards.
 *
 * Kept out of `lib/relief.ts` on purpose: that module is imported by client
 * components (the offer form), and pulling the service-role Supabase client
 * into a client bundle is exactly the mistake this separation prevents.
 *
 * Only verified item needs are published. An unverified request for goods is
 * how you end up with a warehouse of things nobody asked for — the same
 * reasoning already written into the relief copy.
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
};

function toItemNeed(row: ItemNeedRow, pledged: number): ItemNeed {
  return {
    id: row.id,
    category: row.category,
    quantity: row.quantity,
    pledged,
    district: row.district,
    municipality: row.municipality,
    ward: row.ward ?? undefined,
    neededBy: row.needed_by,
    requester: row.requester,
    verified: row.verified,
    detail: row.detail,
    detailNp: row.detail_np,
  };
}

/** Verified pledged quantities, from the derived view rather than a counter. */
async function pledgedByNeed(): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin().from("item_need_pledged").select("item_need_id, pledged");
  return new Map((data ?? []).map((r) => [r.item_need_id as string, Number(r.pledged) || 0]));
}

export async function listItemNeeds(): Promise<ItemNeed[]> {
  const { data, error } = await supabaseAdmin()
    .from("item_needs")
    .select("*")
    .eq("verified", true)
    .order("needed_by", { ascending: true });

  if (error) {
    console.error("listItemNeeds failed", error);
    return [];
  }

  const pledged = await pledgedByNeed();
  return (data ?? []).map((row) => toItemNeed(row as ItemNeedRow, pledged.get(row.id) ?? 0));
}

export async function getItemNeed(id: string): Promise<ItemNeed | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data } = await supabaseAdmin()
    .from("item_needs")
    .select("*")
    .eq("id", id)
    .eq("verified", true)
    .maybeSingle();

  if (!data) return null;
  const pledged = await pledgedByNeed();
  return toItemNeed(data as ItemNeedRow, pledged.get(data.id) ?? 0);
}
