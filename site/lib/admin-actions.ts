"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DOCUMENTS_BUCKET } from "./storage-constants";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";

/**
 * All admin-dashboard mutations, as Server Actions — the idiomatic App
 * Router way to handle a `<form action={...}>` without a matching API route
 * per action. Every one of these re-checks who's signed in itself rather
 * than trusting `middleware.ts` alone: middleware protects page navigation,
 * but a Server Action can in principle be invoked directly, so the identity
 * check has to live here too.
 */

async function requireAdmin(): Promise<{ id: string; email: string }> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  return { id: user.id, email: user.email ?? "" };
}

export async function signOut() {
  const supabase = await supabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

const STATUSES = [
  "submitted",
  "under_review",
  "verified",
  "recruiting",
  "filled",
  "completed",
  "rejected",
] as const;

export async function updateSubmissionStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const returnTo = String(formData.get("returnTo") ?? "/admin");

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error(`Invalid status: ${status}`);
  }

  const patch: Record<string, unknown> = { status };
  if (status === "verified") {
    patch.verified_by = admin.id;
    patch.verified_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin().from("submissions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(returnTo);
}

export async function updateSubmissionNotes(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const notes = String(formData.get("notes") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");

  const { error } = await supabaseAdmin().from("submissions").update({ notes }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(returnTo);
}

/**
 * Permanently remove a volunteer registration.
 *
 * Three things have to happen in this order, and none of them is automatic:
 *
 * 1. Uploaded files are erased from Storage first. Deleting the row cascades
 *    the `documents` records away, which would take the storage paths with
 *    them and strand the actual files in the bucket forever. For a form that
 *    collects identity documents, "deleted" has to mean the file is gone, not
 *    just the row pointing at it.
 * 2. `matches` rows are removed explicitly. That foreign key has no cascade
 *    (see supabase/schema.sql), so a matched volunteer cannot be deleted at
 *    all until its links are gone. A match without a volunteer is meaningless
 *    anyway.
 * 3. Only then the submission itself, which cascades the `documents` rows.
 *
 * Scoped to `kind = 'volunteer'` so a need can never be removed through this
 * path: needs carry expressions of interest and can be promoted to projects,
 * which is a materially different decision.
 */
export async function deleteVolunteer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const client = supabaseAdmin();

  const { data: row } = await client
    .from("submissions")
    .select("id")
    .eq("id", id)
    .eq("kind", "volunteer")
    .maybeSingle();

  if (!row) redirect("/admin/volunteers");

  const { data: documents } = await client
    .from("documents")
    .select("storage_path")
    .eq("submission_id", id);

  const paths = (documents ?? []).map((d) => d.storage_path as string);
  if (paths.length > 0) {
    const { error: storageError } = await client.storage.from(DOCUMENTS_BUCKET).remove(paths);
    // Stop rather than continue: deleting the row now would leave these files
    // in the bucket with nothing left recording that they exist.
    if (storageError) throw new Error(`Could not remove uploaded files: ${storageError.message}`);
  }

  const { error: matchError } = await client.from("matches").delete().eq("volunteer_id", id);
  if (matchError) throw new Error(matchError.message);

  const { error } = await client.from("submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/volunteers");
  revalidatePath("/admin");
  redirect("/admin/volunteers");
}

/** Manual match: an admin decided this volunteer fits this need. No suggestion engine involved. */
export async function createMatch(formData: FormData) {
  await requireAdmin();
  const needId = String(formData.get("needId"));
  const volunteerId = String(formData.get("volunteerId"));

  const { error } = await supabaseAdmin()
    .from("matches")
    .insert({ need_id: needId, volunteer_id: volunteerId });

  // 23505 = unique_violation against matches_need_volunteer_key (migration
  // 002). Matching the same volunteer twice is a double-click, not an error
  // worth showing: the desired state already holds, and the row must not be
  // duplicated or it would double-count against the need's fill bar.
  if (error && error.code !== "23505") throw new Error(error.message);

  revalidatePath(`/admin/needs/${needId}`);
}

/** Manual promotion: this need became standing work rather than a one-off. */
export async function promoteToProject(formData: FormData) {
  await requireAdmin();
  const needId = String(formData.get("needId"));
  const coordinator = String(formData.get("coordinator") ?? "");

  const { error } = await supabaseAdmin()
    .from("projects")
    .insert({ need_id: needId, coordinator: coordinator || null });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/needs/${needId}`);
}

/**
 * Staff-entered relief item need. There is no public form for this yet — see
 * README.md — so until one exists, this is how a demand row gets created at
 * all.
 */
export async function createItemNeed(formData: FormData) {
  await requireAdmin();

  const { error } = await supabaseAdmin()
    .from("item_needs")
    .insert({
      category: String(formData.get("category")),
      quantity: Number(formData.get("quantity")),
      district: String(formData.get("district")),
      municipality: String(formData.get("municipality")),
      ward: String(formData.get("ward") || "") || null,
      needed_by: String(formData.get("neededBy")),
      requester: String(formData.get("requester")),
      detail: String(formData.get("detail")),
      detail_np: String(formData.get("detailNp") || ""),
      verified: formData.get("verified") === "on",
    });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/relief");
}

export async function updatePledgeStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error(`Invalid status: ${status}`);
  }

  const { error } = await supabaseAdmin().from("pledges").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/relief");
}
