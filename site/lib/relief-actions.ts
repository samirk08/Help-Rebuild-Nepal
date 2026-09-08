"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { isDeliveryStage, isItemNeedStatus, needsQuantity } from "./relief-delivery";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";

/**
 * Coordinator actions on the supplies side.
 *
 * Separate from lib/admin-actions.ts because everything here goes through a
 * database function rather than an UPDATE. That is the point: the legal
 * transitions and the auto-close live in migration 018, so a stage can only
 * move in a way the schema agrees with, whether the caller is this file, the
 * SQL editor, or something written next year.
 *
 * Same identity rule as the rest of the dashboard — a Server Action is a POST
 * endpoint reachable independently of the page that renders it, so middleware
 * gating /admin is not enough on its own.
 */

async function requireAdmin(): Promise<string> {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  if (!user || !(await isAdmin(user.id))) redirect("/admin/login");
  return user.id;
}

function text(form: FormData, key: string, max = 500): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/**
 * Moves one offer along, or cancels it.
 *
 * The error from the database is deliberately not swallowed: "Verify this offer
 * before reserving it" is the most useful thing that can be shown, and
 * rewriting it into "Something went wrong" would lose the only sentence that
 * says what to do next.
 */
export async function advanceDelivery(formData: FormData) {
  const actor = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!isDeliveryStage(stage)) throw new Error(`Unknown delivery stage: ${stage}`);

  let quantity: number | null = null;
  if (needsQuantity(stage)) {
    quantity = Number(formData.get("quantity"));
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error("Record how much actually arrived.");
    }
  }

  const { error } = await supabaseAdmin().rpc("relief_advance_pledge", {
    p_pledge_id: id,
    p_stage: stage,
    p_quantity: quantity,
    p_note: text(formData, "note", 1000),
    p_actor: actor,
    p_by: text(formData, "receivedBy", 200),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/relief");
  revalidatePath("/admin/situation");
}

/** Closes a request, or puts a closed one back. */
export async function setItemNeedStatus(formData: FormData) {
  const actor = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isItemNeedStatus(status)) throw new Error(`Unknown item need status: ${status}`);

  const { error } = await supabaseAdmin().rpc("relief_set_item_need_status", {
    p_need_id: id,
    p_status: status,
    p_reason: text(formData, "reason", 500),
    p_actor: actor,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/relief");
}

/**
 * The delivery arrangements, public and private.
 *
 * The window and address go on the public page, because a donor cannot decide
 * whether they can help without them. The name, phone and email do not: a named
 * person reachable by phone, published beside a location and a known shortage,
 * is a safety exposure before it is a privacy one. `item_needs_public` is the
 * only shape the public site reads, and these three columns are not in it.
 */
export async function updateDeliveryDetails(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabaseAdmin()
    .from("item_needs")
    .update({
      delivery_window: text(formData, "deliveryWindow", 200),
      delivery_address: text(formData, "deliveryAddress", 300),
      contact_name: text(formData, "contactName", 200),
      contact_phone: text(formData, "contactPhone", 60),
      contact_email: text(formData, "contactEmail", 200),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/relief");
}
