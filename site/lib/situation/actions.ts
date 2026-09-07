"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "../supabase";
import { supabaseServerClient } from "../supabase-server";
import type { ActionState } from "../matching/validation";
import { parseItemKey } from "./keys";
import { isQueuePriority } from "./derive";
import type { QueueAssignment, QueuePriority, QueueState } from "./types";

async function actor() {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) throw new Error("Coordinator access is required.");
  return { id: user.id };
}

function failure(e: unknown): ActionState {
  return {
    error: e instanceof Error ? e.message : "Could not save this change. Please refresh and try again.",
  };
}

function refresh() {
  revalidatePath("/admin/situation");
}

function keyFrom(form: FormData): string {
  const key = String(form.get("itemKey") ?? "");
  if (!parseItemKey(key)) throw new Error("Invalid queue item.");
  return key;
}

async function currentAssignment(itemKey: string): Promise<QueueAssignment | null> {
  const { data, error } = await supabaseAdmin()
    .from("queue_assignments")
    .select("*")
    .eq("item_key", itemKey)
    .maybeSingle();
  if (error) throw new Error("Could not load the current assignment.");
  return (data as QueueAssignment | null) ?? null;
}

async function writeEvent(itemKey: string, actorId: string, event: string, detail: string | null) {
  const { error } = await supabaseAdmin().from("queue_events").insert({
    item_key: itemKey,
    actor_id: actorId,
    event,
    detail,
  });
  if (error) throw new Error("Saved the assignment but could not write the activity log.");
}

async function upsertAssignment(
  itemKey: string,
  patch: {
    owner_id: string | null;
    due_at: string | null;
    priority: QueuePriority;
    state: QueueState;
    snoozed_until: string | null;
  }
) {
  const { error } = await supabaseAdmin().from("queue_assignments").upsert(
    {
      item_key: itemKey,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "item_key" }
  );
  if (error) throw new Error("Could not save the queue assignment.");
}

function dueFrom(form: FormData): string | null {
  const raw = String(form.get("dueAt") ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Enter a valid due date.");
  return `${raw}T00:00:00.000Z`;
}

function ownerFrom(form: FormData): string | null {
  const raw = String(form.get("ownerId") ?? "").trim();
  if (!raw) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new Error("Invalid coordinator.");
  }
  return raw;
}

function priorityFrom(form: FormData, fallback: QueuePriority): QueuePriority {
  const raw = String(form.get("priority") ?? "").trim();
  if (!raw) return fallback;
  if (!isQueuePriority(raw)) throw new Error("Choose a priority from the list.");
  return raw;
}

export async function updateQueueItem(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor();
    const itemKey = keyFrom(form);
    const existing = await currentAssignment(itemKey);
    const ownerId = ownerFrom(form);
    const dueAt = dueFrom(form) ?? existing?.due_at ?? null;
    const priority = priorityFrom(form, existing?.priority ?? "normal");
    const state: QueueState = existing?.state === "resolved" ? "resolved" : "open";

    await upsertAssignment(itemKey, {
      owner_id: ownerId,
      due_at: dueAt,
      priority,
      state,
      snoozed_until: null,
    });

    const changes: string[] = [];
    if ((existing?.owner_id ?? null) !== ownerId) {
      changes.push(ownerId ? `assigned to ${ownerId}` : "unassigned");
      await writeEvent(itemKey, who.id, ownerId ? "assigned" : "unassigned", ownerId);
    }
    if ((existing?.due_at ?? null) !== dueAt) {
      changes.push(dueAt ? `due ${dueAt.slice(0, 10)}` : "due date cleared");
      await writeEvent(itemKey, who.id, "due_set", dueAt);
    }
    if ((existing?.priority ?? null) !== priority) {
      changes.push(`priority ${priority}`);
      await writeEvent(itemKey, who.id, "priority_set", priority);
    }
    if (changes.length === 0) {
      await writeEvent(itemKey, who.id, "updated", "Saved with no field changes.");
    }

    refresh();
    return { success: "Assignment saved." };
  } catch (e) {
    return failure(e);
  }
}

export async function snoozeQueueItem(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor();
    const itemKey = keyFrom(form);
    const days = Number(String(form.get("snoozeDays") ?? "2"));
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new Error("Snooze for between 1 and 30 days.");
    }
    const existing = await currentAssignment(itemKey);
    const until = new Date(Date.now() + days * 86400000).toISOString();

    await upsertAssignment(itemKey, {
      owner_id: existing?.owner_id ?? who.id,
      due_at: existing?.due_at ?? until,
      priority: existing?.priority ?? "normal",
      state: "snoozed",
      snoozed_until: until,
    });
    await writeEvent(itemKey, who.id, "snoozed", `Snoozed for ${days} day${days === 1 ? "" : "s"} until ${until}`);
    refresh();
    return { success: `Snoozed for ${days} day${days === 1 ? "" : "s"}.` };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Marks the queue entry dealt with. Does not verify a need, confirm an
 * invitation, or otherwise mutate the underlying record — those stay on the
 * screens that actually own them.
 */
export async function resolveQueueItem(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const who = await actor();
    const itemKey = keyFrom(form);
    const existing = await currentAssignment(itemKey);

    await upsertAssignment(itemKey, {
      owner_id: existing?.owner_id ?? who.id,
      due_at: existing?.due_at ?? null,
      priority: existing?.priority ?? "normal",
      state: "resolved",
      snoozed_until: null,
    });
    await writeEvent(itemKey, who.id, "resolved", "Queue entry marked dealt with. Underlying record unchanged.");
    refresh();
    return { success: "Marked dealt with. The underlying record was not changed." };
  } catch (e) {
    return failure(e);
  }
}
